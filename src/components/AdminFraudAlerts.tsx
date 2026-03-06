import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Eye, Loader2, Shield, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface FraudFlag {
  type: string;
  severity: string;
  description: string;
}

interface FraudAlert {
  id: string;
  hostel_id: string;
  risk_score: number;
  flags: FraudFlag[];
  status: string;
  admin_notes: string | null;
  created_at: string;
  hostels: {
    hostel_name: string;
    location: string;
    city: string;
    price_min: number;
    price_max: number;
    owner_id: string;
  };
}

const severityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-verified/10 text-verified",
  high: "bg-destructive/10 text-destructive",
};

const AdminFraudAlerts = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    const { data } = await supabase
      .from("fraud_alerts")
      .select("*, hostels!inner(hostel_name, location, city, price_min, price_max, owner_id)")
      .eq("status", "pending")
      .order("risk_score", { ascending: false });

    if (data) setAlerts(data as any);
    setLoading(false);
  };

  const handleAction = async (alertId: string, action: "dismissed" | "confirmed") => {
    setProcessing(alertId);
    try {
      await supabase
        .from("fraud_alerts")
        .update({
          status: action,
          admin_notes: notes[alertId] || null,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", alertId);

      if (action === "confirmed") {
        const alert = alerts.find(a => a.id === alertId);
        if (alert) {
          await supabase
            .from("hostels")
            .update({ is_active: false })
            .eq("id", alert.hostel_id);
        }
      }

      toast.success(action === "dismissed" ? "Alert dismissed" : "Listing flagged & deactivated");
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(null);
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Fraud Alerts
        </h2>
        <Badge variant="secondary" className="font-mono">{alerts.length}</Badge>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border/50">
          <Shield className="w-12 h-12 text-accent mx-auto mb-4" />
          <p className="text-muted-foreground">No pending fraud alerts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl border border-border/50 shadow-card p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-heading font-semibold text-lg">{alert.hostels.hostel_name}</h3>
                    <Badge className={`${alert.risk_score > 80 ? "bg-destructive text-destructive-foreground" : "bg-verified/10 text-verified"}`}>
                      Risk: {alert.risk_score}/100
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm mb-1">
                    {alert.hostels.location}, {alert.hostels.city} · ₹{alert.hostels.price_min.toLocaleString()} - ₹{alert.hostels.price_max.toLocaleString()}/mo
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Detected: {new Date(alert.created_at).toLocaleDateString()}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {(alert.flags as FraudFlag[]).map((flag, fi) => (
                      <Badge key={fi} className={`${severityColors[flag.severity] || severityColors.low} gap-1`}>
                        <AlertTriangle className="w-3 h-3" />
                        {flag.type.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-3 space-y-1">
                    {(alert.flags as FraudFlag[]).map((flag, fi) => (
                      <p key={fi} className="text-xs text-muted-foreground">
                        • <strong className="capitalize">{flag.type.replace(/_/g, " ")}</strong>: {flag.description}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="lg:w-64 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Admin Notes</Label>
                    <Textarea
                      placeholder="Add notes..."
                      value={notes[alert.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [alert.id]: e.target.value })}
                      className="rounded-xl min-h-[70px] resize-none text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-xl flex-1"
                      onClick={() => handleAction(alert.id, "dismissed")}
                      disabled={!!processing}
                    >
                      {processing === alert.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Dismiss
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 rounded-xl flex-1"
                      onClick={() => handleAction(alert.id, "confirmed")}
                      disabled={!!processing}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Flag & Block
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFraudAlerts;
