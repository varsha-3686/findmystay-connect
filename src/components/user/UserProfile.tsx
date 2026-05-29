import { useState, useEffect, useRef } from "react";
import { User, Save, Loader2, Info, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  hasEmailPasswordIdentity,
  requestEmailChange,
} from "@/lib/authEmail";
import { isValidEmailInput, normalizeEmail } from "@/lib/otpAuth";

interface UserProfileProps {
  title?: string;
  subtitle?: string;
  showPreferences?: boolean;
}

const UserProfile = ({
  title = "My Profile",
  subtitle = "Manage your personal info & preferences",
  showPreferences = true,
}: UserProfileProps) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: "", email: "", phone: "" });
  const originalEmail = useRef("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({ preferred_city: "", preferred_gender: "", budget_min: "", budget_max: "", preferred_sharing: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmingPassword, setConfirmingPassword] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const [profileRes, prefsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user!.id).single(),
      showPreferences
        ? supabase.from("user_preferences").select("*").eq("user_id", user!.id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as { data: null; error: null }),
    ]);
    if (profileRes.data) {
      const authEmail = user?.email ?? "";
      const profileEmail = profileRes.data.email ?? "";
      const displayEmail = authEmail || profileEmail;
      setProfile({
        full_name: profileRes.data.full_name || "",
        email: displayEmail,
        phone: profileRes.data.phone || "",
      });
      originalEmail.current = displayEmail;
    }
    if (prefsRes.data) {
      setPreferences({
        preferred_city: prefsRes.data.preferred_city || "",
        preferred_gender: prefsRes.data.preferred_gender || "",
        budget_min: prefsRes.data.budget_min?.toString() || "",
        budget_max: prefsRes.data.budget_max?.toString() || "",
        preferred_sharing: prefsRes.data.preferred_sharing || "",
      });
    }
    setLoading(false);
  };

  const saveProfileFields = async (includeEmail: boolean) => {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        ...(includeEmail ? { email: normalizeEmail(profile.email) } : {}),
      })
      .eq("user_id", user!.id);

    if (profileError) {
      toast.error(profileError.message);
      return false;
    }

    if (showPreferences) {
      const { error: prefsError } = await supabase.from("user_preferences").upsert(
        {
          user_id: user!.id,
          preferred_city: preferences.preferred_city || null,
          preferred_gender: preferences.preferred_gender || null,
          budget_min: preferences.budget_min ? parseInt(preferences.budget_min, 10) : null,
          budget_max: preferences.budget_max ? parseInt(preferences.budget_max, 10) : null,
          preferred_sharing: preferences.preferred_sharing || null,
        },
        { onConflict: "user_id" }
      );
      if (prefsError) {
        toast.error(prefsError.message);
        return false;
      }
    }

    return true;
  };

  const processEmailChange = async (normalizedNewEmail: string, password?: string) => {
    const result = await requestEmailChange(normalizedNewEmail, {
      currentPassword: password,
      currentAuthEmail: user?.email ?? originalEmail.current,
    });

    if (!result.ok) {
      toast.error(result.message);
      return false;
    }

    toast.info(
      "A confirmation email has been sent to your new address. Please verify it to complete the change."
    );
    setPendingEmail(normalizedNewEmail);
    setProfile((prev) => ({ ...prev, email: originalEmail.current }));
    return true;
  };

  const handleSave = async () => {
    setSaving(true);

    const normalizedEmail = normalizeEmail(profile.email);
    const normalizedOriginal = normalizeEmail(originalEmail.current);
    const emailChanged = normalizedEmail !== normalizedOriginal;

    if (emailChanged) {
      if (!isValidEmailInput(normalizedEmail)) {
        toast.error("Please enter a valid email address.");
        setSaving(false);
        return;
      }

      if (hasEmailPasswordIdentity(user) && user?.email) {
        setShowPasswordDialog(true);
        setSaving(false);
        return;
      }

      const emailOk = await processEmailChange(normalizedEmail);
      if (!emailOk) {
        setSaving(false);
        return;
      }
    }

    const profileOk = await saveProfileFields(!emailChanged);
    if (!profileOk) {
      setSaving(false);
      return;
    }

    if (!emailChanged) {
      toast.success("Profile updated!");
      originalEmail.current = normalizedEmail;
    }

    setSaving(false);
  };

  const handlePasswordConfirm = async () => {
    if (!currentPassword.trim()) {
      toast.error("Please enter your current password.");
      return;
    }

    setConfirmingPassword(true);
    const normalizedEmail = normalizeEmail(profile.email);
    const emailOk = await processEmailChange(normalizedEmail, currentPassword);
    if (!emailOk) {
      setConfirmingPassword(false);
      return;
    }

    const profileOk = await saveProfileFields(false);
    setConfirmingPassword(false);
    setShowPasswordDialog(false);
    setCurrentPassword("");

    if (!profileOk) return;

    setSaving(false);
  };

  const emailInputChanged =
    normalizeEmail(profile.email) !== normalizeEmail(originalEmail.current);

  if (loading) return <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-heading font-bold text-xl mb-1 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> {title}
        </h2>
        <p className="text-muted-foreground text-sm">{subtitle}</p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-card p-5 space-y-4">
        <h3 className="font-heading font-semibold text-sm">Personal Information</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Full Name</Label>
            <Input
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Email</Label>
            <Input
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="rounded-xl"
              type="email"
            />
            {emailInputChanged && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> A confirmation email will be sent to verify your new address.
              </p>
            )}
            {pendingEmail && !emailInputChanged && (
              <p className="text-[10px] text-muted-foreground">
                Verification pending for <span className="font-medium">{pendingEmail}</span>
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Phone</Label>
            <Input
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="rounded-xl"
              placeholder="+91..."
            />
          </div>
        </div>
      </div>

      {showPreferences && (
        <div className="bg-card rounded-2xl border border-border/50 shadow-card p-5 space-y-4">
          <h3 className="font-heading font-semibold text-sm">Preferences</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Preferred City</Label>
              <Input
                value={preferences.preferred_city}
                onChange={(e) => setPreferences({ ...preferences, preferred_city: e.target.value })}
                className="rounded-xl"
                placeholder="e.g. Bangalore"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Gender Preference</Label>
              <Select
                value={preferences.preferred_gender}
                onValueChange={(v) => setPreferences({ ...preferences, preferred_gender: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Min Budget (₹/month)</Label>
              <Input
                type="number"
                value={preferences.budget_min}
                onChange={(e) => setPreferences({ ...preferences, budget_min: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Max Budget (₹/month)</Label>
              <Input
                type="number"
                value={preferences.budget_max}
                onChange={(e) => setPreferences({ ...preferences, budget_max: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Sharing Preference</Label>
              <Select
                value={preferences.preferred_sharing}
                onValueChange={(v) => setPreferences({ ...preferences, preferred_sharing: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                  <SelectItem value="triple">Triple</SelectItem>
                  <SelectItem value="dormitory">Dormitory</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={saving || showPasswordDialog}
        className="gap-2 rounded-xl"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Changes
      </Button>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm your password</DialogTitle>
            <DialogDescription>
              Enter your current password to change your email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Current password</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pl-10 rounded-xl"
                placeholder="Your password"
                autoComplete="current-password"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setShowPasswordDialog(false);
                setCurrentPassword("");
              }}
              disabled={confirmingPassword}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={handlePasswordConfirm}
              disabled={confirmingPassword}
            >
              {confirmingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Confirm & save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserProfile;
