import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkIsAdmin } from "@/lib/auth-helpers";
import { calculatePlanEndDate, PlanType } from "@/lib/plan-helpers";
import { formatAccountNumber, parseAccountNumber, getNextAccountNumberFromList } from "@/lib/account";

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
    const supabase = await createServerClient();
    let { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const admin = getAdminClient();
        const { data } = await admin.auth.getUser(token);
        user = data.user;
      }
    }

    if (!user) {
      return {
        authorized: false as const,
        response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
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

      const planType: PlanType = meta.plan_type || "prueba";
      const planStartDate =
        meta.plan_start_date ||
        p.created_at?.split("T")[0] ||
        new Date().toISOString().split("T")[0];
      const planEndDate =
        meta.plan_end_date || calculatePlanEndDate(planStartDate, planType);
      const accountStatus =
        meta.account_status || (p.status === "suspended" ? "suspended" : "active");
      const avatarUrl = meta.avatar_url || null;

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

      return {
        ...p,
        account_number: accountNumber,
        plan_type: planType,
        plan_start_date: planStartDate,
        plan_end_date: planEndDate,
        account_status: accountStatus,
        avatar_url: avatarUrl,
      };
    });

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

    const startDate =
      planStartDate?.trim() || new Date().toISOString().split("T")[0];
    const endDate =
      planEndDate?.trim() || calculatePlanEndDate(startDate, planType as PlanType);

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
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          account_number: nextAccountNumber,
          full_name: fullName?.trim() || null,
          business_name: businessName?.trim() || null,
          plan_type: planType,
          plan_start_date: startDate,
          plan_end_date: endDate,
          account_status: accountStatus,
        },
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
      role: "user",
      status: profileStatus,
      updated_at: new Date().toISOString(),
    };

    let { error: profileError } = await supabaseAdmin.from("profiles").upsert(profilePayload);

    if (profileError) {
      // Fallback si la columna account_number no existe aún en la tabla
      delete profilePayload.account_number;
      const { error: fallbackError } = await supabaseAdmin.from("profiles").upsert(profilePayload);
      if (fallbackError) {
        return NextResponse.json(
          { error: fallbackError.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        ...authData.user,
        account_number: nextAccountNumber,
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
    if (planType !== undefined) updatedMetadata.plan_type = planType;
    if (planStartDate !== undefined) updatedMetadata.plan_start_date = planStartDate;
    if (planEndDate !== undefined) updatedMetadata.plan_end_date = planEndDate;
    if (accountStatus !== undefined) updatedMetadata.account_status = accountStatus;
    if (avatarUrl !== undefined) updatedMetadata.avatar_url = avatarUrl;

    // Si viene solo status legacy (toggle active/suspended), sincronizar account_status
    if (status !== undefined && accountStatus === undefined) {
      updatedMetadata.account_status = status === "suspended" ? "suspended" : "active";
    }

    authUpdates.user_metadata = updatedMetadata;

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

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId);

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

