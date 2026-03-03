export const SUBMISSIONS_API_BASE = (
  import.meta.env.VITE_SUBMISSIONS_API_BASE ||
  "https://api.teenarazzi.com"
).replace(/\/$/, "")

export function apiUrl(path) {
  if (!path.startsWith("/")) return `${SUBMISSIONS_API_BASE}/${path}`
  return `${SUBMISSIONS_API_BASE}${path}`
}
