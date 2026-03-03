import { apiUrl } from "./api.js"

const ALLOW_STATIC_USERS_FALLBACK = import.meta.env.VITE_ALLOW_STATIC_USERS_FALLBACK === "true"
const USERS_API_BASE = (
  import.meta.env.VITE_USERS_API_BASE ||
  "https://api.teenarazzi.com"
).replace(/\/$/, "")

async function fetchUsersFromBackend() {
  const candidates = [
    `${USERS_API_BASE}/users`,
    apiUrl("/v1/users")
  ]

  for (const url of candidates) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()

      if (data && typeof data.users === "object" && !Array.isArray(data.users)) {
        return data.users
      }

      if (data && typeof data === "object" && !Array.isArray(data)) {
        return data
      }
    } catch {
      // Try next candidate endpoint.
    }
  }

  throw new Error("Backend users fetch failed")
}

async function fetchUsersFromStaticFile() {
  const res = await fetch("/users.json")
  if (!res.ok) throw new Error("Static users fetch failed")
  return res.json()
}

export async function fetchUsersMap() {
  try {
    return await fetchUsersFromBackend()
  } catch {
    if (!ALLOW_STATIC_USERS_FALLBACK) throw new Error("Backend users unavailable")
    return fetchUsersFromStaticFile()
  }
}
