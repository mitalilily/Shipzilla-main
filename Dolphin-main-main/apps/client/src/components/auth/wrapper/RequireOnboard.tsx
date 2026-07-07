// components/auth/RequireOnboard.tsx
import { Navigate, useLocation } from "react-router-dom";
import FullScreenLoader from "../../UI/loader/FullScreenLoader";
import type { JSX } from "@emotion/react/jsx-runtime";
import { useAuth } from "../../../context/auth/AuthContext";

type RouteState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

const resolveReturnPath = (state?: RouteState) => {
  const from = state?.from;
  const path = from?.pathname || "";

  if (!path || path === "/" || path === "/app") {
    return "/app";
  }

  if (path === "/login" || path === "/signup" || path === "/onboarding-questions") {
    return "/app";
  }

  return `${path}${from?.search || ""}${from?.hash || ""}`;
};

export default function RequireOnboard({
  children,
}: {
  children: JSX.Element;
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation(); // keeps track of where the user came from
  const state = location.state as RouteState | null;
  const hasResolvedProfile = Boolean(user?.id);

  /* 1️⃣  Still loading auth state? show spinner */
  if (loading) return <FullScreenLoader />;

  /* 2️⃣  Not logged in at all → kick back to login */
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  /* 3️⃣  Logged‑in AND already onboarded → send to main app */
  if (hasResolvedProfile && user?.onboardingComplete === true) {
    return <Navigate to={resolveReturnPath(state ?? undefined)} replace />;
  }

  /* 4️⃣  Logged‑in BUT NOT onboarded → let them see onboarding page */
  return children;
}
