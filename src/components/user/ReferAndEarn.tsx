import { useState, useEffect } from "react";
import { Copy, Share2, Gift, Users, Wallet, Trophy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { motion } from "framer-motion";

const ReferAndEarn = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [wallet, setWallet] = useState({ reward_points: 0, cash_value: 0 });
  const [referrals, setReferrals] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) initReferral();
  }, [user]);

  const initReferral = async () => {
    // Generate or fetch referral code
    const code = `SN${user!.id.slice(0, 6).toUpperCase()}`;
    setReferralCode(code);

    // Ensure referral row exists
    const { data: existing } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_user_id", user!.id)
      .eq("referral_code", code)
      .maybeSingle();

    if (!existing) {
      await supabase.from("referrals").insert({
        referrer_user_id: user!.id,
        referral_code: code,
        reward_points: 0,
        status: "active",
      });
    }

    // Fetch all referrals
    const { data: refs } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_user_id", user!.id)
      .order("created_at", { ascending: false });

    setReferrals(refs || []);

    // Fetch or create wallet
    const { data: w } = await supabase
      .from("user_wallet")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (w) {
      setWallet(w);
    } else {
      await supabase.from("user_wallet").insert({
        user_id: user!.id,
        reward_points: 0,
        cash_value: 0,
      });
    }
    setLoading(false);
  };

  const referralLink = `https://staynest.app/signup?ref=${referralCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareVia = (platform: string) => {
    const msg = encodeURIComponent(`Join StayNest and find your perfect hostel! Use my referral link: ${referralLink}`);
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${msg}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${msg}`,
      email: `mailto:?subject=Join StayNest&body=${msg}`,
    };
    window.open(urls[platform], "_blank");
  };

  const stats = [
    { label: "Total Invites", value: referrals.length, icon: Users, color: "text-primary" },
    { label: "Points Earned", value: wallet.reward_points, icon: Trophy, color: "text-accent" },
    { label: "Wallet Balance", value: `₹${Number(wallet.cash_value).toFixed(0)}`, icon: Wallet, color: "text-verified" },
  ];

  if (loading) return null;

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary via-primary/90 to-accent rounded-2xl p-6 text-primary-foreground relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-foreground/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary-foreground/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-5 h-5" />
            <h3 className="font-heading font-bold text-lg">Refer & Earn</h3>
          </div>
          <p className="text-sm opacity-80 mb-4">Invite friends & earn rewards. 100 points = ₹10!</p>

          {/* Referral Code */}
          <div className="bg-primary-foreground/15 backdrop-blur-sm rounded-xl p-3 flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider opacity-60">Your Referral Code</p>
              <p className="font-heading font-extrabold text-lg tracking-wider">{referralCode}</p>
            </div>
            <Button
              size="sm"
              variant="hero-outline"
              className="gap-1.5 text-xs"
              onClick={copyLink}
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
          </div>

          {/* Share Buttons */}
          <div className="flex gap-2">
            <Button size="sm" variant="hero-outline" className="text-xs flex-1" onClick={() => shareVia("whatsapp")}>
              WhatsApp
            </Button>
            <Button size="sm" variant="hero-outline" className="text-xs flex-1" onClick={() => shareVia("telegram")}>
              Telegram
            </Button>
            <Button size="sm" variant="hero-outline" className="text-xs flex-1" onClick={() => shareVia("email")}>
              Email
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, i) => (
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

      {/* Reward Tiers */}
      <div className="bg-card rounded-2xl border border-border/50 shadow-card p-4">
        <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent" /> Reward Tiers
        </h4>
        <div className="space-y-2 text-xs">
          {[
            { action: "Friend joins StayNest", points: "+50 pts" },
            { action: "Referred user books hostel", points: "+200 pts" },
            { action: "Owner registers via referral", points: "+500 pts" },
          ].map((tier) => (
            <div key={tier.action} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <span className="text-muted-foreground">{tier.action}</span>
              <Badge className="bg-accent/10 text-accent border-accent/30 text-[10px]">{tier.points}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Referral History */}
      {referrals.length > 1 && (
        <div className="bg-card rounded-2xl border border-border/50 shadow-card p-4">
          <h4 className="font-heading font-semibold text-sm mb-3">Referral History</h4>
          <div className="space-y-2 text-xs">
            {referrals.slice(0, 10).map((ref) => (
              <div key={ref.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <span className="text-muted-foreground">{ref.referral_code}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={ref.status === "active" ? "default" : "secondary"} className="text-[10px]">
                    {ref.status}
                  </Badge>
                  <span className="font-heading font-semibold text-primary">+{ref.reward_points}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferAndEarn;
