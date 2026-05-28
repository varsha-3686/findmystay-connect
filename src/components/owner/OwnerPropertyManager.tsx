import { useState, useEffect } from "react";
import {
  Building2, Bed, Loader2, Plus, Trash2, Save, Edit2, X,
  ChevronLeft, ChevronRight, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import MediaGalleryManager from "./MediaGalleryManager";

const ROOM_TYPE_OPTIONS = ["single", "double", "triple", "4-sharing", "6-sharing"] as const;

const ROOM_TYPE_LABELS: Record<string, string> = {
  single: "Single",
  double: "Double",
  triple: "Triple",
  "4-sharing": "4-sharing",
  "6-sharing": "6-sharing",
};

interface MediaItem {
  id: string;
  url: string;
  uploaded_by: string;
  display_order: number | null;
}

interface RoomTypeRow {
  id: string;
  type: string;
  price: number;
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
}

interface HostelWithRooms {
  id: string;
  hostel_name: string;
  location: string;
  city: string;
  price_min: number;
  price_max: number;
  verified_status: string;
  is_active: boolean;
  room_types: RoomTypeRow[];
  images: MediaItem[];
  videos: MediaItem[];
  facilities: Record<string, boolean> | null;
}

interface AddRoomForm {
  type: string;
  price: string;
  total_beds: string;
  occupied_beds: string;
}

const defaultAddRoomForm = (): AddRoomForm => ({
  type: "single",
  price: "",
  total_beds: "1",
  occupied_beds: "0",
});

function formatRoomType(type: string) {
  return ROOM_TYPE_LABELS[type] || type;
}

function parseRoomError(error: { message?: string; code?: string } | null): string {
  if (!error?.message) return "Something went wrong. Please try again.";
  if (error.code === "23505" || /unique|duplicate/i.test(error.message)) {
    return "This room type already exists for this property. Edit the existing one instead.";
  }
  if (/occupied_le_total|check constraint/i.test(error.message)) {
    return "Occupied beds must be between 0 and total beds.";
  }
  return error.message;
}

function validateRoomFields(total: number, occupied: number, price: number): string | null {
  if (total <= 0) return "Total beds must be at least 1.";
  if (occupied < 0 || occupied > total) return "Occupied beds must be between 0 and total beds.";
  if (price < 0 || Number.isNaN(price)) return "Enter a valid monthly price.";
  return null;
}

const OwnerPropertyManager = () => {
  const { user } = useAuth();
  const [hostels, setHostels] = useState<HostelWithRooms[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState<Record<string, AddRoomForm & { originalType: string }>>({});
  const [previewIndex, setPreviewIndex] = useState<Record<string, number>>({});
  const [addRoomHostelId, setAddRoomHostelId] = useState<string | null>(null);
  const [addRoomForm, setAddRoomForm] = useState<AddRoomForm>(defaultAddRoomForm());
  const [deleteTarget, setDeleteTarget] = useState<{ roomId: string; hostelId: string; type: string } | null>(null);
  const [catalogToggling, setCatalogToggling] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchHostels();
  }, [user]);

  const fetchHostels = async () => {
    const { data } = await supabase
      .from("hostels")
      .select("id, hostel_name, location, city, price_min, price_max, verified_status, is_active")
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false });

    if (data) {
      const enriched: HostelWithRooms[] = [];
      for (const h of data) {
        const [roomsRes, imagesRes, videosRes, facilitiesRes] = await Promise.all([
          supabase.from("room_types").select("*").eq("property_id", h.id).order("type"),
          supabase.from("hostel_images").select("*").eq("hostel_id", h.id).order("display_order"),
          supabase.from("hostel_videos").select("*").eq("hostel_id", h.id).order("display_order"),
          supabase.from("facilities").select("*").eq("hostel_id", h.id).maybeSingle(),
        ]);
        const images = (imagesRes.data || []).map((img) => ({
          id: img.id,
          url: img.image_url,
          uploaded_by: img.uploaded_by || "owner",
          display_order: img.display_order,
        }));
        const videos = (videosRes.data || []).map((vid) => ({
          id: vid.id,
          url: vid.video_url,
          uploaded_by: vid.uploaded_by || "owner",
          display_order: vid.display_order,
        }));
        const facilityData = facilitiesRes.data;
        const facilityFlags = facilityData
          ? Object.fromEntries(
              Object.entries(facilityData).filter(([k]) => !["id", "hostel_id", "created_at"].includes(k))
            ) as Record<string, boolean>
          : null;
        enriched.push({ ...h, room_types: roomsRes.data || [], images, videos, facilities: facilityFlags });
      }
      setHostels(enriched);
    }
    setLoading(false);
  };

  const syncHostelPriceRange = async (hostelId: string) => {
    const { data: rooms, error } = await supabase
      .from("room_types")
      .select("price")
      .eq("property_id", hostelId);

    if (error || !rooms?.length) return;

    const prices = rooms.map((r) => Number(r.price));
    await supabase.from("hostels").update({
      price_min: Math.min(...prices),
      price_max: Math.max(...prices),
    }).eq("id", hostelId);
  };

  const openAddRoomDialog = (hostelId: string, existingTypes: string[]) => {
    const firstAvailable = ROOM_TYPE_OPTIONS.find((t) => !existingTypes.includes(t)) || "single";
    setAddRoomForm({ ...defaultAddRoomForm(), type: firstAvailable });
    setAddRoomHostelId(hostelId);
  };

  const handleAddRoomSubmit = async () => {
    if (!addRoomHostelId) return;
    const total = parseInt(addRoomForm.total_beds, 10) || 0;
    const occupied = parseInt(addRoomForm.occupied_beds, 10) || 0;
    const price = parseInt(addRoomForm.price, 10);
    const validationError = validateRoomFields(total, occupied, price);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!addRoomForm.price.trim()) {
      toast.error("Enter a monthly price.");
      return;
    }

    setSaving(addRoomHostelId);
    const { error } = await supabase.from("room_types").insert({
      property_id: addRoomHostelId,
      type: addRoomForm.type,
      price,
      total_beds: total,
      occupied_beds: occupied,
      available_beds: total - occupied,
    });

    if (error) {
      toast.error(parseRoomError(error));
      setSaving(null);
      return;
    }

    await syncHostelPriceRange(addRoomHostelId);
    toast.success(`${formatRoomType(addRoomForm.type)} room added`);
    setAddRoomHostelId(null);
    setAddRoomForm(defaultAddRoomForm());
    await fetchHostels();
    setSaving(null);
  };

  const handleUpdateRoom = async (roomId: string, hostelId: string, updates: {
    type: string;
    price: number;
    total_beds: number;
    occupied_beds: number;
    available_beds: number;
  }) => {
    setSaving(roomId);
    const { error } = await supabase.from("room_types").update(updates).eq("id", roomId);
    if (error) {
      toast.error(parseRoomError(error));
      setSaving(null);
      return;
    }
    await syncHostelPriceRange(hostelId);
    toast.success("Room updated");
    setEditRoom((prev) => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    await fetchHostels();
    setSaving(null);
  };

  const handleDeleteRoomConfirm = async () => {
    if (!deleteTarget) return;
    setSaving(deleteTarget.roomId);
    const { error } = await supabase.from("room_types").delete().eq("id", deleteTarget.roomId);
    if (error) {
      toast.error(parseRoomError(error));
      setSaving(null);
      setDeleteTarget(null);
      return;
    }
    await syncHostelPriceRange(deleteTarget.hostelId);
    toast.success(`${formatRoomType(deleteTarget.type)} room removed`);
    setDeleteTarget(null);
    await fetchHostels();
    setSaving(null);
  };

  const handleCatalogToggle = async (hostelId: string, isActive: boolean) => {
    setCatalogToggling(hostelId);
    const { error } = await supabase.from("hostels").update({ is_active: isActive }).eq("id", hostelId);
    if (error) {
      toast.error(error.message || "Could not update catalog visibility.");
      setCatalogToggling(null);
      return;
    }
    toast.success(isActive ? "Property will show in catalog when approved." : "Property hidden from public catalog.");
    await fetchHostels();
    setCatalogToggling(null);
  };

  const saveEditRoom = (roomId: string, hostelId: string) => {
    const draft = editRoom[roomId];
    if (!draft) return;
    const total = parseInt(draft.total_beds, 10) || 0;
    const occupied = parseInt(draft.occupied_beds, 10) || 0;
    const price = parseInt(draft.price, 10);
    const validationError = validateRoomFields(total, occupied, price);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    handleUpdateRoom(roomId, hostelId, {
      type: draft.type,
      price,
      total_beds: total,
      occupied_beds: occupied,
      available_beds: total - occupied,
    });
  };

  const addRoomHostel = hostels.find((h) => h.id === addRoomHostelId);
  const usedTypesForAdd = addRoomHostel?.room_types.map((r) => r.type) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (hostels.length === 0) {
    return (
      <div className="text-center py-20 bg-card rounded-2xl border border-border/50">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-primary" />
        </div>
        <h3 className="font-heading font-bold text-xl mb-2">Add Your First Property</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
          Get started by adding your hostel or PG. Once submitted, our admin team will review and approve it.
          After approval, your property will be visible to thousands of users.
        </p>
        <p className="text-xs text-muted-foreground">
          Click the <strong>&quot;+ Add Property&quot;</strong> button in the top-right corner to begin.
        </p>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      verified: "bg-accent/10 text-accent",
      pending: "bg-warning/10 text-warning",
      under_review: "bg-verified/10 text-verified",
      rejected: "bg-destructive/10 text-destructive",
    };
    const labels: Record<string, string> = {
      pending: "Pending Approval",
      verified: "Approved",
      rejected: "Rejected",
      under_review: "Under Review",
    };
    return <Badge className={styles[status] || styles.pending}>{labels[status] || status.replace(/_/g, " ")}</Badge>;
  };

  const catalogHelperText = (hostel: HostelWithRooms) => {
    if (!hostel.is_active) return "Hidden from public search. Your property data is kept.";
    if (hostel.verified_status === "verified") return "Live on the public catalog.";
    return "Visible once admin approves your property.";
  };

  const featureLabel = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">
      <Dialog open={!!addRoomHostelId} onOpenChange={(open) => !open && setAddRoomHostelId(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Add room type</DialogTitle>
          </DialogHeader>
          {addRoomHostel && (
            <p className="text-sm text-muted-foreground -mt-2">
              For <strong>{addRoomHostel.hostel_name}</strong>
            </p>
          )}
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Room type</Label>
              <Select value={addRoomForm.type} onValueChange={(v) => setAddRoomForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROOM_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t} disabled={usedTypesForAdd.includes(t)}>
                      {formatRoomType(t)}{usedTypesForAdd.includes(t) ? " (already added)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Monthly price (₹)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 8000"
                className="rounded-xl"
                value={addRoomForm.price}
                onChange={(e) => setAddRoomForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Total beds</Label>
                <Input
                  type="number"
                  min={1}
                  className="rounded-xl"
                  value={addRoomForm.total_beds}
                  onChange={(e) => setAddRoomForm((f) => ({ ...f, total_beds: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Occupied beds</Label>
                <Input
                  type="number"
                  min={0}
                  className="rounded-xl"
                  value={addRoomForm.occupied_beds}
                  onChange={(e) => setAddRoomForm((f) => ({ ...f, occupied_beds: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Available: {Math.max(parseInt(addRoomForm.total_beds || "0", 10) - parseInt(addRoomForm.occupied_beds || "0", 10), 0)} beds
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={() => setAddRoomHostelId(null)}>Cancel</Button>
            <Button
              className="rounded-xl"
              onClick={handleAddRoomSubmit}
              disabled={saving === addRoomHostelId || usedTypesForAdd.includes(addRoomForm.type)}
            >
              {saving === addRoomHostelId ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove room type?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Remove <strong>{formatRoomType(deleteTarget.type)}</strong> from this property?
                  Existing bookings keep their history, but guests will no longer be able to select this room type for new bookings.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleDeleteRoomConfirm();
              }}
              disabled={!!deleteTarget && saving === deleteTarget.roomId}
            >
              {deleteTarget && saving === deleteTarget.roomId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Remove room"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {hostels.map((hostel, i) => {
        const totalBeds = hostel.room_types.reduce((sum, room) => sum + (room.total_beds || 0), 0);
        const availableBeds = hostel.room_types.reduce((sum, room) => sum + (room.available_beds || 0), 0);
        const occupiedBeds = hostel.room_types.reduce((sum, room) => sum + (room.occupied_beds || 0), 0);

        return (
          <motion.div
            key={hostel.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-card rounded-2xl border border-border/50 shadow-card overflow-hidden"
          >
            <button
              type="button"
              className="w-full p-5 flex items-center gap-4 text-left hover:bg-secondary/30 transition-colors"
              onClick={() => setExpandedId(expandedId === hostel.id ? null : hostel.id)}
            >
              {hostel.images.length > 0 && (
                <div className="relative w-24 h-20 rounded-lg overflow-hidden shrink-0 border border-border/50">
                  <img
                    src={hostel.images[Math.min(previewIndex[hostel.id] || 0, hostel.images.length - 1)].url}
                    alt={hostel.hostel_name}
                    className="w-full h-full object-cover"
                  />
                  {hostel.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-card/80 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewIndex((prev) => ({
                            ...prev,
                            [hostel.id]: ((prev[hostel.id] || 0) - 1 + hostel.images.length) % hostel.images.length,
                          }));
                        }}
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-card/80 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewIndex((prev) => ({
                            ...prev,
                            [hostel.id]: ((prev[hostel.id] || 0) + 1) % hostel.images.length,
                          }));
                        }}
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-heading font-semibold text-sm">{hostel.hostel_name}</h3>
                  {statusBadge(hostel.verified_status)}
                  {!hostel.is_active ? (
                    <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                      <EyeOff className="w-3 h-3" /> Hidden from catalog
                    </Badge>
                  ) : hostel.verified_status === "verified" ? (
                    <Badge variant="outline" className="text-[10px] gap-1 text-accent border-accent/30">
                      <Eye className="w-3 h-3" /> Live in catalog
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">{hostel.location}, {hostel.city}</p>
                {hostel.verified_status === "pending" && (
                  <p className="text-amber-600 text-xs mt-1 font-medium">Awaiting admin approval.</p>
                )}
                {hostel.facilities && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(hostel.facilities)
                      .filter(([, enabled]) => enabled)
                      .slice(0, 6)
                      .map(([key]) => (
                        <Badge key={key} variant="secondary" className="text-[10px]">
                          {featureLabel(key)}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-2">
                <p className="font-heading font-bold text-sm text-primary">
                  ₹{hostel.price_min.toLocaleString()} - ₹{hostel.price_max.toLocaleString()}
                </p>
                <div className="text-muted-foreground text-xs text-right">
                  <p>{hostel.room_types.length} room types · {hostel.images.length} photos · {hostel.videos.length} videos</p>
                  <p>Total beds: {totalBeds} · Available: {availableBeds} · Occupied: {occupiedBeds}</p>
                </div>
              </div>
            </button>

            {expandedId === hostel.id && (
              <div className="px-5 pb-5 space-y-5 border-t border-border/50 pt-4">
                <MediaGalleryManager
                  hostelId={hostel.id}
                  images={hostel.images}
                  videos={hostel.videos}
                  onRefresh={fetchHostels}
                />

                <div>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h4 className="font-heading font-semibold text-xs flex items-center gap-1.5">
                      <Bed className="w-3.5 h-3.5 text-primary" /> Room &amp; Bed Management
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 rounded-xl text-xs"
                      onClick={() => openAddRoomDialog(hostel.id, hostel.room_types.map((r) => r.type))}
                      disabled={
                        saving === hostel.id ||
                        hostel.room_types.length >= ROOM_TYPE_OPTIONS.length
                      }
                    >
                      <Plus className="w-3 h-3" /> Add room
                    </Button>
                  </div>

                  {hostel.room_types.length === 0 ? (
                    <div className="text-center py-8 rounded-xl border border-dashed border-border/50 bg-secondary/20">
                      <Bed className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">Add your first room type so guests can book.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1"
                        onClick={() => openAddRoomDialog(hostel.id, [])}
                      >
                        <Plus className="w-3 h-3" /> Add room type
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] text-muted-foreground uppercase tracking-wide px-2">
                        <span className="col-span-2">Room type</span>
                        <span className="col-span-2">Total beds</span>
                        <span className="col-span-2">Occupied</span>
                        <span className="col-span-2">Available</span>
                        <span className="col-span-2">Price</span>
                        <span className="col-span-2 text-right">Actions</span>
                      </div>
                      {hostel.room_types.map((room) => (
                        <div key={room.id} className="p-3 bg-secondary/30 rounded-xl space-y-3 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center">
                          {editRoom[room.id] ? (
                            <>
                              <Select
                                value={editRoom[room.id].type}
                                onValueChange={(v) => setEditRoom((prev) => ({ ...prev, [room.id]: { ...prev[room.id], type: v } }))}
                              >
                                <SelectTrigger className="h-9 sm:h-8 sm:col-span-2 text-xs rounded-lg w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ROOM_TYPE_OPTIONS.map((t) => (
                                    <SelectItem
                                      key={t}
                                      value={t}
                                      disabled={
                                        t !== editRoom[room.id].originalType &&
                                        hostel.room_types.some((r) => r.type === t && r.id !== room.id)
                                      }
                                    >
                                      {formatRoomType(t)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                aria-label="Total beds"
                                className="h-9 sm:h-8 sm:col-span-2 text-xs rounded-lg"
                                value={editRoom[room.id].total_beds}
                                onChange={(e) => setEditRoom((prev) => ({ ...prev, [room.id]: { ...prev[room.id], total_beds: e.target.value } }))}
                              />
                              <Input
                                type="number"
                                aria-label="Occupied beds"
                                className="h-9 sm:h-8 sm:col-span-2 text-xs rounded-lg"
                                value={editRoom[room.id].occupied_beds}
                                onChange={(e) => setEditRoom((prev) => ({ ...prev, [room.id]: { ...prev[room.id], occupied_beds: e.target.value } }))}
                              />
                              <div className="sm:col-span-2 text-xs text-muted-foreground px-1 sm:px-2">
                                Available: {Math.max(parseInt(editRoom[room.id].total_beds || "0", 10) - parseInt(editRoom[room.id].occupied_beds || "0", 10), 0)}
                              </div>
                              <Input
                                type="number"
                                aria-label="Monthly price"
                                className="h-9 sm:h-8 sm:col-span-2 text-xs rounded-lg"
                                value={editRoom[room.id].price}
                                onChange={(e) => setEditRoom((prev) => ({ ...prev, [room.id]: { ...prev[room.id], price: e.target.value } }))}
                              />
                              <div className="flex gap-2 sm:col-span-2 sm:justify-end">
                                <Button
                                  size="sm"
                                  className="h-8 gap-1 rounded-lg text-xs flex-1 sm:flex-none"
                                  onClick={() => saveEditRoom(room.id, hostel.id)}
                                  disabled={saving === room.id}
                                >
                                  {saving === room.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                  Save
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 rounded-lg text-xs flex-1 sm:flex-none"
                                  onClick={() => setEditRoom((prev) => {
                                    const next = { ...prev };
                                    delete next[room.id];
                                    return next;
                                  })}
                                >
                                  <X className="w-3 h-3" /> Cancel
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <Badge variant="secondary" className="capitalize text-xs sm:col-span-2 w-fit">{formatRoomType(room.type)}</Badge>
                              <span className="text-xs sm:col-span-2"><span className="sm:hidden text-muted-foreground">Total: </span>{room.total_beds}</span>
                              <span className="text-xs sm:col-span-2"><span className="sm:hidden text-muted-foreground">Occupied: </span>{room.occupied_beds}</span>
                              <span className="text-xs sm:col-span-2"><span className="sm:hidden text-muted-foreground">Available: </span>{room.available_beds}</span>
                              <span className="text-xs font-heading font-bold text-primary sm:col-span-2">
                                ₹{room.price.toLocaleString()}/mo
                              </span>
                              <div className="flex gap-2 sm:col-span-2 sm:justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 rounded-lg text-xs flex-1 sm:flex-none"
                                  onClick={() => setEditRoom((prev) => ({
                                    ...prev,
                                    [room.id]: {
                                      type: room.type,
                                      originalType: room.type,
                                      price: room.price.toString(),
                                      total_beds: room.total_beds.toString(),
                                      occupied_beds: room.occupied_beds.toString(),
                                    },
                                  }))}
                                >
                                  <Edit2 className="w-3 h-3" /> Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 rounded-lg text-xs text-destructive flex-1 sm:flex-none"
                                  onClick={() => setDeleteTarget({ roomId: room.id, hostelId: hostel.id, type: room.type })}
                                  disabled={saving === room.id}
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {hostel.room_types.length > 0 && (
                    <div className="mt-3 rounded-xl border border-border/50 bg-card p-3">
                      <p className="text-xs font-medium mb-2">Room availability summary</p>
                      <div className="grid sm:grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg bg-secondary/50 p-2">
                          <p className="text-muted-foreground">Total beds</p>
                          <p className="font-heading font-bold">{totalBeds}</p>
                        </div>
                        <div className="rounded-lg bg-accent/10 p-2">
                          <p className="text-muted-foreground">Available beds</p>
                          <p className="font-heading font-bold text-accent">{availableBeds}</p>
                        </div>
                        <div className="rounded-lg bg-destructive/10 p-2">
                          <p className="text-muted-foreground">Occupied beds</p>
                          <p className="font-heading font-bold text-destructive">{occupiedBeds}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                  <h4 className="font-heading font-semibold text-xs flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-primary" /> Property settings
                  </h4>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor={`catalog-${hostel.id}`} className="text-sm font-medium">Show in catalog</Label>
                      <p className="text-xs text-muted-foreground">{catalogHelperText(hostel)}</p>
                    </div>
                    <Switch
                      id={`catalog-${hostel.id}`}
                      checked={hostel.is_active}
                      disabled={catalogToggling === hostel.id}
                      onCheckedChange={(checked) => handleCatalogToggle(hostel.id, checked)}
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default OwnerPropertyManager;
