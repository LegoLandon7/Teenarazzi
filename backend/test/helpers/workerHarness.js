import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"
import worker from "../../worker.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const backendRoot = join(__dirname, "..", "..")

const MIGRATIONS = [
  join(backendRoot, "migrations", "0001_init.sql"),
  join(backendRoot, "migrations", "0002_admin_security.sql")
]

const DEFAULT_BINDINGS = {
  CORS_ALLOWED_ORIGINS: "https://teenarazzi.test",
  IP_HASH_SALT: "1234567890abcdef1234567890abcdef",
  ADMIN_PANEL_PASSWORD: "super-secret",
  ADMIN_SESSION_SECRET: "super-secret-session-key"
}

export async function createWorkerHarness(options = {}) {
  const { bindings = {} } = options

  const sqlite = new DatabaseSync(":memory:")
  const DB = createD1Shim(sqlite)
  const STATS = createKvShim()

  for (const migrationPath of MIGRATIONS) {
    const sql = await readFile(migrationPath, "utf8")
    await DB.exec(sql)
  }

  const env = {
    ...DEFAULT_BINDINGS,
    ...bindings,
    DB,
    STATS
  }

  async function dispatch(path, init = {}) {
    const url = `https://api.teenarazzi.test${path}`
    const req = new Request(url, init)
    return worker.fetch(req, env)
  }

  async function dispose() {
    sqlite.close()
  }

  return {
    dispatch,
    DB,
    STATS,
    env,
    dispose
  }
}

function createD1Shim(sqlite) {
  return {
    exec(sql) {
      sqlite.exec(sql)
    },
    prepare(sql) {
      return createStatement(sqlite, sql)
    }
  }
}

function createStatement(sqlite, sql) {
  let params = []
  return {
    bind(...values) {
      params = values
      return this
    },
    run() {
      const stmt = sqlite.prepare(sql)
      stmt.run(...params)
      return Promise.resolve({ success: true })
    },
    first() {
      const stmt = sqlite.prepare(sql)
      const row = stmt.get(...params) || null
      return Promise.resolve(row)
    },
    all() {
      const stmt = sqlite.prepare(sql)
      const results = stmt.all(...params)
      return Promise.resolve({ results })
    }
  }
}

function createKvShim() {
  const map = new Map()
  return {
    async get(key) {
      return map.get(String(key)) ?? null
    },
    async put(key, value) {
      map.set(String(key), String(value))
    }
  }
}
