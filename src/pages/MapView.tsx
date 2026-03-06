import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MapDiscovery from "@/components/MapDiscovery";

const MapView = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 lg:pt-24">
        <div className="container mx-auto px-4 lg:px-8 py-6">
          <h1 className="font-heading font-bold text-2xl md:text-3xl mb-2">Discover Nearby</h1>
          <p className="text-muted-foreground text-sm mb-6">Find hostels and PGs on the map</p>
          <MapDiscovery />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MapView;
