import { supabase } from "@/integrations/supabase/client";
import { normalizeEmail } from "@/lib/otpAuth";

export const MIN_PASSWORD_LENGTH = 8;

export function getAuthRedirectUrl(type?: "recovery"): string {
  const base = `${window.location.origin}/auth/callback`;
  return type === "recovery" ? `${base}?type=recovery` : base;
}

export function validatePassword(password: string): string | null {
  if (!password.trim()) return "Please enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function validatePasswordMatch(password: string, confirm: string): string | null {
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

export async function signInWithEmailPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password: password.trim(),
  });
}

export type PendingSignupRole = "user" | "owner";

export async function signUpWithEmailPassword(options: {
  email: string;
  password: string;
  fullName: string;
  pendingRole: PendingSignupRole;
}) {
  return supabase.auth.signUp({
    email: normalizeEmail(options.email),
    password: options.password.trim(),
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        full_name: options.fullName.trim(),
        pending_role: options.pendingRole,
      },
    },
  });
}

export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: getAuthRedirectUrl("recovery"),
  });
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword.trim() });
}
