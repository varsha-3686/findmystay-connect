import { useState } from "react";
import { ChevronLeft, ChevronRight, X, BadgeCheck, Image, Video, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";

interface MediaItem {
  id: string;
  url: string;
  uploaded_by: string;
  type: "photo" | "video";
}

interface PropertyMediaGalleryProps {
  photos: MediaItem[];
  videos: MediaItem[];
  title: string;
}

const PropertyMediaGallery = ({ photos, videos, title }: PropertyMediaGalleryProps) => {
  const [activePhoto, setActivePhoto] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenType, setFullscreenType] = useState<"photo" | "video">("photo");
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);

  const nextPhoto = () => setActivePhoto(p => (p + 1) % photos.length);
  const prevPhoto = () => setActivePhoto(p => (p - 1 + photos.length) % photos.length);

  const openFullscreen = (type: "photo" | "video", idx: number) => {
    setFullscreenType(type);
    if (type === "photo") setActivePhoto(idx);
    else setActiveVideoIdx(idx);
    setFullscreen(true);
  };

  const verifiedBadge = (by: string) => (
    <Badge className={`gap-1 text-[10px] ${by === "admin_pr_team" ? "bg-accent/10 text-accent" : "bg-secondary text-secondary-foreground"}`}>
      {by === "admin_pr_team" ? <><BadgeCheck className="w-3 h-3" /> Verified Media by Platform Team</> : "Owner Uploaded Media"}
    </Badge>
  );

  return (
    <>
      {/* Fullscreen Overlay */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-foreground/95 flex items-center justify-center"
          >
            <button onClick={() => setFullscreen(false)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center text-primary-foreground hover:bg-primary-foreground/20 z-10">
              <X className="w-5 h-5" />
            </button>

            {fullscreenType === "photo" && photos.length > 0 && (
              <>
                <button onClick={prevPhoto} className="absolute left-6 w-12 h-12 rounded-full bg-primary-foreground/10 flex items-center justify-center text-primary-foreground hover:bg-primary-foreground/20">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <img src={photos[activePhoto]?.url} alt={title} className="max-w-[85vw] max-h-[85vh] object-contain rounded-2xl" />
                <button onClick={nextPhoto} className="absolute right-6 w-12 h-12 rounded-full bg-primary-foreground/10 flex items-center justify-center text-primary-foreground hover:bg-primary-foreground/20">
                  <ChevronRight className="w-6 h-6" />
                </button>
                <div className="absolute bottom-6 flex gap-2">
                  {photos.map((_, i) => (
                    <button key={i} onClick={() => setActivePhoto(i)} className={`w-2.5 h-2.5 rounded-full transition-all ${activePhoto === i ? "bg-primary-foreground scale-125" : "bg-primary-foreground/30"}`} />
                  ))}
                </div>
              </>
            )}

            {fullscreenType === "video" && videos.length > 0 && (
              <video src={videos[activeVideoIdx]?.url} controls autoPlay className="max-w-[90vw] max-h-[85vh] rounded-2xl" />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery Section */}
      <div className="space-y-4">
        <h2 className="font-heading font-semibold text-lg">Property Media</h2>

        <Tabs defaultValue="photos" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="photos" className="gap-1.5 rounded-lg">
              <Image className="w-4 h-4" /> Photos ({photos.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1.5 rounded-lg">
              <Video className="w-4 h-4" /> Videos ({videos.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="mt-4">
            {photos.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-2xl overflow-hidden">
                  <button onClick={() => openFullscreen("photo", 0)} className="md:col-span-2 md:row-span-2 aspect-[16/10] md:aspect-auto relative group overflow-hidden">
                    <img src={photos[0].url} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute bottom-2 left-2">{verifiedBadge(photos[0].uploaded_by)}</div>
                  </button>
                  {photos.slice(1, 3).map((p, i) => (
                    <button key={p.id} onClick={() => openFullscreen("photo", i + 1)} className="hidden md:block aspect-[4/3] relative group overflow-hidden">
                      <img src={p.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </button>
                  ))}
                </div>
                <div className="flex md:hidden gap-2 mt-3 overflow-x-auto pb-1">
                  {photos.map((p, i) => (
                    <button key={p.id} onClick={() => openFullscreen("photo", i)} className={`shrink-0 w-20 h-16 rounded-xl overflow-hidden border-2 ${activePhoto === i ? "border-primary" : "border-transparent"}`}>
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No photos available</p>
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-4">
            {videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {videos.map((v, i) => (
                  <div key={v.id} className="relative rounded-xl overflow-hidden border border-border group cursor-pointer" onClick={() => openFullscreen("video", i)}>
                    <video src={v.url} className="w-full aspect-video object-cover bg-foreground/5" preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-foreground/20 group-hover:bg-foreground/30 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-primary-foreground/80 flex items-center justify-center">
                        <Play className="w-5 h-5 text-foreground fill-foreground ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2">{verifiedBadge(v.uploaded_by)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No videos available</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default PropertyMediaGallery;
