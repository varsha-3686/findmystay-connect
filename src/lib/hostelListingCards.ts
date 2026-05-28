import type { FeaturedListing } from "@/components/PropertyCard";

export const LISTING_IMAGE_PLACEHOLDER =
  "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600&q=80";

export const HOSTEL_CARD_SELECT = `
  id,
  hostel_name,
  location,
  city,
  price_min,
  rating,
  review_count,
  property_type,
  gender,
  verified_status,
  media_verification_badge,
  owner_public_name,
  hostel_images(image_url, display_order),
  facilities(wifi, ac, food, laundry, gym, parking, pool, power_backup, cctv, geyser, washing_machine, housekeeping, common_kitchen, study_room)
`;

const FACILITY_LABELS: Record<string, string> = {
  wifi: "WiFi",
  ac: "AC",
  food: "Food",
  laundry: "Laundry",
  gym: "Gym",
  parking: "Parking",
  pool: "Pool",
  power_backup: "Power Backup",
  cctv: "CCTV",
  geyser: "Geyser",
  washing_machine: "Washing Machine",
  housekeeping: "Housekeeping",
  common_kitchen: "Common Kitchen",
  study_room: "Study Room",
};

function facilitiesToAmenities(f: Record<string, unknown> | null): string[] {
  if (!f) return [];
  const out: string[] = [];
  Object.entries(f).forEach(([key, val]) => {
    if (val === true && FACILITY_LABELS[key]) out.push(FACILITY_LABELS[key]);
  });
  return out;
}

export function mapHostelsToFeaturedListings(hostels: unknown[]): FeaturedListing[] {
  return hostels.map((row) => {
    const h = row as {
      id: string;
      hostel_name: string;
      location: string;
      city: string;
      price_min: number | null;
      rating: number | null;
      property_type?: string;
      gender?: string;
      verified_status?: string;
      media_verification_badge?: string | null;
      owner_public_name?: string | null;
      hostel_images?: { image_url: string; display_order?: number | null }[];
      facilities?: Record<string, unknown> | Record<string, unknown>[] | null;
    };

    const imgs = (h.hostel_images || []).sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
    );
    const imageUrl = imgs[0]?.image_url || LISTING_IMAGE_PLACEHOLDER;
    const fac = Array.isArray(h.facilities) ? h.facilities[0] : h.facilities;

    return {
      id: h.id,
      title: h.hostel_name,
      location: `${h.location}, ${h.city}`,
      image: imageUrl,
      rating: typeof h.rating === "number" ? h.rating : 0,
      verified: h.verified_status === "verified",
      type: h.property_type || "hostel",
      gender: h.gender || "others",
      price: h.price_min ?? 0,
      amenities: facilitiesToAmenities((fac as Record<string, unknown>) || null),
      mediaVerificationBadge: h.media_verification_badge,
      ownerPublicName: h.owner_public_name,
    };
  });
}
