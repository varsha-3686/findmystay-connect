import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmailInput, normalizeEmail } from "@/lib/otpAuth";

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

export function hasEmailPasswordIdentity(user: User | null | undefined): boolean {
  if (!user) return false;
  const providers = user.app_metadata?.providers as string[] | undefined;
  if (Array.isArray(providers) && providers.includes("email")) return true;
  if (user.identities?.some((identity) => identity.provider === "email")) return true;
  return Boolean(user.email);
}

export function mapEmailChangeError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("reauthentication") || lower.includes("reauth")) {
    return "Please enter your current password to change your email.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "That email is already in use. Try a different address.";
  }
  if (lower.includes("validate email") || lower.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  if (lower.includes("same") && lower.includes("email")) {
    return "That is already your email address.";
  }
  return message;
}

export type EmailChangeResult = { ok: true } | { ok: false; message: string };

export async function requestEmailChange(
  newEmail: string,
  options?: { currentPassword?: string; currentAuthEmail?: string }
): Promise<EmailChangeResult> {
  const normalized = normalizeEmail(newEmail);
  if (!isValidEmailInput(normalized)) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  if (options?.currentPassword) {
    const authEmail = options.currentAuthEmail?.trim();
    if (!authEmail) {
      return { ok: false, message: "Unable to verify your account. Please sign in again." };
    }
    const { error: signInError } = await signInWithEmailPassword(authEmail, options.currentPassword);
    if (signInError) {
      return { ok: false, message: mapEmailChangeError(signInError.message) };
    }
  }

  const { error } = await supabase.auth.updateUser(
    { email: normalized },
    { emailRedirectTo: getAuthRedirectUrl() }
  );

  if (error) {
    return { ok: false, message: mapEmailChangeError(error.message) };
  }

  return { ok: true };
}
