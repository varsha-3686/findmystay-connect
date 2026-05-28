import { supabase } from "@/integrations/supabase/client";

export type RegistrationRole = "user" | "owner";

export type CompleteRegistrationResult = {
  success: boolean;
  role?: string;
  welcome_email_sent?: boolean;
  error?: string;
};

export async function invokeCompleteRegistration(
  selectedRole: RegistrationRole,
  profileData: Record<string, unknown>
) {
  const maxAttempts = 2;
  const {
    data: { session },
  } = await supabase.auth.getSession();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await supabase.functions.invoke("complete-registration", {
      body: {
        selected_role: selectedRole,
        profile_data: profileData,
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    if (!result.error && !result.data?.error) {
      return result;
    }

    const isNetworkError = /failed to send a request/i.test(result.error?.message ?? "");
    if (!isNetworkError || attempt === maxAttempts) {
      return result;
    }

    await new Promise((r) => setTimeout(r, 700));
  }

  return { data: null, error: new Error("Registration failed.") };
}

export function getPendingRoleFromMetadata(
  metadata: Record<string, unknown> | undefined
): RegistrationRole | null {
  const role = metadata?.pending_role;
  if (role === "owner" || role === "user") return role;
  return null;
}
