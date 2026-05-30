import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
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

export async function resendSignupConfirmation(email: string) {
  return supabase.auth.resend({
    type: "signup",
    email: normalizeEmail(email),
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
}

export function mapPasswordResetError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many requests. Please wait a few minutes and try again.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "This email is already verified. Try signing in instead.";
  }
  if (lower.includes("validate email") || lower.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  return message;
}

export type AuthUrlSessionResult = {
  session: Session | null;
  event: AuthChangeEvent | null;
};

export async function establishSessionFromAuthUrl(
  searchParams: URLSearchParams,
  timeoutMs = 8000
): Promise<AuthUrlSessionResult> {
  const code = searchParams.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      return { session: data.session, event: "SIGNED_IN" };
    }
  }

  const { data: { session: existingSession } } = await supabase.auth.getSession();
  if (existingSession) {
    return { session: existingSession, event: null };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (session: Session | null, event: AuthChangeEvent | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      resolve({ session, event });
    };

    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      finish(session, null);
    }, timeoutMs);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          event === "PASSWORD_RECOVERY" ||
          event === "TOKEN_REFRESHED")
      ) {
        finish(session, event);
        return;
      }
      if (event === "INITIAL_SESSION" && !session) {
        finish(null, event);
      }
    });
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
