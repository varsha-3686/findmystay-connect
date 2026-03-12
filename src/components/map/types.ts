export interface MapHostel {
  id: string;
  hostel_name: string;
  location: string;
  city: string;
  price_min: number;
  price_max: number;
  rating: number | null;
  review_count: number | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string;
  verified_status: string;
  media_verification_badge: string | null;
  gender: string;
  image_url?: string | null;
}
