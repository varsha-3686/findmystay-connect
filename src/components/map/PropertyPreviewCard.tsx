import { Star, IndianRupee, MapPin, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface PropertyPreviewCardProps {
  hostel: {
    id: string;
    hostel_name: string;
    location: string;
    city: string;
    price_min: number;
    price_max: number;
    rating: number | null;
    review_count: number | null;
    property_type: string;
    verified_status: string;
    gender: string;
    image_url?: string | null;
  };
  onClose: () => void;
}

const PropertyPreviewCard = ({ hostel, onClose }: PropertyPreviewCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-4 left-4 right-4 z-10 max-w-sm mx-auto"
    >
      <div className="bg-card rounded-2xl shadow-[var(--shadow-elevated)] border border-border overflow-hidden">
        {/* Image */}
        {hostel.image_url && (
          <div className="h-32 w-full overflow-hidden">
            <img
              src={hostel.image_url}
              alt={hostel.hostel_name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-heading font-semibold text-sm truncate">{hostel.hostel_name}</h3>
                {hostel.verified_status === "verified" && (
                  <Badge className="bg-verified text-verified-foreground text-[10px] shrink-0">✓ Verified</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs flex items-center gap-1 mb-2">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{hostel.location}, {hostel.city}</span>
              </p>

              <div className="flex items-center gap-3 text-xs mb-3">
                <span className="font-heading font-bold text-primary flex items-center gap-0.5">
                  <IndianRupee className="w-3 h-3" />
                  {hostel.price_min.toLocaleString()}/mo
                </span>
                {hostel.rating && hostel.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-accent text-accent" />
                    {hostel.rating}
                    {hostel.review_count && <span className="text-muted-foreground">({hostel.review_count})</span>}
                  </span>
                )}
                <Badge variant="secondary" className="text-[10px] capitalize">{hostel.property_type}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{hostel.gender}</Badge>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary shrink-0">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <Link to={`/listing/${hostel.id}`}>
            <Button size="sm" className="w-full rounded-xl">View Details</Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default PropertyPreviewCard;
