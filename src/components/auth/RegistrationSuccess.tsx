import { CheckCircle2, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RegistrationSuccessProps {
  fullName: string;
  contactMethod: "email" | "mobile";
  contactValue: string;
  role: "tenant" | "owner";
  welcomeEmailSent: boolean;
  welcomeEmailAddress?: string | null;
  onContinue: () => void;
}

const RegistrationSuccess = ({
  fullName,
  contactMethod,
  contactValue,
  role,
  welcomeEmailSent,
  welcomeEmailAddress,
  onContinue,
}: RegistrationSuccessProps) => {
  const displayName = fullName.trim() || "there";
  const channelConfirmed =
    contactMethod === "email"
      ? "Your email is confirmed."
      : "Your mobile number is verified.";

  return (
    <div className="space-y-5 text-center">
      <div className="w-16 h-16 rounded-full bg-[#5A3E2B]/10 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8" style={{ color: "#5A3E2B" }} />
      </div>

      <div>
        <h1 className="font-heading font-bold text-2xl mb-2" style={{ color: "#2C2C2C" }}>
          Registration confirmed
        </h1>
        <p className="text-sm" style={{ color: "#6B6B6B" }}>
          {channelConfirmed} Welcome to StayNest, {displayName}!
        </p>
      </div>

      <div
        className="flex items-start gap-3 p-4 rounded-xl text-left text-sm"
        style={{ backgroundColor: "#FAF7F2", border: "1px solid #E8E0D8" }}
      >
        {contactMethod === "email" ? (
          <Mail className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#5A3E2B" }} />
        ) : (
          <Smartphone className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#5A3E2B" }} />
        )}
        <div className="space-y-1">
          <p className="font-medium" style={{ color: "#2C2C2C" }}>
            {contactMethod === "email" ? "Email verified" : "Mobile verified"}
          </p>
          <p style={{ color: "#6B6B6B" }}>{contactValue}</p>
        </div>
      </div>

      {welcomeEmailSent && welcomeEmailAddress && (
        <p className="text-sm" style={{ color: "#6B6B6B" }}>
          We also sent a welcome email to{" "}
          <span className="font-medium" style={{ color: "#2C2C2C" }}>{welcomeEmailAddress}</span>.
        </p>
      )}

      <p className="text-xs" style={{ color: "#9B9B9B" }}>
        {role === "owner"
          ? "You can now add your property and start receiving booking requests."
          : "You can now browse hostels and submit booking requests."}
      </p>

      <Button
        size="lg"
        className="w-full rounded-xl text-white font-semibold"
        style={{ backgroundColor: "#5A3E2B" }}
        onClick={onContinue}
      >
        {role === "owner" ? "Continue to Owner Portal" : "Continue to Dashboard"}
      </Button>
    </div>
  );
};

export default RegistrationSuccess;
