import { useState, useEffect, useMemo } from "react";
import { Gift, Loader2, Search, Wallet, Users, Trophy, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

interface ReferralRow {
  id: string;
  referrer_user_id: string;
  referred_user_id: string | null;
  referral_code: string;
  reward_points: number;
  status: string;
  booking_reward_paid_at: string | null;
  created_at: string;
}

interface ProfileSummary {
  user_id: string;
  full_name: string;
  email: string | null;
}

interface WalletSummary {
  user_id: string;
  cash_value: number;
  reward_points: number;
}

type StatusFilter = "all" | "pending" | "rewarded" | "active";

const statusStyles: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-700",
  rewarded: "bg-verified/10 text-verified",
  active: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
};

const AdminReferrals = () => {
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileSummary>>(new Map());
  const [wallets, setWallets] = useState<Map<string, WalletSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: refs, error } = await supabase
      .from("referrals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setLoading(false);
      return;
    }

    const rows = (refs || []) as ReferralRow[];
    setReferrals(rows);

    const userIds = new Set<string>();
    rows.forEach((r) => {
      userIds.add(r.referrer_user_id);
      if (r.referred_user_id) userIds.add(r.referred_user_id);
    });

    if (userIds.size > 0) {
      const ids = Array.from(userIds);
      const [profilesRes, walletsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids),
        supabase.from("user_wallet").select("user_id, cash_value, reward_points").in("user_id", ids),
      ]);

      const profileMap = new Map<string, ProfileSummary>();
      (profilesRes.data || []).forEach((p) => profileMap.set(p.user_id, p));
      setProfiles(profileMap);

      const walletMap = new Map<string, WalletSummary>();
      (walletsRes.data || []).forEach((w) => walletMap.set(w.user_id, w));
      setWallets(walletMap);
    }

    setLoading(false);
  };

  const stats = useMemo(() => {
    const withFriend = referrals.filter((r) => r.referred_user_id != null);
    const pending = withFriend.filter((r) => r.status === "pending").length;
    const rewarded = referrals.filter((r) => r.status === "rewarded" || r.booking_reward_paid_at).length;
    const totalWallet = Array.from(wallets.values()).reduce((sum, w) => sum + Number(w.cash_value), 0);
    const rewardsPaid = referrals.filter((r) => r.booking_reward_paid_at).length;

    return { withFriend: withFriend.length, pending, rewarded, totalWallet, rewardsPaid };
  }, [referrals, wallets]);

  const filtered = useMemo(() => {
    let result = referrals.filter((r) => r.referred_user_id != null || r.status !== "active");

    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => {
        const referrer = profiles.get(r.referrer_user_id);
        const friend = r.referred_user_id ? profiles.get(r.referred_user_id) : null;
        return (
          r.referral_code.toLowerCase().includes(q) ||
          referrer?.full_name.toLowerCase().includes(q) ||
          referrer?.email?.toLowerCase().includes(q) ||
          friend?.full_name.toLowerCase().includes(q) ||
          friend?.email?.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [referrals, profiles, search, statusFilter]);

  const profileLabel = (userId: string) => {
    const p = profiles.get(userId);
    if (!p) return "Unknown user";
    return p.full_name?.trim() || p.email || "Unknown user";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" /> Referrals & Wallets
        </h2>
        <Badge variant="secondary" className="font-mono">{filtered.length} rows</Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Friends linked", value: stats.withFriend, icon: Users, color: "text-primary" },
          { label: "Pending check-in", value: stats.pending, icon: Clock, color: "text-amber-600" },
          { label: "Rewards paid", value: stats.rewardsPaid, icon: Trophy, color: "text-verified" },
          { label: "Total wallet balance", value: `₹${stats.totalWallet.toFixed(0)}`, icon: Wallet, color: "text-accent" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </div>
            <p className="font-heading font-bold text-xl">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by code, referrer, or friend..."
            className="pl-10 rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-[160px] rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rewarded">Rewarded</SelectItem>
            <SelectItem value="active">Active codes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Referrer</th>
              <th className="p-3 font-medium">Friend</th>
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Reward</th>
              <th className="p-3 font-medium">Referrer wallet</th>
              <th className="p-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                  No referrals match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => {
                const referrerWallet = wallets.get(r.referrer_user_id);
                const friend = r.referred_user_id ? profiles.get(r.referred_user_id) : null;
                const referrer = profiles.get(r.referrer_user_id);

                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-t border-border/40"
                  >
                    <td className="p-3">
                      <p className="font-medium truncate max-w-[140px]">{profileLabel(r.referrer_user_id)}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">{referrer?.email || "—"}</p>
                    </td>
                    <td className="p-3">
                      {friend ? (
                        <>
                          <p className="font-medium truncate max-w-[140px]">{friend.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[140px]">{friend.email || "—"}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">Not linked yet</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{r.referral_code}</td>
                    <td className="p-3">
                      <Badge className={`${statusStyles[r.status] || statusStyles.active} text-[10px]`}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs">
                      {r.booking_reward_paid_at ? (
                        <span className="text-verified">₹100 paid</span>
                      ) : r.referred_user_id ? (
                        <span className="text-muted-foreground">Awaiting check-in</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 font-medium">₹{Number(referrerWallet?.cash_value ?? 0).toFixed(0)}</td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Referrers earn ₹100 when a referred friend checks in to their hostel. Reward status updates when check-in completes.
      </p>
    </div>
  );
};

export default AdminReferrals;
