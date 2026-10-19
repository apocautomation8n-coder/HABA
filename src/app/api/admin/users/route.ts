import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkIsAdmin } from "@/lib/auth-helpers";
import { calculatePlanEndDate, PlanType, buildInitialUserMetadata, getTrustedPlanMeta, splitPlanMetadata } from "@/lib/plan-helpers";
import { formatAccountNumber, parseAccountNumber, getNextAccountNumberFromList } from "@/lib/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function verifyAdminCaller(request: Request) {
  try {
    let user: any = null;

    // Priorizar Bearer token de Authorization header
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const admin = getAdminClient();
      const { data } = await admin.auth.getUser(token);
      if (data?.user) {
        user = data.user;
      }
    }

    if (!user) {
      const supabase = await createServerClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user) {
      return {
        authorized: false as const,
        response: NextResponse.json(
          { error: "No autenticado" },
          {
            status: 401,
            headers: { "Cache-Control": "no-store, max-age=0" },
          }
        ),
      };
    }

    if (!checkIsAdmin(user)) {
      return {
        authorized: false as const,
        response: NextResponse.json(
          { error: "Acceso denegado: solo administradora (Gio)" },
          { status: 403 }
        ),
      };
    }

    return { authorized: true as const, user };
  } catch (err: any) {
    return {
      authorized: false as const,
      response: NextResponse.json({ error: "Error de autenticación: " + err.message }, { status: 500 }),
    };
  }
}

// GET: Listar todas las usuarias del sistema enriquecidas con plan, estado de cuenta y número de cuenta
export async function GET(request: Request) {
  try {
    const auth = await verifyAdminCaller(request);
    if (!auth.authorized) return auth.response;

    const supabaseAdmin = getAdminClient();

    // 1. Obtener perfiles de la base de datos
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 400 });
    }

    // 2. Obtener usuarios de Auth para recuperar user_metadata (planes, fechas, avatar, account_number)
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const authMap = new Map(authData?.users?.map((u) => [u.id, u]) || []);

    // Mapa cronológico para fallback de números de cuenta (Admin Gio es siempre 01)
    const chronologicalProfiles = [...(profiles || [])].sort((a, b) =>
      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
    const idToSeqMap = new Map(
      chronologicalProfiles.map((p, idx) => [p.id, formatAccountNumber(idx + 1)])
    );

    const users = (profiles || []).map((p) => {
      const authUser = authMap.get(p.id);
      const meta = authUser?.user_metadata || {};

      // Datos del plan: solo desde app_metadata (user_metadata lo puede editar la usuaria)
      const trusted = getTrustedPlanMeta(authUser || { created_at: p.created_at });
      const planType: PlanType = trusted.plan_type;
      const planStartDate = trusted.plan_start_date;
      const planEndDate = trusted.plan_end_date;
      const accountStatus =
        authUser?.app_metadata?.account_status ||
        (p.status === "suspended" ? "suspended" : "active");
      const avatarUrl = meta.avatar_url || null;
      const phone = p.phone || p.business_phone || meta.phone || meta.business_phone || null;
      const createdAt = p.created_at || authUser?.created_at || new Date().toISOString();

      // Recuperar account_number normalizado en formato de 2 dígitos ("01", "02", etc.)
      let accountNumber = p.account_number || meta.account_number;
      if (!accountNumber || accountNumber.includes("HABA-001001")) {
        accountNumber = idToSeqMap.get(p.id) || "01";
      } else {
        const parsed = parseAccountNumber(accountNumber);
        if (parsed !== null && parsed < 1000) {
          accountNumber = formatAccountNumber(parsed);
        } else {
          accountNumber = idToSeqMap.get(p.id) || "01";
        }
      }

      const isNew =
        meta.is_new !== undefined
          ? Boolean(meta.is_new)
          : (new Date().getTime() - new Date(createdAt || 0).getTime()) <
            7 * 24 * 60 * 60 * 1000;

      return {
        ...p,
        phone,
        created_at: createdAt,
        account_number: accountNumber,
        plan_type: planType,
        plan_start_date: planStartDate,
        plan_end_date: planEndDate,
        account_status: accountStatus,
        avatar_url: avatarUrl,
        is_new: isNew,
        registration_source: meta.registration_source || "admin",
        mp_status: trusted.mp_status,
        mp_preapproval_id: trusted.mp_preapproval_id,
      };
    });

    // Asegurar que usuarios registrados recientemente que aún no sincronicen fila en profiles se listen
    const profileIdSet = new Set((profiles || []).map((p) => p.id));
    const missingFromProfiles = (authData?.users || []).filter((u) => !profileIdSet.has(u.id));

    for (const u of missingFromProfiles) {
      const meta = u.user_metadata || {};
      const trusted = getTrustedPlanMeta(u);
      const planType: PlanType = trusted.plan_type;
      const planStartDate = trusted.plan_start_date;
      const planEndDate = trusted.plan_end_date;
      const accountStatus = trusted.account_status;
      const accountNumber = meta.account_number || idToSeqMap.get(u.id) || "01";
      const phone = meta.phone || meta.business_phone || null;

      users.push({
        id: u.id,
        email: u.email || "",
        full_name: meta.full_name || null,
        business_name: meta.business_name || null,
        phone,
        account_number: accountNumber,
        role: "user",
        status: "active",
        created_at: u.created_at,
        plan_type: planType,
        plan_start_date: planStartDate,
        plan_end_date: planEndDate,
        account_status: accountStatus,
        avatar_url: meta.avatar_url || null,
        is_new: true,
        registration_source: meta.registration_source || "public",
        mp_status: trusted.mp_status,
        mp_preapproval_id: trusted.mp_preapproval_id,
      });
    }

    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Alta de nueva usuaria
export async function POST(request: Request) {
  try {
    const auth = await verifyAdminCaller(request);
    if (!auth.authorized) return auth.response;

    const supabaseAdmin = getAdminClient();
    const body = await request.json();
    const {
      email,
      password,
      fullName,
      businessName,
      phone,
      planType = "prueba",
      planStartDate,
      planEndDate,
      accountStatus = "active",
    } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    // Regla de Negocio: todo alta nueva comienza obligatoriamente en plan de prueba (15 días)
    // El plan mensual solo se habilita al abonar a través de la pasarela de Mercado Pago
    const effectivePlanType: PlanType = "prueba";
    const startDate =
      planStartDate?.trim() || new Date().toISOString().split("T")[0];
    const endDate = calculatePlanEndDate(startDate, effectivePlanType);

    // Obtener usuarios existentes de Auth y perfiles para calcular el siguiente ID secuencial
    let nextAccountNumber = "01";
    try {
      const { data: authDataList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const authUsers = authDataList?.users || [];

      // Mapear cuentas existentes con su account_number y fecha de creación
      const existingAccounts = authUsers.map((u) => ({
        account_number: (u.user_metadata?.account_number as string | undefined) || null,
        email: u.email,
        created_at: u.created_at,
      }));

      // Calcular el siguiente número secuencial (ej. si hay 5 usuarios -> "06")
      nextAccountNumber = getNextAccountNumberFromList(existingAccounts);

      // Verificación estricta de unicidad: asegurarse de que no exista colisión
      const existingNumbers = new Set(
        existingAccounts
          .map((a) => {
            const parsed = parseAccountNumber(a.account_number);
            return parsed !== null && parsed < 1000 ? formatAccountNumber(parsed) : null;
          })
          .filter(Boolean)
      );
      let candidateSeq = parseAccountNumber(nextAccountNumber) || 1;
      while (existingNumbers.has(formatAccountNumber(candidateSeq))) {
        candidateSeq++;
      }
      nextAccountNumber = formatAccountNumber(candidateSeq);
    } catch (calcErr) {
      console.error("Error al calcular el siguiente número de cuenta:", calcErr);
      nextAccountNumber = "01";
    }

    // 1. Crear usuario en Auth con confirmación automática, metadata de plan y account_number único
    const initialPlanMeta = buildInitialUserMetadata({
      planType: effectivePlanType,
      planStartDate: startDate,
      planEndDate: endDate,
      accountStatus: accountStatus,
      isNew: true,
      registrationSource: "admin",
    });

    const cleanPhone = phone?.trim() || null;

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          account_number: nextAccountNumber,
          full_name: fullName?.trim() || null,
          business_name: businessName?.trim() || null,
          phone: cleanPhone,
          business_phone: cleanPhone,
          ...splitPlanMetadata(initialPlanMeta).user,
        },
        // Datos del plan en app_metadata: no editables por la usuaria
        app_metadata: splitPlanMetadata(initialPlanMeta).app,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "No se pudo crear el usuario en Auth" },
        { status: 400 }
      );
    }

    // 2. Insertar o actualizar su perfil en public.profiles
    const profileStatus = accountStatus === "active" ? "active" : "suspended";

    const profilePayload: Record<string, any> = {
      id: authData.user.id,
      account_number: nextAccountNumber,
      email: email.trim().toLowerCase(),
      full_name: fullName?.trim() || null,
      business_name: businessName?.trim() || null,
      phone: cleanPhone,
      business_phone: cleanPhone,
      role: "user",
      status: profileStatus,
      updated_at: new Date().toISOString(),
    };

    let { error: profileError } = await supabaseAdmin.from("profiles").upsert(profilePayload);

    if (profileError) {
      // Fallback si la columna account_number o phone no existen aún en la tabla
      delete profilePayload.account_number;
      let { error: fallbackError } = await supabaseAdmin.from("profiles").upsert(profilePayload);
      if (fallbackError) {
        delete profilePayload.phone;
        delete profilePayload.business_phone;
        const { error: minimalError } = await supabaseAdmin.from("profiles").upsert(profilePayload);
        if (minimalError) {
          return NextResponse.json(
            { error: minimalError.message },
            { status: 400 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        ...authData.user,
        account_number: nextAccountNumber,
        phone: cleanPhone,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


// PATCH: Cambiar estado o actualizar datos del usuario y de su plan
export async function PATCH(request: Request) {
  try {
    const auth = await verifyAdminCaller(request);
    if (!auth.authorized) return auth.response;

    const supabaseAdmin = getAdminClient();
    const body = await request.json();
    const {
      userId,
      status,
      password,
      fullName,
      businessName,
      email,
      phone,
      planType,
      planStartDate,
      planEndDate,
      accountStatus,
      avatarUrl,
    } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    // Obtener metadata actual del usuario para hacer merge seguro
    const { data: userAuthData, error: fetchAuthError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (fetchAuthError || !userAuthData.user) {
      return NextResponse.json(
        { error: "Usuario no encontrado en Auth: " + (fetchAuthError?.message || "") },
        { status: 404 }
      );
    }

    const currentMetadata = userAuthData.user.user_metadata || {};

    // 1. Actualizaciones en Auth (email, password, metadata)
    const authUpdates: Record<string, any> = {};
    if (email && email.trim()) {
      authUpdates.email = email.trim().toLowerCase();
      authUpdates.email_confirm = true;
    }
    if (password) {
      authUpdates.password = password;
    }

    const updatedMetadata = { ...currentMetadata };
    if (fullName !== undefined) updatedMetadata.full_name = fullName?.trim() || null;
    if (businessName !== undefined) updatedMetadata.business_name = businessName?.trim() || null;
    if (phone !== undefined) {
      const cleanPhone = phone?.trim() || null;
      updatedMetadata.phone = cleanPhone;
      updatedMetadata.business_phone = cleanPhone;
    }
    if (avatarUrl !== undefined) updatedMetadata.avatar_url = avatarUrl;

    // Datos del plan: se guardan en app_metadata (solo el servidor puede escribirlos)
    const planUpdates: Record<string, any> = {};
    if (planType !== undefined) planUpdates.plan_type = planType;
    if (planStartDate !== undefined) planUpdates.plan_start_date = planStartDate;
    if (planEndDate !== undefined) planUpdates.plan_end_date = planEndDate;
    if (accountStatus !== undefined) planUpdates.account_status = accountStatus;

    // Si viene solo status legacy (toggle active/suspended), sincronizar account_status
    if (status !== undefined && accountStatus === undefined) {
      planUpdates.account_status = status === "suspended" ? "suspended" : "active";
    }

    authUpdates.user_metadata = updatedMetadata;
    if (Object.keys(planUpdates).length > 0) {
      authUpdates.app_metadata = planUpdates;
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. Actualizaciones en public.profiles
    const profileUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (accountStatus !== undefined) {
      profileUpdates.status = accountStatus === "active" ? "active" : "suspended";
    } else if (status !== undefined) {
      profileUpdates.status = status;
    }

    if (fullName !== undefined) profileUpdates.full_name = fullName?.trim() || null;
    if (businessName !== undefined) profileUpdates.business_name = businessName?.trim() || null;
    if (email !== undefined && email.trim()) profileUpdates.email = email.trim().toLowerCase();
    if (phone !== undefined) {
      const cleanPhone = phone?.trim() || null;
      profileUpdates.phone = cleanPhone;
      profileUpdates.business_phone = cleanPhone;
    }

    let { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId);

    if (profileError && (profileError.message.includes("phone") || profileError.message.includes("column"))) {
      delete profileUpdates.phone;
      delete profileUpdates.business_phone;
      const fallback = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", userId);
      profileError = fallback.error;
    }

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Eliminar usuaria definitivamente
export async function DELETE(request: Request) {
  try {
    const auth = await verifyAdminCaller(request);
    if (!auth.authorized) return auth.response;

    const supabaseAdmin = getAdminClient();
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    // 1. Borrar perfil en profiles
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // 2. Borrar de auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

