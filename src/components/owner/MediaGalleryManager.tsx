import { useState } from "react";
import { Image, Video, Upload, Loader2, X, BadgeCheck, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  url: string;
  uploaded_by: string;
  display_order: number | null;
}

interface MediaGalleryManagerProps {
  hostelId: string;
  images: MediaItem[];
  videos: MediaItem[];
  onRefresh: () => void;
}

const MAX_PHOTOS = 10;
const MAX_VIDEOS = 3;
const MAX_VIDEO_SIZE_MB = 100;
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
const ACCEPTED_VIDEO_TYPES = "video/mp4,video/quicktime";

const MediaGalleryManager = ({ hostelId, images, videos, onRefresh }: MediaGalleryManagerProps) => {
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingVideos, setUploadingVideos] = useState(false);

  const handleUploadPhotos = async (files: FileList) => {
    const remaining = MAX_PHOTOS - images.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploadingPhotos(true);
    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const filePath = `${hostelId}/${Date.now()}-${i}.${file.name.split('.').pop()}`;
        const { error: uploadErr } = await supabase.storage.from("hostel-images").upload(filePath, file);
        if (!uploadErr) {
          const { data: publicUrl } = supabase.storage.from("hostel-images").getPublicUrl(filePath);
          await supabase.from("hostel_images").insert({
            hostel_id: hostelId,
            image_url: publicUrl.publicUrl,
            display_order: images.length + i,
            uploaded_by: "owner",
          });
        }
      }
      toast.success("Photos uploaded");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
    setUploadingPhotos(false);
  };

  const handleUploadVideos = async (files: FileList) => {
    const remaining = MAX_VIDEOS - videos.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_VIDEOS} videos allowed`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);

    for (const file of toUpload) {
      if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${MAX_VIDEO_SIZE_MB}MB limit`);
        return;
      }
    }

    setUploadingVideos(true);
    try {
      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const filePath = `${hostelId}/${Date.now()}-${i}.${file.name.split('.').pop()}`;
        const { error: uploadErr } = await supabase.storage.from("hostel-videos").upload(filePath, file);
        if (!uploadErr) {
          const { data: publicUrl } = supabase.storage.from("hostel-videos").getPublicUrl(filePath);
          await (supabase.from("hostel_videos") as any).insert({
            hostel_id: hostelId,
            video_url: publicUrl.publicUrl,
            display_order: videos.length + i,
            uploaded_by: "owner",
          });
        }
      }
      toast.success("Videos uploaded");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
    setUploadingVideos(false);
  };

  const handleDeletePhoto = async (imageId: string) => {
    await supabase.from("hostel_images").delete().eq("id", imageId);
    toast.success("Photo removed");
    onRefresh();
  };

  const handleDeleteVideo = async (videoId: string) => {
    await (supabase.from("hostel_videos") as any).delete().eq("id", videoId);
    toast.success("Video removed");
    onRefresh();
  };

  const uploadedByBadge = (by: string) => (
    <Badge variant="secondary" className="text-[9px] gap-1 absolute bottom-1 left-1">
      {by === "admin_pr_team" ? <><BadgeCheck className="w-2.5 h-2.5 text-accent" /> Verified</> : "Owner"}
    </Badge>
  );

  return (
    <div>
      <h4 className="font-heading font-semibold text-xs flex items-center gap-1.5 mb-3">
        <Film className="w-3.5 h-3.5 text-primary" /> Media Gallery
      </h4>
      <Tabs defaultValue="photos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-8 rounded-xl">
          <TabsTrigger value="photos" className="text-xs gap-1 rounded-lg">
            <Image className="w-3 h-3" /> Photos ({images.length}/{MAX_PHOTOS})
          </TabsTrigger>
          <TabsTrigger value="videos" className="text-xs gap-1 rounded-lg">
            <Video className="w-3 h-3" /> Videos ({videos.length}/{MAX_VIDEOS})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map(img => (
              <div key={img.id} className="relative shrink-0 w-24 h-20 rounded-xl overflow-hidden border border-border group">
                <img src={img.url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => handleDeletePhoto(img.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
                {uploadedByBadge(img.uploaded_by)}
              </div>
            ))}
            {images.length < MAX_PHOTOS && (
              <label className="shrink-0 w-24 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                {uploadingPhotos ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : (
                  <>
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground mt-0.5">JPG, PNG, WEBP</span>
                  </>
                )}
                <input type="file" accept={ACCEPTED_IMAGE_TYPES} multiple className="hidden" onChange={e => e.target.files && handleUploadPhotos(e.target.files)} />
              </label>
            )}
          </div>
        </TabsContent>

        <TabsContent value="videos" className="mt-3">
          <div className="space-y-2">
            {videos.map(vid => (
              <div key={vid.id} className="relative rounded-xl overflow-hidden border border-border group">
                <video src={vid.url} controls className="w-full max-h-40 bg-foreground/5 rounded-xl" />
                <button
                  onClick={() => handleDeleteVideo(vid.id)}
                  className="absolute top-2 right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
                <Badge variant="secondary" className="text-[9px] gap-1 absolute bottom-2 left-2">
                  {vid.uploaded_by === "admin_pr_team" ? <><BadgeCheck className="w-2.5 h-2.5 text-accent" /> Verified</> : "Owner"}
                </Badge>
              </div>
            ))}
            {videos.length < MAX_VIDEOS && (
              <label className="flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors">
                {uploadingVideos ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : (
                  <>
                    <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">MP4, MOV · Max 100MB · Up to 60s</span>
                  </>
                )}
                <input type="file" accept={ACCEPTED_VIDEO_TYPES} multiple className="hidden" onChange={e => e.target.files && handleUploadVideos(e.target.files)} />
              </label>
            )}
            {videos.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Suggested: Room walkthrough, Bathroom, Dining area, Exterior, Amenities
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MediaGalleryManager;
