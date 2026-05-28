import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, Send, Clock, CheckCircle2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600",
  confirmed: "bg-destructive/10 text-destructive",
  dismissed: "bg-muted text-muted-foreground",
};

const UserFraudComplaints = () => {
  const { user } = useAuth();
  const [hostels, setHostels] = useState<{ id: string; hostel_name: string }[]>([]);
  const [myAlerts, setMyAlerts] = useState<{ id: string; status: string; created_at: string; hostels?: { hostel_name: string } | null; flags?: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedHostel, setSelectedHostel] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  const fetchEligibleHostels = useCallback(async () => {
    if (!user) return;
    const [bookingsRes, laundryRes] = await Promise.all([
      supabase.from("bookings").select("hostel_id").eq("user_id", user.id),
      supabase.from("laundry_orders").select("hostel_id").eq("user_id", user.id).not("hostel_id", "is", null),
    ]);
    if (bookingsRes.error) { toast.error(bookingsRes.error.message); return; }
    if (laundryRes.error) { toast.error(laundryRes.error.message); return; }

    const ids = [
      ...new Set([
        ...(bookingsRes.data || []).map((b) => b.hostel_id),
        ...(laundryRes.data || []).map((o) => o.hostel_id).filter(Boolean) as string[],
      ]),
    ];

    if (!ids.length) {
      setHostels([]);
      return;
    }

    const { data, error } = await supabase
      .from("hostels")
      .select("id, hostel_name")
      .in("id", ids)
      .order("hostel_name");
    if (error) { toast.error(error.message); return; }
    setHostels(data || []);
  }, [user]);

  const fetchMyAlerts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("fraud_alerts")
      .select("*, hostels(hostel_name)")
      .eq("reported_by", user.id)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setLoading(false); return; }
    setMyAlerts(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchEligibleHostels(), fetchMyAlerts()]);
  }, [user, fetchEligibleHostels, fetchMyAlerts]);

  const handleSubmit = async () => {
    if (!selectedHostel || !description.trim()) {
      toast.error("Please select a hostel and provide a description.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("fraud_alerts").insert({
        hostel_id: selectedHostel,
        reported_by: user!.id,
        status: "pending",
        risk_score: 0,
        flags: [{
          type: category || "user_report",
          severity: "medium",
          description: description.trim(),
        }],
      });

      if (error) throw error;
      toast.success("Your report has been submitted. Our team will review it shortly.");
      setDescription("");
      setCategory("");
      setSelectedHostel("");
      fetchMyAlerts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-heading font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Report an Issue
        </h2>
        <p className="text-sm text-muted-foreground">
          You can only report hostels where you have a booking or have used laundry services.
        </p>
      </div>

      {hostels.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
          <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No eligible hostels yet. Book a stay or use laundry at a property to report an issue there.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/dashboard/bookings">
              <Button variant="outline" size="sm" className="rounded-xl">My Bookings</Button>
            </Link>
            <Link to="/listings">
              <Button variant="outline" size="sm" className="rounded-xl">Browse listings</Button>
            </Link>
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border/50 shadow-card p-6 space-y-4"
        >
          <div>
            <Label className="text-sm font-medium">Hostel</Label>
            <Select value={selectedHostel} onValueChange={setSelectedHostel}>
              <SelectTrigger className="rounded-xl mt-1.5">
                <SelectValue placeholder="Select a hostel" />
              </SelectTrigger>
              <SelectContent>
                {hostels.map((h) => (
                  <SelectItem key={h.id} value={h.id}>{h.hostel_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Category (Optional)</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-xl mt-1.5">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="safety">Safety concern</SelectItem>
                <SelectItem value="hygiene">Hygiene / cleanliness</SelectItem>
                <SelectItem value="misleading">Misleading listing</SelectItem>
                <SelectItem value="harassment">Harassment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Description</Label>
            <Textarea
              placeholder="Describe the issue in detail..."
              className="rounded-xl mt-1.5 min-h-[120px] resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="rounded-xl gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Report
          </Button>
        </motion.div>
      )}

      {myAlerts.length > 0 && (
        <div>
          <h3 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Your Reports
          </h3>
          <div className="space-y-3">
            {myAlerts.map((alert) => (
              <div key={alert.id} className="bg-card rounded-2xl border border-border/50 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-medium text-sm">{alert.hostels?.hostel_name || "Hostel"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(alert.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={statusStyles[alert.status] || statusStyles.pending}>
                    {alert.status === "confirmed" ? (
                      <><CheckCircle2 className="w-3 h-3 mr-1" /> Reviewed</>
                    ) : (
                      alert.status
                    )}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserFraudComplaints;
