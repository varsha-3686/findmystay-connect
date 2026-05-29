import { useState, useEffect, useRef } from "react";
import { Copy, Gift, Users, Wallet, Trophy, CheckCircle, ArrowDownToLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ReferralRow {
  id: string;
  referral_code: string;
  referred_user_id: string | null;
  reward_points: number;
  status: string;
  created_at: string;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to execCommand fallback
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

const ReferAndEarn = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [wallet, setWallet] = useState({ reward_points: 0, cash_value: 0 });
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const copiedLinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedCodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    accountHolder: "", bankName: "", accountNumber: "", ifscCode: "", upiId: "", amount: "",
  });

  useEffect(() => {
    if (user) initReferral();
  }, [user]);

  const initReferral = async () => {
    const code = `SN${user!.id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    setReferralCode(code);

    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referrer_user_id", user!.id)
      .eq("referral_code", code)
      .is("referred_user_id", null)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await supabase.from("referrals").insert({
        referrer_user_id: user!.id,
        referral_code: code,
        reward_points: 0,
        status: "active",
      });
      if (insertError && insertError.code !== "23505") {
        toast.error(insertError.message || "Failed to initialize referral code");
      }
    }

    const { data: refs } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_user_id", user!.id)
      .order("created_at", { ascending: false });

    setReferrals((refs || []) as ReferralRow[]);

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

  const referralLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${referralCode}`
      : `https://staynest.app/signup?ref=${referralCode}`;

  const invitedFriends = referrals.filter((r) => r.referred_user_id != null);

  const resetCopiedAfter = (
    setCopied: (v: boolean) => void,
    timeoutRef: { current: ReturnType<typeof setTimeout> | null }
  ) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, 2000);
  };

  const copyLink = async () => {
    const ok = await copyTextToClipboard(referralLink);
    if (!ok) {
      toast.error("Could not copy. Please copy manually.");
      return;
    }
    setCopiedLink(true);
    toast.success("Referral link copied!");
    resetCopiedAfter(setCopiedLink, copiedLinkTimeoutRef);
  };

  const copyCode = async () => {
    const ok = await copyTextToClipboard(referralCode);
    if (!ok) {
      toast.error("Could not copy. Please copy manually.");
      return;
    }
    setCopiedCode(true);
    toast.success("Referral code copied!");
    resetCopiedAfter(setCopiedCode, copiedCodeTimeoutRef);
  };

  const shareVia = (platform: string) => {
    const msg = encodeURIComponent(
      `Join StayNest with my referral link. I earn ₹100 when you check in to your hostel! ${referralLink}`
    );
    const urls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${msg}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${msg}`,
      email: `mailto:?subject=Join StayNest&body=${msg}`,
    };
    window.open(urls[platform], "_blank");
  };

  const stats = [
    { label: "Friends Invited", value: invitedFriends.length, icon: Users, color: "text-primary" },
    { label: "Points Earned", value: wallet.reward_points, icon: Trophy, color: "text-accent" },
    { label: "Wallet Balance", value: `₹${Number(wallet.cash_value).toFixed(0)}`, icon: Wallet, color: "text-verified" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
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
          <p className="text-sm opacity-80 mb-4">
            Share your link. You earn ₹100 when a friend signs up with your code and checks in to their hostel.
          </p>

          <div className="bg-primary-foreground/15 backdrop-blur-sm rounded-xl p-3 mb-3">
            <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Your Referral Code</p>
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading font-extrabold text-lg tracking-wider">{referralCode}</p>
              <Button
                size="sm"
                variant="hero-outline"
                className="gap-1.5 text-xs shrink-0"
                onClick={copyCode}
                disabled={copiedCode}
                aria-live="polite"
                aria-label={copiedCode ? "Referral code copied to clipboard" : "Copy referral code"}
              >
                {copiedCode ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? "Copied" : "Copy Code"}
              </Button>
            </div>
          </div>

          <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-xl p-3 mb-4">
            <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Your Referral Link</p>
            <p className="text-xs break-all opacity-90 mb-2">{referralLink}</p>
            <Button
              size="sm"
              variant="hero-outline"
              className="gap-1.5 text-xs w-full"
              onClick={copyLink}
              disabled={copiedLink}
              aria-live="polite"
              aria-label={copiedLink ? "Referral link copied to clipboard" : "Copy referral link"}
            >
              {copiedLink ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? "Link Copied" : "Copy Link"}
            </Button>
          </div>

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

      <div className="flex justify-end">
        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          disabled={Number(wallet.cash_value) < 100}
          onClick={() => setShowWithdraw(true)}
        >
          <ArrowDownToLine className="w-4 h-4" />
          {Number(wallet.cash_value) < 100 ? `Withdraw (min ₹100)` : "Withdraw"}
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-card p-4">
        <h4 className="font-heading font-semibold text-sm mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent" /> How it works
        </h4>
        <div className="space-y-2 text-xs">
          {[
            { action: "Friend signs up with your code", reward: "Linked" },
            { action: "Friend checks in to their hostel", reward: "You get ₹100" },
          ].map((tier) => (
            <div key={tier.action} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <span className="text-muted-foreground">{tier.action}</span>
              <Badge className="bg-accent/10 text-accent border-accent/30 text-[10px]">{tier.reward}</Badge>
            </div>
          ))}
        </div>
      </div>

      {invitedFriends.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 shadow-card p-4">
          <h4 className="font-heading font-semibold text-sm mb-3">Referral History</h4>
          <div className="space-y-2 text-xs">
            {invitedFriends.slice(0, 10).map((ref) => (
              <div key={ref.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <span className="text-muted-foreground font-mono">{ref.referral_code}</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={ref.status === "rewarded" ? "default" : "secondary"}
                    className="text-[10px] capitalize"
                  >
                    {ref.status === "rewarded" ? "Booked" : ref.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw Funds</DialogTitle>
            <DialogDescription>
              Available balance: <strong>₹{Number(wallet.cash_value).toFixed(0)}</strong>. Fill in your bank details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Account Holder Name *</Label>
              <Input className="rounded-xl" value={withdrawForm.accountHolder} onChange={e => setWithdrawForm({ ...withdrawForm, accountHolder: e.target.value })} placeholder="Full name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Bank Name *</Label>
                <Input className="rounded-xl" value={withdrawForm.bankName} onChange={e => setWithdrawForm({ ...withdrawForm, bankName: e.target.value })} placeholder="Bank name" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">IFSC Code *</Label>
                <Input className="rounded-xl" value={withdrawForm.ifscCode} onChange={e => setWithdrawForm({ ...withdrawForm, ifscCode: e.target.value })} placeholder="IFSC code" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Account Number *</Label>
              <Input className="rounded-xl" value={withdrawForm.accountNumber} onChange={e => setWithdrawForm({ ...withdrawForm, accountNumber: e.target.value })} placeholder="Account number" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">UPI ID (optional)</Label>
              <Input className="rounded-xl" value={withdrawForm.upiId} onChange={e => setWithdrawForm({ ...withdrawForm, upiId: e.target.value })} placeholder="name@upi" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Amount to Withdraw *</Label>
              <Input className="rounded-xl" type="number" min={100} max={wallet.cash_value} value={withdrawForm.amount} onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} placeholder={`Max ₹${Number(wallet.cash_value).toFixed(0)}`} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdraw(false)}>Cancel</Button>
            <Button
              disabled={!withdrawForm.accountHolder || !withdrawForm.bankName || !withdrawForm.accountNumber || !withdrawForm.ifscCode || !withdrawForm.amount || Number(withdrawForm.amount) < 100 || Number(withdrawForm.amount) > wallet.cash_value}
              onClick={async () => {
                const { error } = await supabase.from("withdrawal_requests").insert({
                  user_id: user!.id,
                  amount: Number(withdrawForm.amount),
                  payment_method: withdrawForm.upiId ? "upi" : "bank_transfer",
                  payment_details: {
                    account_holder: withdrawForm.accountHolder,
                    bank_name: withdrawForm.bankName,
                    account_number: withdrawForm.accountNumber,
                    ifsc_code: withdrawForm.ifscCode,
                    upi_id: withdrawForm.upiId || undefined,
                  },
                });
                if (error) {
                  toast.error(error.message || "Failed to submit withdrawal request");
                  return;
                }
                toast.success("Withdrawal request submitted! Your funds will be transferred within 3-5 business days.");
                setShowWithdraw(false);
                setWithdrawForm({ accountHolder: "", bankName: "", accountNumber: "", ifscCode: "", upiId: "", amount: "" });
              }}
            >
              <ArrowDownToLine className="w-4 h-4 mr-1" /> Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReferAndEarn;
