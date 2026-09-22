import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { calculatePlanEndDate } from "@/lib/plan-helpers";
import { formatAccountNumber, parseAccountNumber } from "@/lib/account";

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

// GET: Obtener perfil del usuario actual (bypasseando RLS para evitar recursión)
export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    let { data: { user } } = await supabase.auth.getUser();

    // Fallback: si viene Authorization header
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
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const admin = getAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const isAdmin =
      user.email?.toLowerCase() === "admin@admin.com" ||
      user.user_metadata?.role === "admin" ||
      profile?.role === "admin";

    const meta = user.user_metadata || {};
    let accountNumber = profile?.account_number || meta.account_number || null;

    // Si aún no tiene número de cuenta o tiene el formato antiguo, asignar secuencialmente
    if (!accountNumber || accountNumber.includes("HABA-001001")) {
      try {
        const { data: allProfiles } = await admin
          .from("profiles")
          .select("id, created_at")
          .order("created_at", { ascending: true });

        if (allProfiles && allProfiles.length > 0) {
          const userIndex = allProfiles.findIndex((p) => p.id === user.id);
          const seq = userIndex >= 0 ? userIndex + 1 : 1;
          accountNumber = formatAccountNumber(seq);

          // Guardar de forma persistente en user_metadata
          await admin.auth.admin.updateUserById(user.id, {
            user_metadata: { ...meta, account_number: accountNumber },
          });
          try {
            await admin.from("profiles").update({ account_number: accountNumber }).eq("id", user.id);
          } catch {
            // Fallback si la columna no existe en profiles
          }
        } else {
          accountNumber = "01";
        }
      } catch {
        accountNumber = "01";
      }
    } else {
      const parsed = parseAccountNumber(accountNumber);
      if (parsed !== null && parsed < 1000) {
        accountNumber = formatAccountNumber(parsed);
      }
    }

    const planType = meta.plan_type || "prueba";
    const planStartDate =
      meta.plan_start_date ||
      user.created_at?.split("T")[0] ||
      new Date().toISOString().split("T")[0];
    const planEndDate =
      meta.plan_end_date || calculatePlanEndDate(planStartDate, planType);
    const accountStatus =
      meta.account_status || (profile?.status === "suspended" ? "suspended" : "active");
    const avatarUrl = meta.avatar_url || null;

    const fullProfile = {
      id: user.id,
      account_number: accountNumber,
      email: profile?.email || user.email,
      full_name: profile?.full_name || meta.full_name || null,
      business_name: profile?.business_name || meta.business_name || null,
      phone: profile?.phone || profile?.business_phone || meta.phone || meta.business_phone || null,
      business_phone: profile?.business_phone || profile?.phone || meta.business_phone || meta.phone || null,
      business_email: profile?.business_email || meta.business_email || null,
      instagram: profile?.instagram || meta.instagram || null,
      address: profile?.address || meta.address || null,
      role: isAdmin ? "admin" : profile?.role || "user",
      status: profile?.status || "active",
      plan_type: planType,
      plan_start_date: planStartDate,
      plan_end_date: planEndDate,
      account_status: accountStatus,
      avatar_url: avatarUrl,
      created_at: profile?.created_at || user.created_at,
    };


    return NextResponse.json({
      user,
      profile: fullProfile,
      isAdmin,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Actualizar perfil del usuario actual
export async function PATCH(request: Request) {
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
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      fullName,
      businessName,
      phone,
      businessPhone,
      businessEmail,
      instagram,
      address,
      email,
      password,
      avatarUrl,
    } = body;

    const finalPhone =
      businessPhone !== undefined
        ? businessPhone?.trim() || null
        : phone !== undefined
        ? phone?.trim() || null
        : undefined;
    const finalEmail = businessEmail !== undefined ? businessEmail?.trim() || null : undefined;
    const finalInstagram = instagram !== undefined ? instagram?.trim() || null : undefined;
    const finalAddress = address !== undefined ? address?.trim() || null : undefined;

    const admin = getAdminClient();
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (fullName !== undefined) updateData.full_name = fullName?.trim() || null;
    if (businessName !== undefined) updateData.business_name = businessName?.trim() || null;

    const authUpdate: Record<string, any> = {
      user_metadata: {
        ...(user.user_metadata || {}),
        full_name: fullName !== undefined ? fullName.trim() : user.user_metadata?.full_name,
        business_name: businessName !== undefined ? businessName.trim() : user.user_metadata?.business_name,
      },
    };

    if (finalPhone !== undefined) {
      authUpdate.user_metadata.phone = finalPhone;
      authUpdate.user_metadata.business_phone = finalPhone;
    }
    if (finalEmail !== undefined) {
      authUpdate.user_metadata.business_email = finalEmail;
    }
    if (finalInstagram !== undefined) {
      authUpdate.user_metadata.instagram = finalInstagram;
    }
    if (finalAddress !== undefined) {
      authUpdate.user_metadata.address = finalAddress;
    }

    if (avatarUrl !== undefined) {
      authUpdate.user_metadata.avatar_url = avatarUrl;
    }

    if (email && email.trim().toLowerCase() !== user.email?.toLowerCase()) {
      authUpdate.email = email.trim().toLowerCase();
      authUpdate.email_confirm = true;
      updateData.email = email.trim().toLowerCase();
    }

    if (password && password.trim().length >= 6) {
      authUpdate.password = password.trim();
    }

    // 1. Actualizar datos en Supabase Auth
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(user.id, authUpdate);
    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
    }

    // 2. Intentar actualizar en profiles
    const profileUpdate: Record<string, any> = {
      id: user.id,
      email: updateData.email || user.email,
      ...updateData,
    };
    if (finalPhone !== undefined) {
      profileUpdate.phone = finalPhone;
      profileUpdate.business_phone = finalPhone;
    }
    if (finalEmail !== undefined) {
      profileUpdate.business_email = finalEmail;
    }
    if (finalInstagram !== undefined) {
      profileUpdate.instagram = finalInstagram;
    }
    if (finalAddress !== undefined) {
      profileUpdate.address = finalAddress;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(profileUpdate);

    if (profileError) {
      // Fallback seguro si la tabla profiles aún no tiene las nuevas columnas
      await admin.from("profiles").upsert({
        id: user.id,
        email: updateData.email || user.email,
        ...updateData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
