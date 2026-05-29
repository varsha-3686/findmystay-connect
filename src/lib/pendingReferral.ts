import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const PENDING_REFERRAL_STORAGE_KEY = "staynest_pending_referral";

/** Persist ?ref= or ?coupon= for use after signup completes. */
export function stashReferralCodeFromUrl(ref: string | null, coupon: string | null) {
  const code = (coupon || ref || "").trim();
  if (code) {
    sessionStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, code);
  }
}

export function getPendingReferralCode(): string {
  return sessionStorage.getItem(PENDING_REFERRAL_STORAGE_KEY)?.trim() || "";
}

export function setPendingReferralCode(code: string) {
  const trimmed = code.trim();
  if (trimmed) {
    sessionStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, trimmed);
  } else {
    sessionStorage.removeItem(PENDING_REFERRAL_STORAGE_KEY);
  }
}

/** Call once after session exists; idempotent on server for already-redeemed users. */
export async function applyPendingReferralCode(): Promise<void> {
  const code = getPendingReferralCode();
  if (!code) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  const { data, error } = await supabase.functions.invoke("apply-referral-code", {
    body: { referral_code: code },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    const msg = error.message || "Could not apply referral code";
    if (!/invalid referral/i.test(msg)) {
      toast.error(msg);
    }
    console.warn("apply-referral-code", error);
    return;
  }

  const payload = data as { error?: string; already_redeemed?: boolean; success?: boolean };

  if (payload?.error) {
    if (!/invalid referral/i.test(payload.error)) {
      toast.error(payload.error);
    }
    return;
  }

  sessionStorage.removeItem(PENDING_REFERRAL_STORAGE_KEY);

  if (payload?.already_redeemed) return;
  if (payload?.success) {
    toast.success("Referral linked! Your referrer earns ₹100 when you check in to your hostel.");
  }
}
