import type { NavigateFunction } from "react-router-dom";

type AppRole = "admin" | "owner" | "user" | "owner_pending";

export function resolvePostAuthPath(
  hasRole: (role: AppRole) => boolean,
  redirectPath?: string | null
): string {
  if (redirectPath) return redirectPath;
  if (hasRole("admin")) return "/admin";
  if (hasRole("owner") || hasRole("owner_pending")) return "/owner";
  return "/dashboard";
}

export function navigateAfterAuth(
  navigate: NavigateFunction,
  hasRole: (role: AppRole) => boolean,
  redirectPath?: string | null
) {
  navigate(resolvePostAuthPath(hasRole, redirectPath));
}
