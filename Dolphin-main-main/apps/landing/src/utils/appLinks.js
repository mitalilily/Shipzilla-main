const stripTrailingSlash = (url) => url.replace(/\/+$/, "");

export const PLATFORM_URL = stripTrailingSlash(
  import.meta.env.VITE_PLATFORM_URL || "https://app.shipzilla.in/",
);

export const TRACKING_URL =
  import.meta.env.VITE_TRACKING_URL ||
  "https://app.shipzilla.in/tracking";

export function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openPlatform() {
  openExternal(PLATFORM_URL);
}

export function openTracking() {
  openExternal(TRACKING_URL);
}
