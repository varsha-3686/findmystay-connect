import { useState, useEffect } from "react";
import { Users, Loader2, Phone, Mail, Calendar, UserX, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Member {
  id: string;
  user_id: string;
  hostel_id: string;
  booking_id: string | null;
  joined_at: string;
  status: string;
  hostel_name: string;
  hostel_gender: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  room_type: string | null;
  booking_status: string | null;
}

interface BookingContactRow {
  id: string;
  status: string;
  room_type_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

const OwnerMembers = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (user) fetchMembers();
  }, [user]);

  const fetchMembers = async () => {
    const { data: hostels } = await supabase
      .from("hostels")
      .select("id, hostel_name, gender")
      .eq("owner_id", user!.id);

    if (!hostels?.length) {
      setLoading(false);
      return;
    }

    const hostelIds = hostels.map(h => h.id);
    const hostelMap = new Map(hostels.map(h => [h.id, { name: h.hostel_name, gender: h.gender }]));

    const { data: memberRows } = await supabase
      .from("hostel_members")
      .select("*")
      .in("hostel_id", hostelIds)
      .order("joined_at", { ascending: false });

    if (!memberRows?.length) {
      setLoading(false);
      return;
    }

    const bookingIds = [...new Set(memberRows.map((m) => m.booking_id).filter(Boolean))] as string[];
    const { data: bookings } = bookingIds.length
      ? await supabase
          .from("bookings")
          .select("id, status, room_type_id, full_name, email, phone, address")
          .in("id", bookingIds)
      : { data: [] as BookingContactRow[] };
    const bookingMap = new Map((bookings || []).map((b) => [b.id, b]));
    const roomTypeIds = [...new Set((bookings || []).map((b) => b.room_type_id).filter(Boolean))] as string[];
    const { data: roomTypes } = roomTypeIds.length
      ? await supabase.from("room_types").select("id, type").in("id", roomTypeIds)
      : { data: [] as { id: string; type: string }[] };
    const roomTypeMap = new Map((roomTypes || []).map((r) => [r.id, r.type]));

    setMembers(
      memberRows.map((m) => {
        const booking = m.booking_id ? bookingMap.get(m.booking_id) : undefined;
        return {
          id: m.id,
          user_id: m.user_id,
          hostel_id: m.hostel_id,
          booking_id: m.booking_id || null,
          joined_at: m.joined_at,
          status: m.status,
          hostel_name: hostelMap.get(m.hostel_id)?.name || "Unknown",
          hostel_gender: hostelMap.get(m.hostel_id)?.gender || null,
          full_name: booking?.full_name?.trim() || "Unknown",
          email: booking?.email?.trim() || null,
          phone: booking?.phone?.trim() || null,
          address: booking?.address?.trim() || null,
          room_type: booking?.room_type_id ? roomTypeMap.get(booking.room_type_id) || null : null,
          booking_status: booking?.status || null,
        };
      })
    );
    setLoading(false);
  };

  const handleRemove = async (memberId: string) => {
    setProcessing(memberId);
    try {
      const { error } = await supabase
        .from("hostel_members")
        .update({ status: "removed" })
        .eq("id", memberId);
      if (error) throw error;
      toast.success("Member removed");
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message);
    }
    setProcessing(null);
    setRemoveTarget(null);
    setConfirmText("");
  };

  const expectedConfirmText = removeTarget
    ? `remove ${removeTarget.full_name}`.toLowerCase()
    : "";

  const renderMemberRow = (member: Member, inactive = false) => (
    <TableRow key={member.id} className={inactive ? "opacity-50" : undefined}>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-heading font-bold text-xs shrink-0 ${inactive ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
            {member.full_name[0]?.toUpperCase() || "?"}
          </div>
          <span className="font-medium">{member.full_name}</span>
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {member.phone ? (
          <span className="inline-flex items-center gap-1 text-foreground">
            <Phone className="w-3 h-3" />
            {member.phone}
          </span>
        ) : (
          <span className="text-muted-foreground italic">Not provided</span>
        )}
      </TableCell>
      <TableCell className="text-sm max-w-[180px]">
        {member.address ? (
          <span className="inline-flex items-start gap-1 text-foreground">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{member.address}</span>
          </span>
        ) : (
          <span className="text-muted-foreground italic">Not provided</span>
        )}
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-xs text-muted-foreground">
          {member.email ? (
            <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{member.email}</div>
          ) : (
            <span className="italic">No email</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm">{member.hostel_name}</TableCell>
      <TableCell className="text-sm capitalize">{member.room_type || "N/A"}</TableCell>
      <TableCell className="text-sm capitalize">{member.hostel_gender || "N/A"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          {!inactive && <Calendar className="w-3 h-3" />}
          {new Date(member.joined_at).toLocaleDateString()}
        </div>
      </TableCell>
      <TableCell>
        <Badge className={inactive ? "capitalize" : "bg-accent/10 text-accent capitalize"} variant={inactive ? "secondary" : "default"}>
          {member.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {!inactive && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-destructive hover:text-destructive"
            disabled={processing === member.id}
            onClick={() => { setRemoveTarget(member); setConfirmText(""); }}
          >
            {processing === member.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UserX className="w-3.5 h-3.5" />
            )}
            Remove
          </Button>
        )}
      </TableCell>
    </TableRow>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const activeMembers = members.filter(m => m.status === "active");
  const inactiveMembers = members.filter(m => m.status !== "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Hostel Members
          </h2>
          <p className="text-sm text-muted-foreground">Contact details from each member&apos;s booking</p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          {activeMembers.length} Active
        </Badge>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border/50">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-heading font-semibold text-lg mb-1">No Members Yet</h3>
          <p className="text-sm text-muted-foreground">Members are added when you check in a booking.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border/50 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Hostel</TableHead>
                <TableHead>Room Type</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeMembers.map((member) => renderMemberRow(member))}
              {inactiveMembers.map((member) => renderMemberRow(member, true))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open) { setRemoveTarget(null); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              This will remove <strong>{removeTarget?.full_name}</strong> from <strong>{removeTarget?.hostel_name}</strong>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              To confirm, type <strong className="text-foreground">remove {removeTarget?.full_name?.toLowerCase()}</strong> below:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`remove ${removeTarget?.full_name?.toLowerCase() || ""}`}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRemoveTarget(null); setConfirmText(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText.toLowerCase() !== expectedConfirmText || processing === removeTarget?.id}
              onClick={() => removeTarget && handleRemove(removeTarget.id)}
            >
              {processing === removeTarget?.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserX className="w-4 h-4 mr-1" />}
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerMembers;
