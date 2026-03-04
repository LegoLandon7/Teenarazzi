const MAX_BODY_BYTES = 32 * 1024
const MAX_USER_JSON_BYTES = 96 * 1024
const DEFAULT_RATE_LIMIT_PER_HOUR = 5
const DEFAULT_AVATAR_URL = "https://cdn.discordapp.com/embed/avatars/0.png"
const DEFAULT_USERS_SOURCE_URL = "https://teenarazzi.com/users.json"
const DEFAULT_USERS_SOURCE_ALLOWED_HOSTS = [
  "teenarazzi.com",
  "www.teenarazzi.com",
  "api.teenarazzi.com"
]
const MAX_USERS_SOURCE_BYTES = 512 * 1024
const LEGACY_USERS_CACHE_KEY = "users:legacy:enriched:v1"
const LEGACY_USERS_CACHE_TTL_SECONDS = 15 * 60
const REDDIT_ACTIVITY_CACHE_KEY = "stats:reddit:weekly-active:v1"
const REDDIT_ACTIVITY_REFRESH_SECONDS = 12 * 60 * 60
const STATUS_VALUES = new Set(["pending", "approved", "rejected", "spam"])
const COMMUNITY_VALUES = new Set(["discord", "reddit", "both"])
const SUBMISSION_REQUEST_TYPE_APPLICATION = "application"
const SUBMISSION_REQUEST_TYPE_EDIT = "edit"
const EDIT_REQUEST_MAX_CHANGED_FIELDS = 30
const SESSION_COOKIE_NAME = "trz_admin_session"
const SESSION_TTL_SECONDS = 8 * 60 * 60
const DEFAULT_DISCORD_GUILD_ID = "1395741172256739348"
const AVATAR_LOOKUP_RETRY_SECONDS = 12 * 60 * 60
const MAX_PUBLIC_AVATAR_LOOKUPS_PER_REQUEST = 6
const ADMIN_LOGIN_MAX_ATTEMPTS = 8
const ADMIN_LOGIN_WINDOW_SECONDS = 15 * 60
const ADMIN_LOGIN_BLOCK_SECONDS = 30 * 60
const SECURITY_RECORD_RETENTION_SECONDS = 30 * 24 * 60 * 60

let securityTablesReady = false

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const cors = buildCorsHeaders(req, env, url.pathname)

    try {
      if (url.pathname === "/stats") {
        return await handleStats(env)
      }

      if (
        req.method === "OPTIONS"
        && (url.pathname.startsWith("/v1/") || url.pathname === "/users")
      ) {
        return new Response(null, { status: 204, headers: cors })
      }

      if (url.pathname === "/v1/submissions" && req.method === "POST") {
        return await handleCreateSubmission(req, env, cors)
      }

      if (url.pathname === "/v1/users" && req.method === "GET") {
        return await handlePublicUsers(env, cors)
      }

      if (url.pathname === "/users" && req.method === "GET") {
        return await handleLegacyUsers(env, cors)
      }

      if (url.pathname === "/v1/health" && req.method === "GET") {
        return jsonResponse({ ok: true }, 200, cors)
      }

      if (url.pathname === "/v1/admin/login" && req.method === "POST") {
        assertOriginAllowed(req, env)
        return await handleAdminLogin(req, env, cors)
      }

      if (url.pathname === "/v1/admin/logout" && req.method === "POST") {
        assertOriginAllowed(req, env)
        return await handleAdminLogout(req, env, cors)
      }

      if (url.pathname === "/v1/admin/session" && req.method === "GET") {
        const admin = await assertAdmin(req, env)
        return jsonResponse({ ok: true, actor: admin.actor }, 200, cors)
      }

      if (url.pathname === "/v1/admin/submissions" && req.method === "GET") {
        await assertAdmin(req, env)
        return await handleAdminListSubmissions(req, env, cors)
      }

      if (url.pathname === "/v1/admin/export/users-json" && req.method === "GET") {
        await assertAdmin(req, env)
        return await handleAdminExportUsers(env, cors)
      }

      if (url.pathname === "/v1/admin/users" && req.method === "GET") {
        await assertAdmin(req, env)
        return await handleAdminListUsers(env, cors)
      }

      if (url.pathname.startsWith("/v1/admin/users/")) {
        const admin = await assertAdmin(req, env)
        const rawPath = url.pathname.slice("/v1/admin/users/".length)
        const parts = rawPath.split("/").filter(Boolean)
        const slug = decodeURIComponent(parts[0] || "")
        if (!slug) throw new HttpError(404, "User not found")

        if (parts.length === 1 && req.method === "GET") {
          return await handleAdminGetUser(env, slug, cors)
        }

        if (parts.length === 1 && req.method === "PUT") {
          assertOriginAllowed(req, env)
          return await handleAdminUpsertUser(req, env, slug, admin, cors)
        }

        if (parts.length === 1 && req.method === "DELETE") {
          assertOriginAllowed(req, env)
          return await handleAdminDeleteUser(env, slug, cors)
        }

        if (parts.length === 2 && parts[1] === "refresh-avatars" && req.method === "POST") {
          assertOriginAllowed(req, env)
          return await handleAdminRefreshUserAvatars(env, slug, admin, cors)
        }
      }

      if (url.pathname.startsWith("/v1/admin/submissions/")) {
        const admin = await assertAdmin(req, env)
        const submissionId = url.pathname.split("/").at(-1)
        if (!submissionId) throw new HttpError(404, "Submission not found")

        if (req.method === "GET") {
          return await handleAdminGetSubmission(env, submissionId, cors)
        }

        if (req.method === "PATCH") {
          assertOriginAllowed(req, env)
          return await handleAdminPatchSubmission(req, env, submissionId, admin, cors)
        }
      }

      return jsonResponse({ error: "Not found" }, 404, cors)
    } catch (error) {
      const status = Number(error?.status)
      if (Number.isInteger(status) && status >= 400 && status < 600) {
        return jsonResponse({ error: error.message || "Request failed" }, status, cors)
      }

      console.error("Unhandled error", error)
      return jsonResponse({ error: "Internal server error" }, 500, cors)
    }
  }
}

async function handleStats(env) {
  const openHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8"
  }

  const cached = await env.STATS?.get?.("stats")
  if (cached) return new Response(cached, { headers: openHeaders })

  const stats = await fetchStats(env)
  if (env.STATS?.put) {
    await env.STATS.put("stats", JSON.stringify(stats), { expirationTtl: 300 })
  }

  return new Response(JSON.stringify(stats), { headers: openHeaders })
}

async function handleCreateSubmission(req, env, cors) {
  assertDb(env)

  const requestPayload = await parseRequestJson(req)
  const now = unixNow()
  const normalized = validateAndNormalizeSubmission(requestPayload, now)
  const requestType = normalizeSubmissionRequestType(normalized?.requestType)

  const ipHash = await hashIp(req, env)
  const rateLimit = toPositiveInt(env.RATE_LIMIT_PER_HOUR, DEFAULT_RATE_LIMIT_PER_HOUR)
  await enforceRateLimit(env, ipHash, now, rateLimit)

  let turnstilePassed = 0
  const turnstileSecret = (env.TURNSTILE_SECRET_KEY || "").trim()
  if (turnstileSecret && requestType === SUBMISSION_REQUEST_TYPE_APPLICATION) {
    const token = readText(requestPayload, "turnstileToken", { required: true, max: 2048 })
    const passed = await verifyTurnstile(token, req, turnstileSecret)
    if (!passed) throw new HttpError(400, "Turnstile verification failed")
    turnstilePassed = 1
  }

  if (requestType === SUBMISSION_REQUEST_TYPE_APPLICATION) {
    const avatars = await fetchSubmissionAvatars(env, normalized)
    normalized.avatars = avatars
  }

  const submissionId = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO submissions
      (id, status, display_name, active_community, payload_json, turnstile_passed,
       ip_hash, origin, user_agent, created_at, updated_at)
      VALUES (?1, 'pending', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`
  )
    .bind(
      submissionId,
      normalized.displayName,
      normalized.activeCommunity,
      JSON.stringify(normalized),
      turnstilePassed,
      ipHash,
      req.headers.get("Origin"),
      req.headers.get("User-Agent"),
      now
    )
    .run()

  return jsonResponse(
    {
      ok: true,
      id: submissionId,
      status: "pending",
      message: "Submission received."
    },
    201,
    cors
  )
}

async function handlePublicUsers(env, cors) {
  assertDb(env)

  const { results } = await env.DB.prepare(
    "SELECT slug, user_id, user_json FROM users ORDER BY slug ASC"
  ).all()

  const users = {}
  for (const row of results || []) {
    try {
      const parsedUser = JSON.parse(row.user_json)
      if (!parsedUser || typeof parsedUser !== "object" || Array.isArray(parsedUser)) continue

      const sanitizedUser = structuredClone(parsedUser)
      const avatars = resolveUserAvatars(sanitizedUser)
      sanitizedUser.avatars = {
        discord: avatars.discord,
        reddit: avatars.reddit
      }
      sanitizedUser.avatarUrl = avatars.primary || DEFAULT_AVATAR_URL
      users[row.slug] = sanitizedUser
    } catch {
      // Ignore malformed records rather than failing the whole response.
    }
  }

  return jsonResponse({ users, count: Object.keys(users).length }, 200, cors)
}

async function handleLegacyUsers(env, cors) {
  const cached = await env.STATS?.get?.(LEGACY_USERS_CACHE_KEY)
  if (cached) {
    return new Response(cached, {
      headers: {
        ...cors,
        "Content-Type": "application/json; charset=utf-8"
      }
    })
  }

  let sourceUsers
  try {
    sourceUsers = await fetchSourceUsers(env)
  } catch {
    return jsonResponse({ error: "Failed to fetch users source" }, 502, cors)
  }

  const users = {}
  const now = unixNow()
  let lookupsUsed = 0
  for (const [slug, user] of Object.entries(sourceUsers || {})) {
    if (!user || typeof user !== "object" || Array.isArray(user)) continue
    try {
      const enrichedUser = structuredClone(user)
      const allowLookup = lookupsUsed < MAX_PUBLIC_AVATAR_LOOKUPS_PER_REQUEST
      const enrichment = await enrichUserJsonWithAvatars(env, enrichedUser, {
        now,
        allowLookup
      })
      lookupsUsed += enrichment.lookupsPerformed

      const avatars = resolveUserAvatars(enrichedUser)
      enrichedUser.avatars = {
        discord: avatars.discord,
        reddit: avatars.reddit
      }
      enrichedUser.avatarUrl = avatars.primary || DEFAULT_AVATAR_URL
      users[slug] = enrichedUser
    } catch {
      users[slug] = user
    }
  }

  const payload = {
    users,
    count: Object.keys(users).length,
    timestamp: now
  }
  if (env.STATS?.put) {
    await env.STATS.put(LEGACY_USERS_CACHE_KEY, JSON.stringify(payload), {
      expirationTtl: LEGACY_USERS_CACHE_TTL_SECONDS
    })
  }
  return jsonResponse(payload, 200, cors)
}

async function fetchSourceUsers(env) {
  const sourceUrl = (env.USERS_SOURCE_URL || DEFAULT_USERS_SOURCE_URL).trim()
  let parsedUrl
  try {
    parsedUrl = new URL(sourceUrl)
  } catch {
    throw new Error("Invalid users source URL")
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Users source URL must use HTTPS")
  }

  const allowedHosts = getAllowedUsersSourceHosts(env)
  if (!allowedHosts.has(parsedUrl.hostname.toLowerCase())) {
    throw new Error("Users source host is not allowed")
  }

  const response = await fetch(parsedUrl.toString(), {
    headers: {
      "User-Agent": "teenarazzi-backend/1.0 (+https://teenarazzi.com)"
    }
  })
  if (!response.ok) {
    throw new Error(`Source users fetch failed: ${response.status}`)
  }

  const contentLengthHeader = response.headers.get("Content-Length")
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader)
    if (Number.isFinite(contentLength) && contentLength > MAX_USERS_SOURCE_BYTES) {
      throw new Error("Users source payload is too large")
    }
  }

  const bodyText = await response.text()
  if (bodyText.length > MAX_USERS_SOURCE_BYTES) {
    throw new Error("Users source payload is too large")
  }

  let data
  try {
    data = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    throw new Error("Invalid users source JSON")
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid users source payload")
  }
  if (data.users && typeof data.users === "object" && !Array.isArray(data.users)) {
    return data.users
  }
  return data
}

function getAllowedUsersSourceHosts(env) {
  const configured = (env.USERS_SOURCE_ALLOWED_HOSTS || "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)

  if (configured.length > 0) {
    return new Set(configured)
  }
  return new Set(DEFAULT_USERS_SOURCE_ALLOWED_HOSTS)
}

async function handleAdminLogin(req, env, cors) {
  await ensureSecurityTables(env)

  const expectedPassword = (env.ADMIN_PANEL_PASSWORD || "").trim()
  if (!expectedPassword) throw new HttpError(500, "Admin password is not configured")

  const secret = (env.ADMIN_SESSION_SECRET || "").trim()
  if (!secret) throw new HttpError(500, "Admin session secret is not configured")

  const now = unixNow()
  const ipHash = await hashIp(req, env)
  await assertAdminLoginAllowed(env, ipHash, now)

  const payload = await parseRequestJson(req)
  const password = readText(payload, "password", { required: true, max: 200 })
  const isValid = await secureCompare(password, expectedPassword)
  if (!isValid) {
    await recordFailedAdminLogin(env, ipHash, now)
    return jsonResponse({ error: "Invalid credentials" }, 401, cors)
  }

  await clearAdminLoginAttempts(env, ipHash)

  const sessionId = crypto.randomUUID()
  const sessionExpiresAt = now + SESSION_TTL_SECONDS
  await createAdminSession(env, sessionId, sessionExpiresAt, now)
  const sessionToken = await createSessionToken(secret, now, sessionId)
  return jsonResponse(
    { ok: true },
    200,
    cors,
    { "Set-Cookie": buildSessionCookie(sessionToken) }
  )
}

async function handleAdminLogout(req, env, cors) {
  const secret = (env.ADMIN_SESSION_SECRET || "").trim()
  const cookieHeader = req.headers.get("Cookie") || ""
  if (secret && cookieHeader && env.DB?.prepare) {
    await ensureSecurityTables(env)
    const cookies = parseCookies(cookieHeader)
    const sessionToken = cookies[SESSION_COOKIE_NAME]
    if (sessionToken) {
      const payload = await verifySessionToken(sessionToken, secret, unixNow())
      const sessionId = typeof payload?.sid === "string" ? payload.sid.trim() : ""
      if (sessionId) {
        await revokeAdminSession(env, sessionId, unixNow())
      }
    }
  }

  return jsonResponse({ ok: true }, 200, cors, {
    "Set-Cookie": clearSessionCookie()
  })
}

async function handleAdminListSubmissions(req, env, cors) {
  assertDb(env)

  const url = new URL(req.url)
  const status = (url.searchParams.get("status") || "pending").trim()
  const limit = clamp(toPositiveInt(url.searchParams.get("limit"), 20), 1, 100)
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0)

  let statement
  if (status === "all") {
    statement = env.DB.prepare(
      `SELECT id, status, display_name, active_community, created_at, updated_at, origin, payload_json
       FROM submissions
       ORDER BY created_at DESC
       LIMIT ?1 OFFSET ?2`
    ).bind(limit, offset)
  } else {
    if (!STATUS_VALUES.has(status)) throw new HttpError(400, "Invalid status filter")
    statement = env.DB.prepare(
      `SELECT id, status, display_name, active_community, created_at, updated_at, origin, payload_json
       FROM submissions
       WHERE status = ?1
       ORDER BY created_at DESC
       LIMIT ?2 OFFSET ?3`
    ).bind(status, limit, offset)
  }

  const { results } = await statement.all()
  const submissions = (results || []).map(formatAdminSubmissionRow)
  return jsonResponse({ submissions }, 200, cors)
}

async function handleAdminGetSubmission(env, submissionId, cors) {
  assertDb(env)

  const row = await env.DB.prepare(
    "SELECT * FROM submissions WHERE id = ?1 LIMIT 1"
  )
    .bind(submissionId)
    .first()

  if (!row) throw new HttpError(404, "Submission not found")
  const parsedPayload = safeJsonParse(row.payload_json)
  const summary = summarizeSubmissionPayload(parsedPayload)

  return jsonResponse(
    {
      submission: {
        ...row,
        payload: parsedPayload,
        request_type: summary.requestType,
        changed_fields_count: summary.changedFieldsCount,
        target_user_slug: summary.targetUserSlug
      }
    },
    200,
    cors
  )
}

async function handleAdminPatchSubmission(req, env, submissionId, admin, cors) {
  assertDb(env)

  const existing = await env.DB.prepare(
    "SELECT * FROM submissions WHERE id = ?1 LIMIT 1"
  )
    .bind(submissionId)
    .first()

  if (!existing) throw new HttpError(404, "Submission not found")

  const payload = await parseRequestJson(req)
  const status = readText(payload, "status", { required: true, max: 16 })
  if (!STATUS_VALUES.has(status)) throw new HttpError(400, "Invalid status value")

  const reviewNote = readText(payload, "reviewNote", { required: false, max: 1000 }) || null
  const reviewedBy = readText(payload, "reviewedBy", { required: false, max: 80 }) || admin.actor
  const promoteToUsers = Boolean(payload.promoteToUsers)
  const requestedSlug = readText(payload, "slug", { required: false, max: 120 })
  const now = unixNow()

  const existingPayload = safeJsonParse(existing.payload_json)
  const existingRequestType = normalizeSubmissionRequestType(existingPayload?.requestType)
  let nextPayload = existingPayload
  if (payload.submissionData !== undefined) {
    if (existingRequestType === SUBMISSION_REQUEST_TYPE_EDIT) {
      throw new HttpError(400, "Edit requests cannot update submissionData")
    }

    const submissionData = payload.submissionData
    if (!submissionData || typeof submissionData !== "object" || Array.isArray(submissionData)) {
      throw new HttpError(400, "submissionData must be a JSON object")
    }

    const mergedSubmissionData = {
      ...submissionData,
      // Keep required fields valid even if omitted by older admin clients.
      middyGoat: (
        typeof submissionData.middyGoat === "string" && submissionData.middyGoat.trim()
      )
        ? submissionData.middyGoat
        : (typeof nextPayload?.middyGoat === "string" ? nextPayload.middyGoat : "yes"),
      website: typeof submissionData.website === "string" ? submissionData.website : ""
    }

    const normalized = validateAndNormalizeSubmission(
      mergedSubmissionData,
      Number(existing.created_at) || now
    )
    if (normalizeSubmissionRequestType(normalized?.requestType) !== SUBMISSION_REQUEST_TYPE_APPLICATION) {
      throw new HttpError(400, "submissionData update must remain an application request")
    }
    normalized.avatars = await fetchSubmissionAvatars(env, normalized)
    nextPayload = normalized
  }

  const nextRequestType = normalizeSubmissionRequestType(nextPayload?.requestType)
  const payloadDisplayName = typeof nextPayload?.displayName === "string"
    ? nextPayload.displayName.trim()
    : ""
  const payloadCommunity = typeof nextPayload?.activeCommunity === "string"
    ? nextPayload.activeCommunity.trim()
    : ""
  const nextDisplayName = payloadDisplayName || existing.display_name
  const nextActiveCommunity = COMMUNITY_VALUES.has(payloadCommunity)
    ? payloadCommunity
    : existing.active_community
  const nextPayloadJson = payload.submissionData !== undefined
    ? JSON.stringify(nextPayload)
    : existing.payload_json

  await env.DB.prepare(
    `UPDATE submissions
      SET status = ?1,
          review_note = ?2,
          reviewed_by = ?3,
          reviewed_at = ?4,
          display_name = ?5,
          active_community = ?6,
          payload_json = ?7,
          updated_at = ?4
      WHERE id = ?8`
  )
    .bind(
      status,
      reviewNote,
      reviewedBy,
      now,
      nextDisplayName,
      nextActiveCommunity,
      nextPayloadJson,
      submissionId
    )
    .run()

  const updatedSubmission = {
    ...existing,
    display_name: nextDisplayName,
    active_community: nextActiveCommunity,
    payload_json: nextPayloadJson
  }

  let createdUserSlug = null
  if (
    status === "approved"
    && promoteToUsers
    && nextRequestType === SUBMISSION_REQUEST_TYPE_APPLICATION
  ) {
    createdUserSlug = await upsertUserFromSubmission(env, updatedSubmission, requestedSlug, now)
  }

  return jsonResponse(
    {
      ok: true,
      id: submissionId,
      status,
      userSlug: createdUserSlug,
      requestType: nextRequestType
    },
    200,
    cors
  )
}

async function handleAdminListUsers(env, cors) {
  assertDb(env)
  const { results } = await env.DB.prepare(
    "SELECT slug, user_id, source, updated_at, user_json FROM users ORDER BY slug ASC"
  ).all()

  const users = []
  for (const row of results || []) {
    const parsedUser = safeJsonParse(row.user_json)
    const avatars = resolveUserAvatars(parsedUser)
    users.push({
      slug: row.slug,
      user_id: row.user_id,
      source: row.source,
      updated_at: row.updated_at,
      avatar_url: avatars.primary,
      discord_avatar_url: avatars.discord,
      reddit_avatar_url: avatars.reddit
    })
  }

  return jsonResponse({ users }, 200, cors)
}

async function handleAdminGetUser(env, slug, cors) {
  assertDb(env)

  const row = await env.DB.prepare(
    "SELECT slug, user_id, user_json, source, created_at, updated_at FROM users WHERE slug = ?1 LIMIT 1"
  )
    .bind(slug)
    .first()

  if (!row) throw new HttpError(404, "User not found")

  return jsonResponse(
    {
      slug: row.slug,
      userId: row.user_id,
      source: row.source,
      updatedAt: row.updated_at,
      user: safeJsonParse(row.user_json)
    },
    200,
    cors
  )
}

async function handleAdminUpsertUser(req, env, slug, admin, cors) {
  assertDb(env)

  const normalizedSlug = sanitizeSlug(slug)
  if (normalizedSlug !== slug) {
    throw new HttpError(400, "Slug contains invalid characters")
  }

  const payload = await parseRequestJson(req)
  const user = payload?.user
  if (!user || typeof user !== "object" || Array.isArray(user)) {
    throw new HttpError(400, "user must be a JSON object")
  }

  const userId = typeof user.id === "string" ? user.id.trim() : ""
  if (!userId) throw new HttpError(400, "user.id is required")

  const { links: _ignoredLinks, ...userWithoutLinks } = user
  const now = unixNow()
  const normalizedUser = {
    ...userWithoutLinks,
    id: userId,
    timestamp: Number(user.timestamp) || now
  }
  await enrichUserJsonWithAvatars(env, normalizedUser)

  const userJson = JSON.stringify(normalizedUser)
  if (userJson.length > MAX_USER_JSON_BYTES) {
    throw new HttpError(400, "User payload is too large")
  }

  await env.DB.prepare(
    `INSERT INTO users (slug, user_id, user_json, source, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?5)
      ON CONFLICT(slug) DO UPDATE SET
        user_id = excluded.user_id,
        user_json = excluded.user_json,
        source = excluded.source,
        updated_at = excluded.updated_at`
  )
    .bind(normalizedSlug, userId, userJson, `admin:${admin.actor}`, now)
    .run()

  return jsonResponse({ ok: true, slug: normalizedSlug }, 200, cors)
}

async function handleAdminDeleteUser(env, slug, cors) {
  assertDb(env)

  const existing = await env.DB.prepare(
    "SELECT slug FROM users WHERE slug = ?1 LIMIT 1"
  )
    .bind(slug)
    .first()

  if (!existing) throw new HttpError(404, "User not found")

  await env.DB.prepare("DELETE FROM users WHERE slug = ?1")
    .bind(slug)
    .run()

  return jsonResponse({ ok: true, slug }, 200, cors)
}

async function handleAdminRefreshUserAvatars(env, slug, admin, cors) {
  assertDb(env)

  const row = await env.DB.prepare(
    "SELECT slug, user_id, user_json FROM users WHERE slug = ?1 LIMIT 1"
  )
    .bind(slug)
    .first()

  if (!row) throw new HttpError(404, "User not found")

  const user = safeJsonParse(row.user_json)
  if (!user || typeof user !== "object") {
    throw new HttpError(500, "Stored user JSON is invalid")
  }

  const now = unixNow()
  await enrichUserJsonWithAvatars(env, user, { force: true })
  user.timestamp = Number(user.timestamp) || now

  const serialized = JSON.stringify(user)
  if (serialized.length > MAX_USER_JSON_BYTES) {
    throw new HttpError(400, "User payload is too large")
  }

  await env.DB.prepare(
    `UPDATE users
      SET user_json = ?1, source = ?2, updated_at = ?3
      WHERE slug = ?4`
  )
    .bind(serialized, `admin:${admin.actor}:refresh-avatars`, now, slug)
    .run()

  const avatars = resolveUserAvatars(user)
  return jsonResponse(
    {
      ok: true,
      slug,
      avatars: {
        discord: avatars.discord,
        reddit: avatars.reddit,
        primary: avatars.primary
      }
    },
    200,
    cors
  )
}

async function handleAdminExportUsers(env, cors) {
  assertDb(env)

  const { results } = await env.DB.prepare(
    "SELECT slug, user_json FROM users ORDER BY slug ASC"
  ).all()

  const users = {}
  for (const row of results || []) {
    users[row.slug] = safeJsonParse(row.user_json)
  }

  return jsonResponse({ users }, 200, cors)
}

function normalizeSubmissionRequestType(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (normalized === SUBMISSION_REQUEST_TYPE_EDIT || normalized === "edit_request") {
    return SUBMISSION_REQUEST_TYPE_EDIT
  }
  return SUBMISSION_REQUEST_TYPE_APPLICATION
}

function summarizeSubmissionPayload(payload) {
  const requestType = normalizeSubmissionRequestType(payload?.requestType)
  if (requestType !== SUBMISSION_REQUEST_TYPE_EDIT) {
    return {
      requestType,
      changedFieldsCount: 0,
      targetUserSlug: null
    }
  }

  const changedFieldsCount = Array.isArray(payload?.changedFields)
    ? payload.changedFields.length
    : 0
  const targetUserSlug = typeof payload?.targetUser?.slug === "string"
    ? payload.targetUser.slug.trim()
    : ""

  return {
    requestType,
    changedFieldsCount,
    targetUserSlug: targetUserSlug || null
  }
}

function formatAdminSubmissionRow(row) {
  const parsedPayload = safeJsonParse(row.payload_json)
  const summary = summarizeSubmissionPayload(parsedPayload)

  return {
    id: row.id,
    status: row.status,
    display_name: row.display_name,
    active_community: row.active_community,
    created_at: row.created_at,
    updated_at: row.updated_at,
    origin: row.origin,
    request_type: summary.requestType,
    changed_fields_count: summary.changedFieldsCount,
    target_user_slug: summary.targetUserSlug
  }
}

function validateAndNormalizeSubmission(payload, now) {
  const requestType = normalizeSubmissionRequestType(payload?.requestType)
  if (requestType === SUBMISSION_REQUEST_TYPE_EDIT) {
    return validateAndNormalizeEditSubmission(payload, now)
  }
  return validateAndNormalizeApplicationSubmission(payload, now)
}

function validateAndNormalizeApplicationSubmission(payload, now) {
  const displayName = readText(payload, "displayName", { required: true, max: 80 })
  const activeCommunity = readText(payload, "activeCommunity", { required: true, max: 12 })
  if (!COMMUNITY_VALUES.has(activeCommunity)) {
    throw new HttpError(400, "activeCommunity must be discord, reddit, or both")
  }

  if (readText(payload, "website", { required: false, max: 300 })) {
    throw new HttpError(400, "Spam detected")
  }

  const discordUsername = readText(payload, "discordUsername", { required: false, max: 80 })
  const redditUsername = readText(payload, "redditUsername", { required: false, max: 80 })

  if ((activeCommunity === "discord" || activeCommunity === "both") && !discordUsername) {
    throw new HttpError(400, "Discord username is required")
  }

  if ((activeCommunity === "reddit" || activeCommunity === "both") && !redditUsername) {
    throw new HttpError(400, "Reddit username is required")
  }

  const description = readText(payload, "description", { required: true, max: 4000 })
  const middyGoat = readText(payload, "middyGoat", { required: true, max: 8 }).toLowerCase()
  if (middyGoat !== "yes" && middyGoat !== "no") {
    throw new HttpError(400, "middyGoat must be yes or no")
  }

  const ageText = readText(payload, "age", { required: false, max: 3 })
  let age = null
  if (ageText) {
    age = Number(ageText)
    if (!Number.isFinite(age) || age < 0 || age > 120) {
      throw new HttpError(400, "Age must be between 0 and 120")
    }
    age = Math.floor(age)
  }

  return {
    requestType: SUBMISSION_REQUEST_TYPE_APPLICATION,
    displayName,
    activeCommunity,
    nicknames: parseCsv(readText(payload, "nicknames", { required: false, max: 300 }), 20, 60),
    socials: {
      discord: {
        current: discordUsername || null,
        old: parseCsv(readText(payload, "discordOldUsernames", { required: false, max: 500 }), 20, 80)
      },
      reddit: {
        current: redditUsername || null,
        old: parseCsv(readText(payload, "redditOldUsernames", { required: false, max: 500 }), 20, 80)
      }
    },
    description,
    extraDetails: readText(payload, "extraDetails", { required: false, max: 4000 }) || null,
    details: {
      pronouns: readText(payload, "pronouns", { required: false, max: 80 }) || null,
      sexuality: readText(payload, "sexuality", { required: false, max: 80 }) || null,
      age,
      birthday: readText(payload, "birthday", { required: false, max: 120 }) || null
    },
    middyGoat,
    submittedAt: now
  }
}

function validateAndNormalizeEditSubmission(payload, now) {
  if (readText(payload, "website", { required: false, max: 300 })) {
    throw new HttpError(400, "Spam detected")
  }

  const targetUserSlug = normalizeTargetUserSlug(
    readText(payload, "targetUserSlug", { required: true, max: 120 })
  )
  const targetDisplayName = readText(payload, "targetDisplayName", { required: false, max: 80 })
    || readText(payload, "displayName", { required: true, max: 80 })
  const activeCommunityRaw = readText(payload, "activeCommunity", { required: false, max: 12 }).toLowerCase()
  const activeCommunity = COMMUNITY_VALUES.has(activeCommunityRaw) ? activeCommunityRaw : "both"

  const changedFields = payload?.changedFields
  if (!Array.isArray(changedFields)) {
    throw new HttpError(400, "changedFields must be an array")
  }
  if (changedFields.length === 0) {
    throw new HttpError(400, "At least one changed field is required")
  }
  if (changedFields.length > EDIT_REQUEST_MAX_CHANGED_FIELDS) {
    throw new HttpError(400, "Too many changed fields")
  }

  const seenFields = new Set()
  const normalizedChanges = []
  for (let index = 0; index < changedFields.length; index += 1) {
    const change = changedFields[index]
    if (!change || typeof change !== "object" || Array.isArray(change)) {
      throw new HttpError(400, `changedFields[${index}] must be an object`)
    }

    const field = readText(change, "field", { required: true, max: 80 })
    const fieldKey = field.toLowerCase()
    if (seenFields.has(fieldKey)) continue

    const label = readText(change, "label", { required: false, max: 120 }) || field
    const from = normalizeEditChangeValue(change.from, `changedFields[${index}].from`)
    const to = normalizeEditChangeValue(change.to, `changedFields[${index}].to`)
    if (from === to) continue

    seenFields.add(fieldKey)
    normalizedChanges.push({
      field,
      label,
      from,
      to
    })
  }

  if (normalizedChanges.length === 0) {
    throw new HttpError(400, "No valid changed fields were provided")
  }

  return {
    requestType: SUBMISSION_REQUEST_TYPE_EDIT,
    displayName: targetDisplayName,
    activeCommunity,
    description: `Edit request for ${targetUserSlug}`,
    extraDetails: readText(payload, "extraDetails", { required: false, max: 4000 }) || null,
    targetUser: {
      slug: targetUserSlug,
      displayName: targetDisplayName
    },
    changedFields: normalizedChanges,
    middyGoat: "yes",
    submittedAt: now
  }
}

function normalizeTargetUserSlug(input) {
  const normalized = (input || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "")
  if (!normalized) throw new HttpError(400, "targetUserSlug is invalid")
  return normalized
}

function normalizeEditChangeValue(value, fieldName) {
  if (value === null || value === undefined) return ""

  let normalizedValue = ""
  if (typeof value === "string") {
    normalizedValue = value.trim()
  } else if (typeof value === "number" || typeof value === "boolean") {
    normalizedValue = String(value)
  } else {
    throw new HttpError(400, `${fieldName} must be a string`)
  }

  if (normalizedValue.length > 4000) {
    throw new HttpError(400, `${fieldName} is too long`)
  }
  return normalizedValue
}

async function upsertUserFromSubmission(env, submission, requestedSlug, now) {
  const payload = safeJsonParse(submission.payload_json)
  if (!payload || typeof payload !== "object") {
    throw new HttpError(500, "Invalid submission payload")
  }

  const displayName = payload.displayName || submission.display_name
  const baseSlug = sanitizeSlug(requestedSlug || displayName || submission.id.slice(0, 8))
  const uniqueSlug = await findUniqueSlug(env, baseSlug)

  const discordCurrent = payload?.socials?.discord?.current || null
  const discordOld = Array.isArray(payload?.socials?.discord?.old) ? payload.socials.discord.old : []
  const redditCurrent = payload?.socials?.reddit?.current || null
  const redditOld = Array.isArray(payload?.socials?.reddit?.old) ? payload.socials.reddit.old : []
  const nicknames = Array.isArray(payload.nicknames) ? payload.nicknames : []
  const submissionAvatars = payload?.avatars && typeof payload.avatars === "object"
    ? payload.avatars
    : {}

  const noteParts = []
  if (payload.extraDetails) noteParts.push(payload.extraDetails)

  const ageValue = payload?.details?.age ?? null
  const ageTimestamp = ageValue === null ? null : now

  const userJson = {
    id: displayName,
    avatarUrl: submissionAvatars.discord || submissionAvatars.reddit || "https://cdn.discordapp.com/embed/avatars/0.png",
    avatars: {
      discord: submissionAvatars.discord || null,
      reddit: submissionAvatars.reddit || null
    },
    notes: noteParts.length > 0 ? noteParts.join("\n") : null,
    usernames: {
      discord: discordCurrent ? [discordCurrent, ...discordOld] : [null],
      reddit: redditCurrent ? [redditCurrent, ...redditOld] : [null]
    },
    nicknames: nicknames.length > 0 ? nicknames : [null],
    description: payload.description || "",
    pronouns: payload?.details?.pronouns ?? null,
    sexuality: payload?.details?.sexuality ?? null,
    age: {
      value: ageValue,
      timestamp: ageTimestamp
    },
    birthday: payload?.details?.birthday ?? null,
    timestamp: now
  }
  await enrichUserJsonWithAvatars(env, userJson)

  await env.DB.prepare(
    `INSERT INTO users (slug, user_id, user_json, source, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?5)
      ON CONFLICT(slug) DO UPDATE SET
        user_id = excluded.user_id,
        user_json = excluded.user_json,
        source = excluded.source,
        updated_at = excluded.updated_at`
  )
    .bind(
      uniqueSlug,
      displayName,
      JSON.stringify(userJson),
      `submission:${submission.id}`,
      now
    )
    .run()

  return uniqueSlug
}

async function findUniqueSlug(env, baseSlug) {
  let suffix = 0
  while (suffix < 500) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}_${suffix + 1}`
    const exists = await env.DB.prepare(
      "SELECT slug FROM users WHERE slug = ?1 LIMIT 1"
    )
      .bind(candidate)
      .first()
    if (!exists) return candidate
    suffix += 1
  }
  throw new HttpError(500, "Unable to generate unique slug")
}

function sanitizeSlug(input) {
  const base = (input || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "")
  return base || `user_${crypto.randomUUID().slice(0, 8)}`
}

async function fetchSubmissionAvatars(env, normalizedSubmission) {
  const discordUsername = normalizedSubmission?.socials?.discord?.current || ""
  const redditUsername = normalizedSubmission?.socials?.reddit?.current || ""

  const [discordAvatar, redditAvatar] = await Promise.all([
    fetchDiscordAvatarByUsername(env, discordUsername),
    fetchRedditAvatarByUsername(redditUsername)
  ])

  return {
    discord: discordAvatar,
    reddit: redditAvatar
  }
}

async function enrichUserJsonWithAvatars(env, user, options = {}) {
  if (!user || typeof user !== "object") {
    return {
      lookupsPerformed: 0
    }
  }
  const { force = false, allowLookup = true } = options
  const now = Number(options.now) || unixNow()
  const avatars = user.avatars && typeof user.avatars === "object"
    ? { ...user.avatars }
    : { discord: null, reddit: null }
  const avatarLookup = user.avatarLookup && typeof user.avatarLookup === "object"
    ? { ...user.avatarLookup }
    : {}

  const fallbackAvatar = cleanUrl(user.avatarUrl) || null
  if (!cleanUrl(avatars.discord) && fallbackAvatar && isDiscordAvatarUrl(fallbackAvatar)) {
    avatars.discord = fallbackAvatar
  }
  if (!cleanUrl(avatars.reddit) && fallbackAvatar && isRedditAvatarUrl(fallbackAvatar)) {
    avatars.reddit = fallbackAvatar
  }

  const discordUsername = getPrimaryUsername(user?.usernames?.discord)
  const discordUserId = parseDiscordUserId(user?.links?.discord)
  const redditUsername = getPrimaryRedditUsername(user)
  let lookupsPerformed = 0

  if (allowLookup && shouldLookupAvatar(avatars.discord, avatarLookup.discordCheckedAt, force, now)) {
    avatars.discord = await fetchDiscordAvatar(env, {
      userId: discordUserId,
      username: discordUsername
    })
    avatarLookup.discordCheckedAt = now
    lookupsPerformed += 1
  }

  if (allowLookup && shouldLookupAvatar(avatars.reddit, avatarLookup.redditCheckedAt, force, now)) {
    avatars.reddit = await fetchRedditAvatarByUsername(redditUsername)
    avatarLookup.redditCheckedAt = now
    lookupsPerformed += 1
  }

  user.avatars = {
    discord: avatars.discord || null,
    reddit: avatars.reddit || null
  }
  user.avatarLookup = avatarLookup

  user.avatarUrl = avatars.discord || fallbackAvatar || avatars.reddit || "https://cdn.discordapp.com/embed/avatars/0.png"

  return {
    lookupsPerformed
  }
}

function shouldLookupAvatar(avatarUrl, checkedAt, force, now) {
  if (force) return true
  if (cleanUrl(avatarUrl)) return false
  const lastChecked = Number(checkedAt)
  if (!Number.isFinite(lastChecked) || lastChecked <= 0) return true
  return now - lastChecked >= AVATAR_LOOKUP_RETRY_SECONDS
}

function resolveUserAvatars(user) {
  if (!user || typeof user !== "object") {
    return {
      discord: null,
      reddit: null,
      primary: null
    }
  }

  const discord = cleanUrl(user?.avatars?.discord) || null
  const reddit = cleanUrl(user?.avatars?.reddit) || null
  const primary = cleanUrl(user?.avatarUrl) || discord || reddit || null

  return {
    discord,
    reddit,
    primary
  }
}

function getPrimaryUsername(list) {
  if (!Array.isArray(list)) return ""
  for (const value of list) {
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return ""
}

function getPrimaryRedditUsername(user) {
  return normalizeRedditUsername(getPrimaryUsername(user?.usernames?.reddit))
}

function parseDiscordUserId(discordLink) {
  const link = cleanUrl(discordLink)
  if (!link) return ""
  const match = link.match(/discord\.com\/users\/(\d{6,25})/i)
  return match?.[1] || ""
}

function cleanUrl(value) {
  if (typeof value !== "string") return ""
  return value.trim()
}

function isDiscordAvatarUrl(value) {
  const cleaned = cleanUrl(value).toLowerCase()
  return cleaned.includes("cdn.discordapp.com")
}

function isRedditAvatarUrl(value) {
  const cleaned = cleanUrl(value).toLowerCase()
  return cleaned.includes("redditmedia.com")
    || cleaned.includes("i.redd.it")
    || cleaned.includes("redditstatic.com/avatars")
}

function normalizeAvatarUrl(value) {
  const cleaned = cleanUrl(value)
  if (!cleaned) return ""
  return cleaned.replaceAll("&amp;", "&")
}

function normalizeRedditUsername(value) {
  if (typeof value !== "string") return ""
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?reddit\.com\/?/i, "")
    .replace(/^\/+/, "")
    .replace(/^u\//i, "")
    .replace(/^user\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
}

async function fetchRedditAvatarByUsername(rawUsername) {
  const username = normalizeRedditUsername(rawUsername)
  if (!username) return null

  try {
    const res = await fetch(`https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`, {
      headers: { "User-Agent": "teenarazzi/1.0 (+https://teenarazzi.com)" }
    })
    if (!res.ok) return null
    const data = await res.json()
    const icon = normalizeAvatarUrl(data?.data?.icon_img)
    const snoovatar = normalizeAvatarUrl(data?.data?.snoovatar_img)
    return icon || snoovatar || null
  } catch {
    return null
  }
}

function normalizeDiscordUsername(value) {
  if (typeof value !== "string") return ""
  return value.trim().replace(/^@/, "").toLowerCase()
}

async function fetchDiscordAvatar(env, { userId, username }) {
  const normalizedUserId = cleanUrl(userId)
  if (normalizedUserId) {
    const byUserId = await fetchDiscordAvatarByUserId(env, normalizedUserId)
    if (byUserId) return byUserId
  }

  return fetchDiscordAvatarByUsername(env, username)
}

function buildDiscordAvatarUrl(user) {
  if (!user || typeof user !== "object" || !user.id) return null

  if (user.avatar) {
    const ext = String(user.avatar).startsWith("a_") ? "gif" : "png"
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=4096`
  }

  const discriminator = Number(user.discriminator)
  let index = 0
  if (Number.isFinite(discriminator) && discriminator > 0) {
    index = discriminator % 5
  } else {
    try {
      index = Number((BigInt(user.id) >> 22n) % 6n)
    } catch {
      index = 0
    }
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`
}

function scoreDiscordSearchMatch(member, wanted) {
  const user = member?.user
  if (!user) return 0

  const normalizedWanted = normalizeDiscordUsername(wanted)
  if (!normalizedWanted) return 0

  const candidates = []
  const username = normalizeDiscordUsername(user.username || "")
  const globalName = normalizeDiscordUsername(user.global_name || "")
  const nick = normalizeDiscordUsername(member.nick || "")
  const withDiscriminator = user.discriminator && user.discriminator !== "0"
    ? `${username}#${String(user.discriminator).trim().toLowerCase()}`
    : ""

  if (username) candidates.push({ value: username, score: 120 })
  if (globalName) candidates.push({ value: globalName, score: 90 })
  if (nick) candidates.push({ value: nick, score: 80 })
  if (withDiscriminator) candidates.push({ value: withDiscriminator, score: 140 })

  let best = 0
  for (const candidate of candidates) {
    if (candidate.value === normalizedWanted) {
      best = Math.max(best, candidate.score)
      continue
    }
    if (candidate.value.startsWith(normalizedWanted)) {
      best = Math.max(best, candidate.score - 20)
      continue
    }
    if (normalizedWanted.startsWith(candidate.value)) {
      best = Math.max(best, candidate.score - 30)
    }
  }
  return best
}

async function fetchDiscordAvatarByUserId(env, userId) {
  const id = cleanUrl(userId)
  if (!id) return null

  const botToken = (env.DISCORD_BOT_TOKEN || "").trim()
  if (!botToken) return null

  try {
    const res = await fetch(`https://discord.com/api/v10/users/${encodeURIComponent(id)}`, {
      headers: {
        Authorization: `Bot ${botToken}`
      }
    })
    if (!res.ok) return null

    const user = await res.json()
    return buildDiscordAvatarUrl(user)
  } catch {
    return null
  }
}

async function fetchDiscordAvatarByUsername(env, rawUsername) {
  const username = normalizeDiscordUsername(rawUsername)
  if (!username) return null
  const searchQuery = username.split("#")[0].trim()
  if (!searchQuery) return null

  const botToken = (env.DISCORD_BOT_TOKEN || "").trim()
  if (!botToken) return null

  const guildId = (env.DISCORD_GUILD_ID || DEFAULT_DISCORD_GUILD_ID).trim()
  if (!guildId) return null

  try {
    const query = encodeURIComponent(searchQuery.slice(0, 32))
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${query}&limit=25`,
      {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      }
    )
    if (!res.ok) return null
    const members = await res.json()
    if (!Array.isArray(members) || members.length === 0) return null

    let bestMember = null
    let bestScore = 0
    for (const member of members) {
      const score = scoreDiscordSearchMatch(member, username)
      if (score > bestScore) {
        bestMember = member
        bestScore = score
      }
    }

    if (!bestMember || bestScore < 60) return null
    return buildDiscordAvatarUrl(bestMember.user)
  } catch {
    return null
  }
}

async function enforceRateLimit(env, ipHash, now, maxPerHour) {
  const bucketHour = Math.floor(now / 3600)

  await env.DB.prepare(
    `INSERT INTO rate_limits (ip_hash, bucket_hour, count, updated_at)
      VALUES (?1, ?2, 1, ?3)
      ON CONFLICT(ip_hash, bucket_hour) DO UPDATE SET
        count = count + 1,
        updated_at = excluded.updated_at`
  )
    .bind(ipHash, bucketHour, now)
    .run()

  const row = await env.DB.prepare(
    "SELECT count FROM rate_limits WHERE ip_hash = ?1 AND bucket_hour = ?2"
  )
    .bind(ipHash, bucketHour)
    .first()

  if ((row?.count || 0) > maxPerHour) {
    throw new HttpError(429, "Too many submissions. Try again later.")
  }

  await env.DB.prepare("DELETE FROM rate_limits WHERE bucket_hour < ?1")
    .bind(bucketHour - 72)
    .run()
}

async function verifyTurnstile(token, req, secret) {
  const ip = req.headers.get("CF-Connecting-IP")
  const origin = req.headers.get("Origin")
  const formData = new URLSearchParams()
  formData.append("secret", secret)
  formData.append("response", token)
  if (ip) formData.append("remoteip", ip)

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData
  })

  if (!res.ok) return false
  const result = await res.json()
  if (origin && typeof result?.hostname === "string" && result.hostname) {
    try {
      const originHost = new URL(origin).hostname
      if (originHost && originHost !== result.hostname) return false
    } catch {
      return false
    }
  }
  return Boolean(result.success)
}

async function assertAdmin(req, env) {
  const auth = req.headers.get("Authorization") || ""
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  const adminApiToken = (env.ADMIN_API_TOKEN || "").trim()

  if (bearer && adminApiToken && await secureCompare(bearer, adminApiToken)) {
    return { actor: "token-admin", method: "bearer" }
  }

  const sessionSecret = (env.ADMIN_SESSION_SECRET || "").trim()
  if (!sessionSecret) throw new HttpError(500, "Admin session secret is not configured")

  const cookies = parseCookies(req.headers.get("Cookie") || "")
  const sessionToken = cookies[SESSION_COOKIE_NAME]
  if (!sessionToken) throw new HttpError(401, "Unauthorized")

  await ensureSecurityTables(env)
  const payload = await verifySessionToken(sessionToken, sessionSecret, unixNow())
  if (!payload) throw new HttpError(401, "Unauthorized")

  const sessionId = typeof payload.sid === "string" ? payload.sid.trim() : ""
  if (!sessionId) throw new HttpError(401, "Unauthorized")

  const isActive = await isAdminSessionActive(env, sessionId, unixNow())
  if (!isActive) throw new HttpError(401, "Unauthorized")

  return {
    actor: "panel-admin",
    method: "session",
    session: payload,
    sessionId
  }
}

function assertDb(env) {
  if (!env.DB?.prepare) {
    throw new HttpError(500, "D1 binding is not configured")
  }
}

async function ensureSecurityTables(env) {
  assertDb(env)
  if (securityTablesReady) return

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  ).run()

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions (expires_at)"
  ).run()

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS admin_login_attempts (
      ip_hash TEXT PRIMARY KEY,
      window_started_at INTEGER NOT NULL,
      failed_count INTEGER NOT NULL DEFAULT 0,
      blocked_until INTEGER,
      updated_at INTEGER NOT NULL
    )`
  ).run()

  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_updated_at ON admin_login_attempts (updated_at)"
  ).run()

  securityTablesReady = true
}

async function assertAdminLoginAllowed(env, ipHash, now) {
  const row = await env.DB.prepare(
    "SELECT window_started_at, failed_count, blocked_until FROM admin_login_attempts WHERE ip_hash = ?1 LIMIT 1"
  )
    .bind(ipHash)
    .first()

  if (!row) return

  const blockedUntil = Number(row.blocked_until) || 0
  if (blockedUntil > now) {
    throw new HttpError(429, "Too many login attempts. Try again later.")
  }

  const windowStartedAt = Number(row.window_started_at) || 0
  if (windowStartedAt <= 0 || now - windowStartedAt >= ADMIN_LOGIN_WINDOW_SECONDS) {
    await env.DB.prepare(
      `UPDATE admin_login_attempts
        SET window_started_at = ?1, failed_count = 0, blocked_until = NULL, updated_at = ?1
        WHERE ip_hash = ?2`
    )
      .bind(now, ipHash)
      .run()
  }
}

async function recordFailedAdminLogin(env, ipHash, now) {
  const existing = await env.DB.prepare(
    "SELECT window_started_at, failed_count FROM admin_login_attempts WHERE ip_hash = ?1 LIMIT 1"
  )
    .bind(ipHash)
    .first()

  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO admin_login_attempts
        (ip_hash, window_started_at, failed_count, blocked_until, updated_at)
        VALUES (?1, ?2, 1, NULL, ?2)`
    )
      .bind(ipHash, now)
      .run()
    return
  }

  const windowStartedAt = Number(existing.window_started_at) || now
  const insideWindow = now - windowStartedAt < ADMIN_LOGIN_WINDOW_SECONDS
  const nextWindowStartedAt = insideWindow ? windowStartedAt : now
  const previousFailed = Number(existing.failed_count) || 0
  const failedCount = insideWindow ? previousFailed + 1 : 1
  const blockedUntil = failedCount >= ADMIN_LOGIN_MAX_ATTEMPTS
    ? now + ADMIN_LOGIN_BLOCK_SECONDS
    : null

  await env.DB.prepare(
    `UPDATE admin_login_attempts
      SET window_started_at = ?1, failed_count = ?2, blocked_until = ?3, updated_at = ?4
      WHERE ip_hash = ?5`
  )
    .bind(nextWindowStartedAt, failedCount, blockedUntil, now, ipHash)
    .run()

  await env.DB.prepare(
    "DELETE FROM admin_login_attempts WHERE updated_at < ?1"
  )
    .bind(now - SECURITY_RECORD_RETENTION_SECONDS)
    .run()
}

async function clearAdminLoginAttempts(env, ipHash) {
  await env.DB.prepare("DELETE FROM admin_login_attempts WHERE ip_hash = ?1")
    .bind(ipHash)
    .run()
}

async function createAdminSession(env, sessionId, expiresAt, now) {
  await env.DB.prepare(
    `INSERT INTO admin_sessions
      (id, expires_at, revoked_at, created_at, updated_at)
      VALUES (?1, ?2, NULL, ?3, ?3)`
  )
    .bind(sessionId, expiresAt, now)
    .run()

  await env.DB.prepare(
    "DELETE FROM admin_sessions WHERE expires_at < ?1 OR (revoked_at IS NOT NULL AND revoked_at < ?2)"
  )
    .bind(now - 60, now - SECURITY_RECORD_RETENTION_SECONDS)
    .run()
}

async function revokeAdminSession(env, sessionId, now) {
  await env.DB.prepare(
    `UPDATE admin_sessions
      SET revoked_at = ?1, updated_at = ?1
      WHERE id = ?2`
  )
    .bind(now, sessionId)
    .run()
}

async function isAdminSessionActive(env, sessionId, now) {
  const row = await env.DB.prepare(
    "SELECT expires_at, revoked_at FROM admin_sessions WHERE id = ?1 LIMIT 1"
  )
    .bind(sessionId)
    .first()

  if (!row) return false
  if (Number(row.revoked_at) > 0) return false
  if ((Number(row.expires_at) || 0) <= now) return false
  return true
}

function assertOriginAllowed(req, env) {
  const origin = req.headers.get("Origin")
  if (!origin) throw new HttpError(403, "Origin header is required")
  if (!isOriginAllowed(origin, env)) {
    throw new HttpError(403, "Origin is not allowed")
  }
}

function isOriginAllowed(origin, env) {
  const allowedOrigins = (env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)

  if (allowedOrigins.length === 0) return false
  return allowedOrigins.includes(origin)
}

function readText(payload, key, options = {}) {
  const { required = false, max = 255 } = options
  const value = payload?.[key]

  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${key} is required`)
    return ""
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${key} must be a string`)
  }

  const trimmed = value.trim()
  if (required && !trimmed) throw new HttpError(400, `${key} is required`)
  if (trimmed.length > max) throw new HttpError(400, `${key} is too long`)
  return trimmed
}

function parseCsv(text, maxItems, maxItemLength) {
  if (!text) return []
  const values = text
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)

  if (values.length > maxItems) {
    throw new HttpError(400, "Too many comma-separated values")
  }

  const seen = new Set()
  const result = []
  for (const value of values) {
    if (value.length > maxItemLength) {
      throw new HttpError(400, "A value is too long")
    }
    const lower = value.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    result.push(value)
  }
  return result
}

async function parseRequestJson(req) {
  const contentLengthHeader = req.headers.get("Content-Length")
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader)
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      throw new HttpError(413, "Payload too large")
    }
  }

  if (!req.body) return {}

  const reader = req.body.getReader()
  const chunks = []
  let bytesRead = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    bytesRead += value.byteLength
    if (bytesRead > MAX_BODY_BYTES) {
      try {
        await reader.cancel()
      } catch {
        // Ignore cancel errors and reject oversized payloads.
      }
      throw new HttpError(413, "Payload too large")
    }
    chunks.push(value)
  }

  if (bytesRead === 0) return {}

  const bytes = new Uint8Array(bytesRead)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  const raw = new TextDecoder().decode(bytes)
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    throw new HttpError(400, "Invalid JSON body")
  }
}

function buildCorsHeaders(req, env, pathname = "") {
  const origin = req.headers.get("Origin")
  const allowedOrigins = (env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean)

  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400"
  }

  if (
    pathname === "/v1/submissions"
    || pathname === "/v1/users"
    || pathname === "/v1/health"
    || pathname === "/stats"
    || pathname === "/users"
  ) {
    headers["Access-Control-Allow-Origin"] = "*"
    return headers
  }

  if (!origin) return headers

  if (allowedOrigins.length === 0) {
    return headers
  }

  if (allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Credentials"] = "true"
    headers["Vary"] = "Origin"
  }

  return headers
}

function jsonResponse(data, status, corsHeaders, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...extraHeaders
    }
  })
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

async function hashIp(req, env) {
  const ip = req.headers.get("CF-Connecting-IP") || "unknown"
  const salt = (env.IP_HASH_SALT || "").trim()
  if (!salt || salt.length < 16) {
    throw new HttpError(500, "IP hash salt is not configured")
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${ip}`)
  )
  return bytesToHex(new Uint8Array(digest))
}

async function secureCompare(a, b) {
  const [hashA, hashB] = await Promise.all([
    sha256Hex(a),
    sha256Hex(b)
  ])
  if (hashA.length !== hashB.length) return false
  let diff = 0
  for (let i = 0; i < hashA.length; i += 1) {
    diff |= hashA.charCodeAt(i) ^ hashB.charCodeAt(i)
  }
  return diff === 0
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  )
  return bytesToHex(new Uint8Array(digest))
}

function bytesToHex(bytes) {
  return [...bytes]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function createSessionToken(secret, now, sessionId) {
  const payload = {
    exp: now + SESSION_TTL_SECONDS,
    sid: sessionId,
    nonce: crypto.randomUUID()
  }
  const encodedPayload = textToBase64Url(JSON.stringify(payload))
  const signature = await signHmac(secret, encodedPayload)
  return `${encodedPayload}.${signature}`
}

async function verifySessionToken(token, secret, now) {
  const parts = token.split(".")
  if (parts.length !== 2) return null

  const [encodedPayload, signature] = parts
  const expectedSignature = await signHmac(secret, encodedPayload)
  const validSig = await secureCompare(signature, expectedSignature)
  if (!validSig) return null

  const payload = safeJsonParse(base64UrlToText(encodedPayload))
  if (!payload || typeof payload.exp !== "number") return null
  if (typeof payload.sid !== "string" || !payload.sid.trim()) return null
  if (payload.exp <= now) return null
  return payload
}

async function signHmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))
  return bytesToBase64Url(new Uint8Array(signature))
}

function buildSessionCookie(token) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/v1/admin; HttpOnly; Secure; SameSite=None; Max-Age=${SESSION_TTL_SECONDS}`
}

function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/v1/admin; HttpOnly; Secure; SameSite=None; Max-Age=0`
}

function parseCookies(cookieHeader) {
  const cookies = {}
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.split("=")
    const key = (rawKey || "").trim()
    if (!key) continue
    cookies[key] = (rawValue.join("=") || "").trim()
  }
  return cookies
}

function textToBase64Url(text) {
  const bytes = new TextEncoder().encode(text)
  return bytesToBase64Url(bytes)
}

function base64UrlToText(value) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=")
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

function bytesToBase64Url(bytes) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function toPositiveInt(input, fallback) {
  const parsed = Number(input)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function unixNow() {
  return Math.floor(Date.now() / 1000)
}

async function fetchDiscordStats(botToken, guildId) {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
      headers: {
        Authorization: `Bot ${botToken}`
      }
    })
    if (!res.ok) return { members: null, online: null }
    const data = await res.json()
    return {
      members: data.approximate_member_count ?? null,
      online: data.approximate_presence_count ?? null
    }
  } catch {
    return { members: null, online: null }
  }
}

async function fetchStats(env) {
  const botToken = (env.DISCORD_BOT_TOKEN || "").trim()
  const guildId = (env.DISCORD_GUILD_ID || DEFAULT_DISCORD_GUILD_ID).trim()
  const subreddit = "teenarazzi"

  const [discord, reddit] = await Promise.all([
    fetchDiscordStats(botToken, guildId),
    fetchRedditStats(env, subreddit)
  ])

  return {
    discord,
    reddit,
    timestamp: unixNow()
  }
}

async function fetchRedditStats(env, subreddit) {
  const now = unixNow()
  const cached = await getCachedRedditActivity(env)
  const about = await fetchRedditAboutStats(subreddit)

  let members = about.members ?? cached.members
  let weeklyActive = null

  const hasFreshCache = (
    Number.isFinite(cached.checkedAt)
    && cached.checkedAt > 0
    && (now - cached.checkedAt) < REDDIT_ACTIVITY_REFRESH_SECONDS
  )

  if (hasFreshCache && Number.isFinite(cached.weeklyActive)) {
    weeklyActive = cached.weeklyActive
  } else {
    const scrapedWeeklyActive = await scrapeRedditWeeklyActive(subreddit)
    if (Number.isFinite(scrapedWeeklyActive)) {
      weeklyActive = scrapedWeeklyActive
      await setCachedRedditActivity(env, {
        weeklyActive: scrapedWeeklyActive,
        members,
        checkedAt: now
      })
    } else if (Number.isFinite(cached.weeklyActive)) {
      weeklyActive = cached.weeklyActive
    }
  }

  if (!Number.isFinite(members) && Number.isFinite(cached.members)) {
    members = cached.members
  }

  const online = Number.isFinite(weeklyActive)
    ? weeklyActive
    : (about.apiActive ?? null)

  return {
    members: Number.isFinite(members) ? members : null,
    online: Number.isFinite(online) ? online : null
  }
}

async function fetchRedditAboutStats(subreddit) {
  try {
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`, {
      headers: { "User-Agent": "teenarazzi/1.0 (+https://teenarazzi.com)" }
    })
    if (!response.ok) {
      return {
        members: null,
        apiActive: null
      }
    }

    const data = await response.json()
    return {
      members: toCountOrNull(data?.data?.subscribers),
      apiActive: toCountOrNull(data?.data?.accounts_active)
    }
  } catch {
    return {
      members: null,
      apiActive: null
    }
  }
}

async function scrapeRedditWeeklyActive(subreddit) {
  const urls = [
    `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/`,
    `https://old.reddit.com/r/${encodeURIComponent(subreddit)}/`
  ]

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "teenarazzi-stats-bot/1.0 (+https://teenarazzi.com)"
        }
      })
      if (!response.ok) continue

      const html = await response.text()
      const parsed = extractRedditWeeklyActiveFromHtml(html)
      if (Number.isFinite(parsed)) return parsed
    } catch {
      // Ignore per-source scrape failures and continue fallback chain.
    }
  }

  return null
}

function extractRedditWeeklyActiveFromHtml(html) {
  if (typeof html !== "string" || !html) return null

  // New Reddit embeds several machine-readable numeric fields in HTML.
  const machineReadablePatterns = [
    /weekly-active-users\s*=\s*"(\d{1,12})"/i,
    /"active_user_count"\s*:\s*(\d{1,12})/i,
    /"activeCount"\s*:\s*(\d{1,12})/i,
    /active-count\s*=\s*"(\d{1,12})"/i,
    /"onlineCount"\s*:\s*(\d{1,12})/i,
    /"users_here_now"\s*:\s*(\d{1,12})/i
  ]

  for (const pattern of machineReadablePatterns) {
    const match = html.match(pattern)
    if (!match) continue
    const parsed = toCountOrNull(match[1])
    if (Number.isFinite(parsed)) return parsed
  }

  const slotMatch = html.match(/slot\s*=\s*"weekly-active-users-count"\s*>\s*([^<]+)\s*</i)
  if (slotMatch) {
    const parsed = parseCompactCount(slotMatch[1])
    if (Number.isFinite(parsed)) return parsed
  }

  // Fallback for legacy/visible text values like "1,234 users here now".
  const textPatterns = [
    /([0-9][0-9,.\s]*[kmb]?)\s+users here now/i,
    /([0-9][0-9,.\s]*[kmb]?)\s+online/i,
    /([0-9][0-9,.\s]*[kmb]?)\s+active/i,
    /([0-9][0-9,.\s]*[kmb]?)\s+weekly active/i
  ]

  for (const pattern of textPatterns) {
    const match = html.match(pattern)
    if (!match) continue
    const parsed = parseCompactCount(match[1])
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function parseCompactCount(value) {
  if (typeof value !== "string") return null
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, "").replace(/,/g, "")
  const match = cleaned.match(/^(\d+(?:\.\d+)?)([kmb])?$/i)
  if (!match) return null

  const base = Number(match[1])
  if (!Number.isFinite(base)) return null

  const suffix = (match[2] || "").toLowerCase()
  if (suffix === "k") return Math.round(base * 1_000)
  if (suffix === "m") return Math.round(base * 1_000_000)
  if (suffix === "b") return Math.round(base * 1_000_000_000)
  return Math.round(base)
}

function toCountOrNull(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}

async function getCachedRedditActivity(env) {
  if (!env.STATS?.get) {
    return {
      weeklyActive: null,
      members: null,
      checkedAt: null
    }
  }

  const raw = await env.STATS.get(REDDIT_ACTIVITY_CACHE_KEY)
  const parsed = safeJsonParse(raw)
  return {
    weeklyActive: toCountOrNull(parsed?.weeklyActive),
    members: toCountOrNull(parsed?.members),
    checkedAt: toCountOrNull(parsed?.checkedAt)
  }
}

async function setCachedRedditActivity(env, activity) {
  if (!env.STATS?.put) return
  await env.STATS.put(
    REDDIT_ACTIVITY_CACHE_KEY,
    JSON.stringify({
      weeklyActive: toCountOrNull(activity?.weeklyActive),
      members: toCountOrNull(activity?.members),
      checkedAt: toCountOrNull(activity?.checkedAt) || unixNow()
    }),
    {
      expirationTtl: 7 * 24 * 60 * 60
    }
  )
}
