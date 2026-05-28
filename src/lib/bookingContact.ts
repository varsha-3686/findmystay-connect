import { supabase } from "@/integrations/supabase/client";

export interface BookingContactFields {
  fullName: string;
  phone: string;
  email: string;
  address: string;
}

export async function fetchOwnProfileContact(userId: string): Promise<BookingContactFields> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, email")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    fullName: data?.full_name?.trim() || "",
    phone: data?.phone?.trim() || "",
    email: data?.email?.trim() || "",
    address: "",
  };
}

export async function syncProfileFromBookingIfEmpty(
  userId: string,
  contact: Pick<BookingContactFields, "fullName" | "phone">
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) return;

  const updates: { full_name?: string; phone?: string } = {};
  if (!profile.full_name?.trim() && contact.fullName.trim()) {
    updates.full_name = contact.fullName.trim();
  }
  if (!profile.phone?.trim() && contact.phone.trim()) {
    updates.phone = contact.phone.trim();
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from("profiles").update(updates).eq("user_id", userId);
  }
}
