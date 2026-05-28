import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Star, TrendingUp, Building2, Calendar, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import LifestyleServices from "./LifestyleServices";
import { Button } from "@/components/ui/button";
import PropertyCard, { FeaturedListing } from "@/components/PropertyCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { HOSTEL_CARD_SELECT, mapHostelsToFeaturedListings } from "@/lib/hostelListingCards";

const UserHome = () => {
  const { user } = useAuth();
  const [recommended, setRecommended] = useState<FeaturedListing[]>([]);
  const [stats, setStats] = useState({ activeBookings: 0, savedCount: 0, reviewsCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    const [hostelsRes, bookingsRes, savedRes, reviewsRes] = await Promise.all([
      supabase
        .from("hostels")
        .select(HOSTEL_CARD_SELECT)
        .eq("is_active", true)
        .eq("verified_status", "verified")
        .order("rating", { ascending: false })
        .limit(6),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", user!.id).in("status", ["pending", "approved"]),
      supabase.from("saved_hostels").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
    ]);

    if (hostelsRes.error) toast.error(hostelsRes.error.message);
    if (bookingsRes.error) toast.error(bookingsRes.error.message);
    if (savedRes.error) toast.error(savedRes.error.message);
    if (reviewsRes.error) toast.error(reviewsRes.error.message);

    setRecommended(hostelsRes.data ? mapHostelsToFeaturedListings(hostelsRes.data) : []);
    setStats({
      activeBookings: bookingsRes.count || 0,
      savedCount: savedRes.count || 0,
      reviewsCount: reviewsRes.count || 0,
    });
    setLoading(false);
  };

  const quickStats = [
    { label: "Active Bookings", value: stats.activeBookings, icon: Calendar, color: "text-primary" },
    { label: "Saved Hostels", value: stats.savedCount, icon: TrendingUp, color: "text-accent" },
    { label: "My Reviews", value: stats.reviewsCount, icon: Star, color: "text-verified" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-hero rounded-2xl p-6 md:p-8 text-primary-foreground">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm opacity-80">Welcome back</span>
        </div>
        <h2 className="font-heading font-bold text-2xl mb-1">
          {user?.user_metadata?.full_name || "Explorer"}
        </h2>
        <p className="text-sm opacity-70">Find your perfect stay today</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {quickStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-card rounded-2xl p-4 border border-border/50 shadow-card text-center"
          >
            <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
            <p className="font-heading font-extrabold text-xl">{stat.value}</p>
            <p className="text-muted-foreground text-[11px]">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recommended */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold text-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Recommended for You
          </h3>
          <Link to="/listings">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View All <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : recommended.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">No listings available yet</p>
            <Link to="/listings">
              <Button variant="outline" size="sm" className="mt-3 rounded-xl">Browse Listings</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommended.map((listing, i) => (
              <PropertyCard key={listing.id} listing={listing} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Lifestyle Services */}
      <LifestyleServices />
    </div>
  );
};

export default UserHome;
