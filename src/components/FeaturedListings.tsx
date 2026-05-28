import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, Star, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PropertyCard, { FeaturedListing } from "./PropertyCard";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { HOSTEL_CARD_SELECT, mapHostelsToFeaturedListings } from "@/lib/hostelListingCards";

const FeaturedListings = () => {
  const [featured, setFeatured] = useState<FeaturedListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: hostels, error } = await supabase
        .from("hostels")
        .select(HOSTEL_CARD_SELECT)
        .eq("is_active", true)
        .eq("verified_status", "verified")
        .order("rating", { ascending: false })
        .limit(6);

      if (error || !hostels?.length) {
        setFeatured([]);
        setLoading(false);
        return;
      }

      setFeatured(mapHostelsToFeaturedListings(hostels));
      setLoading(false);
    };
    load();
  }, []);

  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-6 rounded-full bg-gradient-primary" />
              <span className="text-primary font-heading font-semibold text-sm uppercase tracking-wider">Featured</span>
            </div>
            <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground">
              Top Verified Properties
            </h2>
            <p className="text-muted-foreground mt-1">Handpicked stays trusted by thousands</p>
          </div>
          <Link to="/listings">
            <Button variant="ghost" className="gap-2 hidden sm:flex">
              View All <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((listing, i) => (
              <PropertyCard key={listing.id} listing={listing} index={i} />
            ))}
          </div>
        )}

        <div className="sm:hidden mt-6 text-center">
          <Link to="/listings">
            <Button variant="outline" className="gap-2 rounded-full">
              View All Properties <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            { icon: Shield, title: "Verified Properties", desc: "Every listing is physically verified by our team" },
            { icon: Star, title: "Genuine Reviews", desc: "Only verified residents can leave reviews" },
            { icon: CheckCircle2, title: "Secure Booking", desc: "Your money is safe until you confirm your stay" },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-4 p-5 rounded-2xl bg-secondary/50 border border-border/50">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm mb-1">{item.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedListings;
