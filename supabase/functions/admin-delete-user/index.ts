import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });

    const { userId } = await req.json();
    if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: corsHeaders });

    const fail = (error: string, status = 403) =>
      new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // A user must never delete their own account here (covers a super admin deleting themselves).
    if (userId === caller.id) return fail('لا يمكنك حذف حسابك الخاص');

    // Inspect the target: is it a super admin, and does it hold the admin role?
    const [{ data: targetProfile }, { data: targetRoles }] = await Promise.all([
      supabaseAdmin.from('profiles').select('is_super_admin, phone').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('user_roles').select('role').eq('user_id', userId),
    ]);

    // No one can delete a super admin (each super admin can only ever remove their own super-admin
    // flag first — and even then self-deletion is blocked above).
    if (targetProfile?.is_super_admin) return fail('لا يمكن حذف حساب سوبر أدمن');

    // Deleting an admin is reserved for super admins.
    const targetIsAdmin = (targetRoles || []).some((r: { role: string }) => r.role === 'admin');
    if (targetIsAdmin) {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles').select('is_super_admin').eq('user_id', caller.id).maybeSingle();
      if (!callerProfile?.is_super_admin) return fail('فقط السوبر أدمن يمكنه حذف حساب أدمن');
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

    // Cascade (ON DELETE CASCADE) already removed every user-id-owned row (profile, orders,
    // designs, vault, addresses, device_tokens, reseller data). The phone-keyed OTP tables are
    // not reached by the cascade — purge them too so no trace of the customer remains.
    // Best-effort: the account is already gone, so a cleanup error must not fail the request.
    const targetPhone = targetProfile?.phone;
    if (targetPhone) {
      const [otpDel, throttleDel, attemptsDel] = await Promise.all([
        supabaseAdmin.from('otp_codes').delete().eq('phone', targetPhone),
        supabaseAdmin.from('phone_throttle').delete().eq('phone', targetPhone),
        supabaseAdmin.from('otp_attempts').delete().eq('phone', targetPhone),
      ]);
      if (otpDel.error) console.error('otp_codes cleanup failed:', otpDel.error.message);
      if (throttleDel.error) console.error('phone_throttle cleanup failed:', throttleDel.error.message);
      if (attemptsDel.error) console.error('otp_attempts cleanup failed:', attemptsDel.error.message);
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
