import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams, type NavigateFunction } from "react-router-dom";
import { Building2, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import RegistrationSuccess from "@/components/auth/RegistrationSuccess";
import {
  updatePassword,
  validatePassword,
  validatePasswordMatch,
  MIN_PASSWORD_LENGTH,
} from "@/lib/authEmail";
import { navigateAfterAuth } from "@/lib/authRedirect";
import {
  getPendingRoleFromMetadata,
  invokeCompleteRegistration,
} from "@/lib/completeRegistration";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";
import { checkAccountStatusOrSignOut } from "@/lib/otpAuth";
import { applyPendingReferralCode } from "@/lib/pendingReferral";

type AppRole = "admin" | "owner" | "user" | "owner_pending";

async function navigateWithFreshRoles(navigate: NavigateFunction, userId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const hasRoleFn = (role: AppRole) => (roles || []).some((r) => r.role === role);
  navigateAfterAuth(navigate, hasRoleFn);
}

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshRoles } = useAuth();
  const [status, setStatus] = useState<"loading" | "recovery" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [successData, setSuccessData] = useState<{
    fullName: string;
    email: string;
    role: "tenant" | "owner";
    welcomeEmailSent: boolean;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const handledRef = useRef(false);

  const isRecovery = searchParams.get("type") === "recovery";

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        setStatus("error");
        setErrorMessage("Invalid or expired link. Please try signing in again.");
        return;
      }

      if (isRecovery) {
        setStatus("recovery");
        return;
      }

      const statusCheck = await checkAccountStatusOrSignOut();
      if (statusCheck.ok === false) {
        setStatus("error");
        setErrorMessage(statusCheck.message);
        return;
      }

      const pendingRole = getPendingRoleFromMetadata(session.user.user_metadata);
      if (pendingRole) {
        const fullName =
          (typeof session.user.user_metadata?.full_name === "string" &&
            session.user.user_metadata.full_name) ||
          "";

        const regRes = await invokeCompleteRegistration(pendingRole, { full_name: fullName });
        if (regRes.error || regRes.data?.error) {
          setStatus("error");
          setErrorMessage(
            await getEdgeFunctionErrorMessage(regRes, "Registration failed.")
          );
          return;
        }

        await refreshRoles(session.user.id);
        await applyPendingReferralCode();

        setSuccessData({
          fullName,
          email: session.user.email ?? "",
          role: pendingRole === "owner" ? "owner" : "tenant",
          welcomeEmailSent: Boolean(regRes.data?.welcome_email_sent),
        });
        setStatus("success");
        return;
      }

      if (session.user.email) {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (profileRow?.email !== session.user.email) {
          await supabase
            .from("profiles")
            .update({ email: session.user.email })
            .eq("user_id", session.user.id);
          toast.success("Email updated successfully.");
        } else {
          toast.success("Signed in successfully!");
        }
      } else {
        toast.success("Signed in successfully!");
      }

      await navigateWithFreshRoles(navigate, session.user.id);
    })();
  }, [isRecovery, navigate, refreshRoles]);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    const matchError = validatePasswordMatch(newPassword, confirmPassword);
    if (matchError) {
      toast.error(matchError);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated. You are now signed in.");
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await navigateWithFreshRoles(navigate, user.id);
        } else {
          navigate("/login");
        }
      }
    } catch {
      toast.error("Failed to update password.");
    }
    setSubmitting(false);
  };

  const handleContinueAfterSuccess = () => {
    if (!successData) return;
    navigate(successData.role === "owner" ? "/owner" : "/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#FAF7F2" }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#5A3E2B" }}>
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-extrabold text-2xl" style={{ color: "#2C2C2C" }}>
            StayNest
          </span>
        </Link>

        <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(90,62,43,0.08)] border border-[#E8E0D8] p-8">
          {status === "loading" && (
            <div className="text-center space-y-4 py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#5A3E2B]" />
              <p className="text-sm" style={{ color: "#6B6B6B" }}>
                Completing registration...
              </p>
            </div>
          )}

          {status === "success" && successData && (
            <RegistrationSuccess
              fullName={successData.fullName}
              contactMethod="email"
              contactValue={successData.email}
              role={successData.role}
              welcomeEmailSent={successData.welcomeEmailSent}
              welcomeEmailAddress={successData.email}
              onContinue={handleContinueAfterSuccess}
            />
          )}

          {status === "recovery" && (
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="font-heading font-bold text-2xl mb-1" style={{ color: "#2C2C2C" }}>
                  Set New Password
                </h1>
                <p className="text-sm" style={{ color: "#6B6B6B" }}>
                  Choose a new password for your account
                </p>
              </div>

              <form onSubmit={handleSetNewPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9B9B]" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      className="pl-10 pr-10 h-11 rounded-xl border-[#E8E0D8]"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Confirm Password</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    className="h-11 rounded-xl border-[#E8E0D8]"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full rounded-xl text-white font-semibold"
                  style={{ backgroundColor: "#5A3E2B" }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-4 py-4">
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Link to="/login">
                <Button variant="outline" className="rounded-xl">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AuthCallback;
