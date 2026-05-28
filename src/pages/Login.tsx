import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Mail, ArrowRight, ShieldCheck, Lock, Smartphone, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PhoneCountryInput } from "@/components/auth/PhoneCountryInput";
import { DEFAULT_DIAL_CODE } from "@/lib/phoneCountries";
import { cn } from "@/lib/utils";
import {
  composePhoneE164,
  normalizeEmail,
  isValidEmailInput,
  sendPhoneOtp,
  sendEmailOtp,
  verifyPhoneOtp,
  verifyEmailOtp,
  checkAccountStatusOrSignOut,
  isRecentlyCreatedUser,
} from "@/lib/otpAuth";
import { stashReferralCodeFromUrl, applyPendingReferralCode } from "@/lib/pendingReferral";

type AuthStep = "contact" | "otp";
type ContactMethod = "email" | "mobile";

const Login = () => {
  const [step, setStep] = useState<AuthStep>("contact");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("mobile");
  const [email, setEmail] = useState("");
  const [phoneDialCode, setPhoneDialCode] = useState(DEFAULT_DIAL_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);
  const verifyingRef = useRef(false);
  const postLoginNavRef = useRef(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect");
  const { user, hasRole, rolesLoaded } = useAuth();

  const phoneE164 = composePhoneE164(phoneDialCode, phoneNational);
  const emailNormalized = normalizeEmail(email);
  const contactDisplay =
    contactMethod === "email" ? email : `${phoneDialCode} ${phoneNational}`.trim();

  // Show redirect message
  useEffect(() => {
    if (redirectPath) {
      toast.info("Please sign in or create an account to continue booking.");
    }
  }, []);

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
      if (redirectPath) {
        const bookParam = searchParams.get("book");
        navigate(redirectPath + (bookParam ? `?book=${bookParam}` : ""));
      } else if (hasRole("admin")) navigate("/admin");
      else if (hasRole("owner")) navigate("/owner");
      else navigate("/dashboard");
    })();
    return () => {
      cancelled = true;
    };
  }, [user, rolesLoaded, redirectPath, hasRole, navigate, searchParams]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const t = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCountdown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (submitting) return;
  
    // PASSWORD LOGIN
    if (contactMethod === "email" && password.trim()) {
      if (!email.trim()) {
        toast.error("Please enter email");
        return;
      }
  
      setSubmitting(true);
  
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        });
  
        if (error) {
          toast.error(error.message);
        } else if (data.session) {
          toast.success("Welcome back!");
        }
      } catch {
        toast.error("Something went wrong");
      }
  
      setSubmitting(false);
      return;
    }
  
    // MAGIC LINK LOGIN
    if (contactMethod === "email") {
      if (!email.trim()) {
        toast.error("Please enter email");
        return;
      }
  
      setSubmitting(true);
  
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
  
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Magic link sent! Check your email.");
        }
      } catch {
        toast.error("Failed to send magic link");
      }
  
      setSubmitting(false);
      return;
    }
  
    // MOBILE LOGIN
    if (contactMethod === "mobile") {
      if (!phoneE164) {
        toast.error("Invalid mobile number");
        return;
      }
  
      setSubmitting(true);
  
      try {
        const { error } = await supabase.auth.signInWithOtp({
          phone: phoneE164,
        });
  
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
    }
  };

 