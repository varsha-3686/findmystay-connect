import { User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleSelectorProps {
  role: "user" | "owner";
  onRoleChange: (role: "user" | "owner") => void;
}

const RoleSelector = ({ role, onRoleChange }: RoleSelectorProps) => (
  <div className="grid grid-cols-2 gap-3">
    <button
      type="button"
      onClick={() => onRoleChange("user")}
      className={cn(
        "p-4 rounded-xl border-2 text-center transition-all",
        role === "user"
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30"
      )}
    >
      <User className={cn("w-5 h-5 mx-auto mb-2", role === "user" ? "text-primary" : "text-muted-foreground")} />
      <span className={cn("text-sm font-heading font-semibold", role === "user" ? "text-primary" : "text-muted-foreground")}>
        Student / Employee
      </span>
    </button>
    <button
      type="button"
      onClick={() => onRoleChange("owner")}
      className={cn(
        "p-4 rounded-xl border-2 text-center transition-all",
        role === "owner"
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30"
      )}
    >
      <Building2 className={cn("w-5 h-5 mx-auto mb-2", role === "owner" ? "text-primary" : "text-muted-foreground")} />
      <span className={cn("text-sm font-heading font-semibold", role === "owner" ? "text-primary" : "text-muted-foreground")}>
        Property Owner
      </span>
    </button>
  </div>
);

export default RoleSelector;
