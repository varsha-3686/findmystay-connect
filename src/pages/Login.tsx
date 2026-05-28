import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  Mail,
  ArrowRight,
  Lock,
  Smartphone,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PhoneCountryInput } from "@/components/auth/PhoneCountryInput";
import { DEFAULT_DIAL_CODE } from "@/lib/phoneCountries";
import { cn } from "@/lib/utils";
import { composePhoneE164 } from "@/lib/otpAuth";
import { stashReferralCodeFromUrl, applyPendingReferralCode } from "@/lib/pendingReferral";
import { signInWithEmailPassword, sendPasswordReset } from "@/lib/authEmail";
import { navigateAfterAuth } from "@/lib/authRedirect";

type AuthStep = "contact" | "otp";
type ContactMethod = "email" | "mobile";

const Login = () => {
  const [step, setStep] = useState<AuthStep>("contact");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email");
  const [email, setEmail] = useState("");
  const [phoneDialCode, setPhoneDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect");
  const { user, hasRole, rolesLoaded } = useAuth();
  const postLoginNavRef = useRef(false);

  const phoneE164 = composePhoneE164(phoneDialCode, phoneNational);

  useEffect(() => {
    if (redirectPath) {
      toast.info("Please sign in or create an account to continue booking.");
    }
  }, [redirectPath]);

  useEffect(() => {
    stashReferralCodeFromUrl(searchParams.get("ref"), searchParams.get("coupon"));
  }, [searchParams]);

  useEffect(() => {
    if (!user) postLoginNavRef.current = false;
  }, [user]);

  useEffect(() => {
    if (!user || !rolesLoaded || postLoginNavRef.current) return;

    postLoginNavRef.current = true;
    let cancelled = false;

    (async () => {
      await applyPendingReferralCode();
      if (cancelled) return;
      navigateAfterAuth(navigate, hasRole, redirectPath);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, rolesLoaded, redirectPath, hasRole, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (contactMethod === "email") {
      if (!email.trim()) {
        toast.error("Please enter your email address.");
        return;
      }
      if (!password.trim()) {
        toast.error("Please enter your password.");
        return;
      }

      setSubmitting(true);
      try {
        const { data, error } = await signInWithEmailPassword(email, password);
        if (error) {
          toast.error(error.message);
        } else if (data.session) {
          toast.success("Welcome back!");
        }
      } catch {
        toast.error("Something went wrong.");
      }
      setSubmitting(false);
      return;
    }

    if (!phoneE164) {
      toast.error("Invalid mobile number");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: phoneE164 });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("OTP sent to mobile!");
        setStep("otp");
      }
    } catch {
      toast.error("Failed to send OTP");
    }
    setSubmitting(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await sendPasswordReset(email);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password reset link sent. Check your email.");
      }
    } catch {
      toast.error("Failed to send reset link.");
    }
    setSubmitting(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      toast.error("Enter OTP");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneE164,
        token: otp,
        type: "sms",
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Login successful!");
      }
    } catch {
      toast.error("OTP verification failed");
    }
    setSubmitting(false);
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
          {step === "contact" && (
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="font-heading font-bold text-2xl mb-1" style={{ color: "#2C2C2C" }}>
                  Welcome Back
                </h1>
                <p className="text-sm" style={{ color: "#6B6B6B" }}>
                  Sign in to your StayNest account
                </p>
              </div>

              <div className="flex rounded-xl border border-[#E8E0D8] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setContactMethod("mobile")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all",
                    contactMethod === "mobile" ? "text-white" : "text-[#6B6B6B]"
                  )}
                  style={contactMethod === "mobile" ? { backgroundColor: "#5A3E2B" } : {}}
                >
                  <Smartphone className="w-4 h-4" />
                  Mobile
                </button>
                <button
                  type="button"
                  onClick={() => setContactMethod("email")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all",
                    contactMethod === "email" ? "text-white" : "text-[#6B6B6B]"
                  )}
                  style={contactMethod === "email" ? { backgroundColor: "#5A3E2B" } : {}}
                >
                  <Mail className="w-4 h-4" />
                  Email
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {contactMethod === "email" ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9B9B]" />
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10 h-11 rounded-xl border-[#E8E0D8]"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Password</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9B9B]" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter password"
                          className="pl-10 pr-10 h-11 rounded-xl border-[#E8E0D8]"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
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

                    <div className="text-right">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={submitting}
                        className="text-xs font-medium hover:underline"
                        style={{ color: "#5A3E2B" }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Mobile Number</Label>
                    <PhoneCountryInput
                      id="login-phone"
                      dialCode={phoneDialCode}
                      onDialCodeChange={setPhoneDialCode}
                      nationalNumber={phoneNational}
                      onNationalChange={setPhoneNational}
                      disabled={submitting}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full gap-2 rounded-xl text-white font-semibold"
                  style={{ backgroundColor: "#5A3E2B" }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      {contactMethod === "email" ? "Sign In" : "Send OTP"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-xs text-center" style={{ color: "#9B9B9B" }}>
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="font-medium hover:underline" style={{ color: "#5A3E2B" }}>
                  Create Account
                </Link>
              </p>

              <div
                className="flex items-center gap-2 p-3 rounded-xl"
                style={{ backgroundColor: "#FAF7F2", border: "1px solid #E8E0D8" }}
              >
                <Lock className="w-4 h-4 shrink-0" />
                <p className="text-xs text-gray-500">Secure authentication powered by Supabase</p>
              </div>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-5">
              <div className="text-center">
                <h1 className="text-2xl font-bold">Verify OTP</h1>
                <p className="text-sm text-gray-500">Enter OTP sent to your mobile</p>
              </div>

              <Input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />

              <Button onClick={handleVerifyOTP} className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify OTP"}
              </Button>

              <button
                type="button"
                onClick={() => { setStep("contact"); setOtp(""); }}
                className="text-sm hover:underline w-full text-center"
                style={{ color: "#6B6B6B" }}
              >
                &larr; Back to sign in
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
