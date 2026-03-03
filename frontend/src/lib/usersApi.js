import { apiUrl } from "./api.js"

const ALLOW_STATIC_USERS_FALLBACK = import.meta.env.VITE_ALLOW_STATIC_USERS_FALLBACK === "true"
const USERS_API_BASE = (
  import.meta.env.VITE_USERS_API_BASE ||
  "https://api.teenarazzi.com"
).replace(/\/$/, "")
const USERS_CACHE_KEY = "teenarazzi:users-map:v1"
const USERS_CACHE_TTL_MS = 5 * 60 * 1000

function hasWindowStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function isUsersMap(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readCachedUsersMap({ allowExpired = false } = {}) {
  if (!hasWindowStorage()) return null

  try {
    const raw = window.localStorage.getItem(USERS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const fetchedAt = Number(parsed?.fetchedAt)
    const users = parsed?.users

    if (!isUsersMap(users)) return null
    if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return allowExpired ? users : null

    const ageMs = Date.now() - fetchedAt
    if (!allowExpired && ageMs > USERS_CACHE_TTL_MS) return null
    return users
  } catch {
    return null
  }
}

function writeCachedUsersMap(users) {
  if (!hasWindowStorage()) return
  if (!isUsersMap(users)) return

  try {
    window.localStorage.setItem(
      USERS_CACHE_KEY,
      JSON.stringify({
        fetchedAt: Date.now(),
        users
      })
    )
  } catch {
    // Ignore storage quota/security errors.
  }
}

export function clearUsersCache() {
  if (!hasWindowStorage()) return
  try {
    window.localStorage.removeItem(USERS_CACHE_KEY)
  } catch {
    // Ignore storage errors.
  }
}

async function fetchUsersFromBackend() {
  const candidates = [
    apiUrl("/v1/users"),
    `${USERS_API_BASE}/v1/users`,
    `${USERS_API_BASE}/users`
  ]

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) continue
      const data = await res.json()

      if (isUsersMap(data?.users)) {
        return data.users
      }

      if (isUsersMap(data)) {
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
  const data = await res.json()
  if (!isUsersMap(data)) throw new Error("Static users payload is invalid")
  return data
}

export async function fetchUsersMap(options = {}) {
  const { forceRefresh = false } = options

  if (!forceRefresh) {
    const cached = readCachedUsersMap()
    if (cached) return cached
  }

  try {
    const users = await fetchUsersFromBackend()
    writeCachedUsersMap(users)
    return users
  } catch {
    const staleCached = readCachedUsersMap({ allowExpired: true })
    if (staleCached) return staleCached
    if (!ALLOW_STATIC_USERS_FALLBACK) throw new Error("Backend users unavailable")

    const staticUsers = await fetchUsersFromStaticFile()
    writeCachedUsersMap(staticUsers)
    return staticUsers
  }
}
