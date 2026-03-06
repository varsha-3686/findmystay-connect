import { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, Star, Navigation, Search, Loader2, X, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

interface MapHostel {
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
}

// Default center (Bangalore)
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

const MapDiscovery = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [hostels, setHostels] = useState<MapHostel[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<MapHostel | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setLoading(false);
      return;
    }

    if ((window as any).google?.maps) {
      setMapLoaded(true);
      setLoading(false);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setMapLoaded(true);
      setLoading(false);
    };
    script.onerror = () => setLoading(false);
    document.head.appendChild(script);

    return () => {
      // Don't remove script to avoid re-loading
    };
  }, []);

  // Fetch hostels with coordinates
  useEffect(() => {
    const fetchHostels = async () => {
      const { data } = await supabase
        .from("hostels")
        .select("id, hostel_name, location, city, price_min, price_max, rating, review_count, latitude, longitude, property_type, verified_status, media_verification_badge")
        .eq("is_active", true)
        .eq("verified_status", "verified")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (data) setHostels(data as MapHostel[]);
    };
    fetchHostels();
  }, []);

  // Get user location
  const getUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          googleMapRef.current?.panTo(loc);
          googleMapRef.current?.setZoom(14);
        },
        () => {/* permission denied */}
      );
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || googleMapRef.current) return;

    const gm = (window as any).google.maps;
    const map = new gm.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      mapId: "staynest-map",
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
      ],
    });

    googleMapRef.current = map;
  }, [mapLoaded]);

  // Add markers
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded || !hostels.length) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.map = null);
    markersRef.current = [];

    const filtered = searchQuery
      ? hostels.filter(h =>
          h.hostel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.location.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : hostels;

    filtered.forEach((hostel) => {
      if (!hostel.latitude || !hostel.longitude) return;

      const priceTag = document.createElement("div");
      priceTag.className = "map-price-marker";
      priceTag.innerHTML = `<span style="
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        cursor: pointer;
        display: inline-block;
      ">₹${hostel.price_min.toLocaleString()}</span>`;

      const gm2 = (window as any).google.maps;
      const marker = new gm2.marker.AdvancedMarkerElement({
        map: googleMapRef.current!,
        position: { lat: hostel.latitude, lng: hostel.longitude },
        content: priceTag,
        title: hostel.hostel_name,
      });

      marker.addListener("click", () => {
        setSelectedHostel(hostel);
        googleMapRef.current?.panTo({ lat: hostel.latitude!, lng: hostel.longitude! });
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if multiple markers
    if (filtered.length > 1) {
      const bounds = new (window as any).google.maps.LatLngBounds();
      filtered.forEach(h => {
        if (h.latitude && h.longitude) bounds.extend({ lat: h.latitude, lng: h.longitude });
      });
      googleMapRef.current?.fitBounds(bounds, 60);
    }
  }, [hostels, mapLoaded, searchQuery]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-8 text-center">
        <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-heading font-semibold text-lg mb-2">Map View Coming Soon</h3>
        <p className="text-muted-foreground text-sm">Google Maps integration requires an API key to be configured.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[70vh] rounded-2xl overflow-hidden border border-border/50">
      {/* Search overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by area, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-card/95 backdrop-blur-sm shadow-lg border-border/50"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl bg-card/95 backdrop-blur-sm shadow-lg"
          onClick={getUserLocation}
        >
          <Navigation className="w-4 h-4" />
        </Button>
      </div>

      {/* Map container */}
      <div ref={mapRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Selected hostel preview */}
      <AnimatePresence>
        {selectedHostel && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-4 right-4 z-10"
          >
            <Link to={`/listing/${selectedHostel.id}`}>
              <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-4 flex gap-4 hover:shadow-card-hover transition-all max-w-md mx-auto">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-heading font-semibold text-sm truncate">{selectedHostel.hostel_name}</h3>
                    {selectedHostel.verified_status === "verified" && (
                      <Badge className="bg-verified text-verified-foreground text-[10px] shrink-0">✓</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs mb-2 truncate">{selectedHostel.location}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-heading font-bold text-primary flex items-center gap-0.5">
                      <IndianRupee className="w-3 h-3" />
                      {selectedHostel.price_min.toLocaleString()}/mo
                    </span>
                    {selectedHostel.rating && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-verified text-verified" />
                        {selectedHostel.rating}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-[10px] capitalize">{selectedHostel.property_type}</Badge>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); setSelectedHostel(null); }}
                  className="self-start p-1 rounded-lg hover:bg-secondary"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapDiscovery;
