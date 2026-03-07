import { createWorkerHarness } from "./helpers/workerHarness.js"

function buildSubmissionBody(overrides = {}) {
  return {
    displayName: "Example User",
    activeCommunity: "discord",
    discordUsername: "example_discord",
    description: "A short description",
    middyGoat: "yes",
    website: "",
    ...overrides
  }
}

describe("worker high-risk routes", () => {
  let harness

  beforeEach(async () => {
    harness = await createWorkerHarness()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    if (harness) {
      await harness.dispose()
    }
  })

  it("POST /v1/submissions accepts valid request", async () => {
    const res = await harness.dispatch("/v1/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://teenarazzi.test",
        "CF-Connecting-IP": "203.0.113.2"
      },
      body: JSON.stringify(buildSubmissionBody())
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.status).toBe("pending")
    expect(typeof data.id).toBe("string")
    expect(data.id.length).toBeGreaterThan(0)
  })

  it("POST /v1/submissions rejects invalid request", async () => {
    const res = await harness.dispatch("/v1/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://teenarazzi.test",
        "CF-Connecting-IP": "203.0.113.2"
      },
      body: JSON.stringify(buildSubmissionBody({ displayName: "" }))
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/displayName is required/i)
  })

  it("POST /v1/submissions rate-limits repeated requests", async () => {
    const limitedHarness = await createWorkerHarness({
      bindings: { RATE_LIMIT_PER_HOUR: "2" }
    })

    const headers = {
      "Content-Type": "application/json",
      Origin: "https://teenarazzi.test",
      "CF-Connecting-IP": "203.0.113.3"
    }

    const body = JSON.stringify(buildSubmissionBody())

    const first = await limitedHarness.dispatch("/v1/submissions", { method: "POST", headers, body })
    const second = await limitedHarness.dispatch("/v1/submissions", { method: "POST", headers, body })
    const third = await limitedHarness.dispatch("/v1/submissions", { method: "POST", headers, body })

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(third.status).toBe(429)

    await limitedHarness.dispose()
  })

  it("POST /v1/admin/login handles success, invalid credentials, and lockout", async () => {
    const success = await harness.dispatch("/v1/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://teenarazzi.test",
        "CF-Connecting-IP": "198.51.100.14"
      },
      body: JSON.stringify({ password: "super-secret" })
    })

    expect(success.status).toBe(200)
    expect(success.headers.get("set-cookie")).toContain("trz_admin_session=")

    const invalid = await harness.dispatch("/v1/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://teenarazzi.test",
        "CF-Connecting-IP": "198.51.100.15"
      },
      body: JSON.stringify({ password: "wrong" })
    })

    expect(invalid.status).toBe(401)

    for (let i = 0; i < 8; i += 1) {
      await harness.dispatch("/v1/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://teenarazzi.test",
          "CF-Connecting-IP": "198.51.100.16"
        },
        body: JSON.stringify({ password: "bad-password" })
      })
    }

    const blocked = await harness.dispatch("/v1/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://teenarazzi.test",
        "CF-Connecting-IP": "198.51.100.16"
      },
      body: JSON.stringify({ password: "bad-password" })
    })

    expect(blocked.status).toBe(429)
    expect((await blocked.json()).error).toMatch(/too many login attempts/i)
  })

  it("GET /v1/users skips malformed records and sanitizes avatar fields", async () => {
    const now = Math.floor(Date.now() / 1000)
    await harness.DB.prepare(
      "INSERT INTO users (slug, user_id, user_json, source, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
      .bind("good-user", "good-user", JSON.stringify({ id: "good-user", description: "ok" }), "seed", now, now)
      .run()

    await harness.DB.prepare(
      "INSERT INTO users (slug, user_id, user_json, source, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
      .bind("bad-user", "bad-user", "{ this is invalid json", "seed", now, now)
      .run()

    const res = await harness.dispatch("/v1/users", { method: "GET" })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.count).toBe(1)
    expect(data.users["good-user"]).toMatchObject({
      id: "good-user",
      description: "ok"
    })
    expect(data.users["good-user"].avatars).toEqual({
      discord: null,
      reddit: null
    })
    expect(typeof data.users["good-user"].avatarUrl).toBe("string")
    expect(data.users["bad-user"]).toBeUndefined()
  })

  it("GET /stats serves uncached then cached responses", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"))

    const first = await harness.dispatch("/stats", { method: "GET" })
    expect(first.status).toBe(200)
    const firstPayload = await first.json()
    expect(firstPayload).toHaveProperty("discord")
    expect(firstPayload).toHaveProperty("reddit")
    expect(firstPayload).toHaveProperty("timestamp")

    vi.restoreAllMocks()
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const second = await harness.dispatch("/stats", { method: "GET" })
    expect(second.status).toBe(200)
    const secondPayload = await second.json()

    expect(secondPayload).toEqual(firstPayload)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
