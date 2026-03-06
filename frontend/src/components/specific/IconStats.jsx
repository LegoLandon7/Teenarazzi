import { useEffect, useRef, useState } from "react"

import { apiUrl } from "../../lib/api.js"
import "./IconStats.css"

const CACHE_KEY = "teenarazzi_stats"
const CACHE_TTL_MS = 5 * 60 * 1000
const ERROR_VALUE = "[ERROR]"

function buildStatsState(data) {
    return {
        discordTotal: data?.discord?.members ?? ERROR_VALUE,
        discordActive: data?.discord?.online ?? ERROR_VALUE,
        redditTotal: data?.reddit?.members ?? ERROR_VALUE,
        redditActive: data?.reddit?.online ?? ERROR_VALUE,
        lastUpdated: data?.timestamp ?? null
    }
}

function readCachedStats() {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
        return {
            hasFreshCache: false,
            stats: buildStatsState(null)
        }
    }

    try {
        const raw = window.localStorage.getItem(CACHE_KEY)
        if (!raw) {
            return {
                hasFreshCache: false,
                stats: buildStatsState(null)
            }
        }

        const parsed = JSON.parse(raw)
        const fetchedAt = Number(parsed?.fetchedAt)
        const ageMs = Date.now() - fetchedAt
        const hasFreshCache = Number.isFinite(fetchedAt) && fetchedAt > 0 && ageMs < CACHE_TTL_MS

        return {
            hasFreshCache,
            stats: buildStatsState(parsed?.data)
        }
    } catch {
        return {
            hasFreshCache: false,
            stats: buildStatsState(null)
        }
    }
}

function writeCachedStats(data) {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return

    try {
        window.localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
                data,
                fetchedAt: Date.now()
            })
        )
    } catch {
        // Ignore storage quota and privacy-mode failures.
    }
}

function formatTimestamp(timestamp) {
    if (!timestamp) return ""
    return new Date(timestamp * 1000).toLocaleString()
}

function getNumberColor(value) {
    return typeof value === "number" && !Number.isNaN(value) ? "green" : "red"
}

function IconStats() {
    const initialCacheRef = useRef(readCachedStats())
    const [stats, setStats] = useState(() => initialCacheRef.current.stats)

    useEffect(() => {
        let cancelled = false

        const refreshStats = async () => {
            try {
                const response = await fetch(apiUrl("/stats"))
                if (!response.ok) throw new Error(`Stats request failed: ${response.status}`)

                const data = await response.json()
                if (cancelled) return

                setStats(buildStatsState(data))
                writeCachedStats(data)
            } catch (error) {
                console.error("Failed to fetch stats:", error)
            }
        }

        if (!initialCacheRef.current.hasFreshCache) {
            refreshStats()
        }

        const intervalId = window.setInterval(refreshStats, CACHE_TTL_MS)
        return () => {
            cancelled = true
            window.clearInterval(intervalId)
        }
    }, [])

    return (
        <div className="icon-stat-container">
            <a
                className="icon-stat"
                style={{ "--stat-color": "rgba(88, 101, 242, 0.5)" }}
                href="https://discord.gg/razzi"
                target="_blank"
                rel="noopener noreferrer"
            >
                <h1>Discord</h1>
                <p>
                    Total members: <span style={{ color: getNumberColor(stats.discordTotal) }}>{stats.discordTotal}</span> <br />
                    Active members: <span style={{ color: getNumberColor(stats.discordActive) }}>{stats.discordActive}</span> <br />
                </p>
                <div className="last-updated">{`Last Updated: ${formatTimestamp(stats.lastUpdated)}`}</div>
            </a>
            <a
                className="icon-stat"
                style={{ "--stat-color": "rgba(255, 86, 0, 0.5)" }}
                href="https://reddit.com/r/teenarazzi"
                target="_blank"
                rel="noopener noreferrer"
            >
                <h1>Reddit</h1>
                <p>
                    Total members: <span style={{ color: getNumberColor(stats.redditTotal) }}>{stats.redditTotal}</span> <br />
                    Weekly visitors: <span style={{ color: getNumberColor(stats.redditActive) }}>{stats.redditActive}</span> <br />
                </p>
                <div className="last-updated">
                    {stats.lastUpdated ? `Last Updated: ${formatTimestamp(stats.lastUpdated)}` : "Last Updated: N/A"}
                </div>
            </a>
        </div>
    )
}

export default IconStats
