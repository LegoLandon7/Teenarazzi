import { useParams } from "react-router-dom"
import { useCallback, useEffect, useRef, useState } from "react"
import { fetchUsersMap } from "../../lib/usersApi.js"

import "./UserPage.css"
import "../../css/tools/flex-container.css"

const COPY_TIMEOUT_MS = 1500

function normalizeList(list) {
    if (!Array.isArray(list)) return []
    return list
        .map(value => (typeof value === "string" ? value.trim() : value))
        .filter(Boolean)
}

function cleanText(value) {
    if (typeof value !== "string") return ""
    return value.trim()
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

function buildRedditProfileUrl(value) {
    const username = normalizeRedditUsername(value)
    if (!username) return null
    return `https://reddit.com/u/${username}`
}

function resolveAvatarCards(user) {
    const cards = []
    const discordAvatar = cleanText(user?.avatars?.discord)
    const redditAvatar = cleanText(user?.avatars?.reddit)
    const fallbackAvatar = cleanText(user?.avatarUrl)

    if (discordAvatar) {
        cards.push({
            key: "discord",
            label: "Discord",
            url: discordAvatar
        })
    }

    if (redditAvatar) {
        cards.push({
            key: "reddit",
            label: "Reddit",
            url: redditAvatar
        })
    }

    if (cards.length === 0 && fallbackAvatar) {
        cards.push({
            key: "profile",
            label: "Profile",
            url: fallbackAvatar
        })
    }

    return cards
}

function formatUnixDate(timestamp) {
    if (timestamp === null || timestamp === undefined) return null
    const unix = Number(timestamp)
    if (!Number.isFinite(unix)) return null
    return new Date(unix * 1000).toLocaleDateString()
}

function UserPage() {
    const { userId } = useParams()
    const [userState, setUserState] = useState({
        userId: null,
        status: "loading",
        user: null
    })
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [copyState, setCopyState] = useState({ userId: null, fieldId: "" })
    const [selectedAvatarKey, setSelectedAvatarKey] = useState("")
    const copyTimerRef = useRef(null)
    const requestIdRef = useRef(0)

    const loadUser = useCallback(async (targetUserId, options = {}) => {
        const { forceRefresh = false, showLoading = false } = options
        const requestId = requestIdRef.current + 1
        requestIdRef.current = requestId

        if (showLoading) {
            setUserState({
                userId: targetUserId,
                status: "loading",
                user: null
            })
        }

        try {
            const data = await fetchUsersMap({ forceRefresh })
            if (requestIdRef.current !== requestId) return

            const nextUser = data?.[targetUserId]
            setSelectedAvatarKey("")

            if (!nextUser) {
                setUserState({
                    userId: targetUserId,
                    status: "not_found",
                    user: null
                })
                return
            }

            setUserState({
                userId: targetUserId,
                status: "ready",
                user: nextUser
            })
        } catch {
            if (requestIdRef.current !== requestId) return
            setSelectedAvatarKey("")
            setUserState({
                userId: targetUserId,
                status: "error",
                user: null
            })
        }
    }, [])

    useEffect(() => {
        loadUser(userId, { showLoading: true })
        return () => {
            requestIdRef.current += 1
        }
    }, [userId, loadUser])

    useEffect(() => {
        return () => {
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
        }
    }, [])

    const handleCopy = async (value, fieldId) => {
        if (!value || !navigator?.clipboard) return

        try {
            await navigator.clipboard.writeText(value)
            setCopyState({ userId, fieldId })

            if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
            copyTimerRef.current = setTimeout(() => {
                setCopyState({ userId: null, fieldId: "" })
            }, COPY_TIMEOUT_MS)
        } catch {
            // Ignore clipboard errors and keep the UI functional.
        }
    }

    const handleRefresh = async () => {
        if (isRefreshing) return
        setIsRefreshing(true)
        try {
            await loadUser(userId, { forceRefresh: true, showLoading: false })
        } finally {
            setIsRefreshing(false)
        }
    }

    if (userState.userId !== userId || userState.status === "loading") {
        return (
            <div className="user-page">
                <section className="user-status-card">
                    <h1>User</h1>
                    <p>Loading ↻</p>
                </section>
            </div>
        )
    }

    if (userState.status === "not_found") {
        return (
            <div className="user-page">
                <section className="user-status-card">
                    <h1>User Not Found</h1>
                    <p>We could not find a profile for "{userId}".</p>
                </section>
            </div>
        )
    }

    if (userState.status === "error" || !userState.user) {
        return (
            <div className="user-page">
                <section className="user-status-card">
                    <h1>Could Not Load User</h1>
                    <p>Please refresh and try again.</p>
                </section>
            </div>
        )
    }

    const user = userState.user
    const copiedField = copyState.userId === userId ? copyState.fieldId : ""

    const discordUsernames = normalizeList(user?.usernames?.discord)
    const redditUsernames = normalizeList(user?.usernames?.reddit)
    const nicknames = normalizeList(user?.nicknames)

    const discordCurrent = discordUsernames[0] ?? null
    const discordOld = discordUsernames.slice(1)
    const redditCurrent = redditUsernames[0] ?? null
    const redditOld = redditUsernames.slice(1)

    const redditUrl = buildRedditProfileUrl(redditCurrent)
    const avatarCards = resolveAvatarCards(user)
    const activeAvatarKey = avatarCards.some(card => card.key === selectedAvatarKey)
        ? selectedAvatarKey
        : (avatarCards[0]?.key || "")
    const activeAvatar = avatarCards.find(card => card.key === activeAvatarKey) || null

    const hasNotes = typeof user?.notes === "string" && user.notes.trim()
    const ageValue = user?.age?.value ?? null
    const ageUpdated = formatUnixDate(user?.age?.timestamp)
    const pageUpdated = formatUnixDate(user?.timestamp)

    const renderInfobox = () => (
        <>
            <header className="user-infobox-header">
                <h2>{user.id}</h2>
                {activeAvatar && (
                    <div className="user-avatar-panel">
                        {avatarCards.length > 1 && (
                            <div className="user-avatar-tabs" role="tablist" aria-label="Avatar source">
                                {avatarCards.map(card => (
                                    <button
                                        type="button"
                                        key={card.key}
                                        className={`user-avatar-tab ${card.key === activeAvatarKey ? "active" : ""}`}
                                        onClick={() => setSelectedAvatarKey(card.key)}
                                        aria-pressed={card.key === activeAvatarKey}
                                    >
                                        {card.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        <figure className="user-avatar-card">
                            <img src={activeAvatar.url} alt={`${user.id} avatar`} />
                        </figure>
                    </div>
                )}
            </header>

            <dl className="user-facts">
                {discordCurrent && (
                    <div className="user-fact-row">
                        <dt className="user-fact-label">Discord</dt>
                        <dd className="user-fact-value">
                            <div className="user-fact-inline">
                                <span>{discordCurrent}</span>
                                <button type="button" className="user-copy-button" onClick={() => handleCopy(discordCurrent, "discord_username")}>
                                    {copiedField === "discord_username" ? "Copied" : "Copy"}
                                </button>
                            </div>
                            {discordOld.length > 0 && <span className="user-fact-subtext">{`Old: ${discordOld.join(", ")}`}</span>}
                        </dd>
                    </div>
                )}

                {redditCurrent && (
                    <div className="user-fact-row">
                        <dt className="user-fact-label">Reddit</dt>
                        <dd className="user-fact-value">
                            <span>{redditCurrent}</span>
                            {redditOld.length > 0 && <span className="user-fact-subtext">{`Old: ${redditOld.join(", ")}`}</span>}
                        </dd>
                    </div>
                )}

                {redditUrl && (
                    <div className="user-fact-row">
                        <dt className="user-fact-label">Reddit Link</dt>
                        <dd className="user-fact-value">
                            <a href={redditUrl} target="_blank" rel="noopener noreferrer">
                                {redditUrl}
                            </a>
                        </dd>
                    </div>
                )}

                {nicknames.length > 0 && (
                    <div className="user-fact-row">
                        <dt className="user-fact-label">Nicknames</dt>
                        <dd className="user-fact-value">{nicknames.join(", ")}</dd>
                    </div>
                )}

                {user.pronouns && (
                    <div className="user-fact-row">
                        <dt className="user-fact-label">Pronouns</dt>
                        <dd className="user-fact-value">{user.pronouns}</dd>
                    </div>
                )}

                {user.sexuality && (
                    <div className="user-fact-row">
                        <dt className="user-fact-label">Sexuality</dt>
                        <dd className="user-fact-value">{user.sexuality}</dd>
                    </div>
                )}

                {ageValue !== null && (
                    <div className="user-fact-row">
                        <dt className="user-fact-label">Age</dt>
                        <dd className="user-fact-value">
                            <span>{ageValue}</span>
                            {ageUpdated && <span className="user-fact-subtext">{`Last updated: ${ageUpdated}`}</span>}
                        </dd>
                    </div>
                )}

                {user.birthday && (
                    <div className="user-fact-row">
                        <dt className="user-fact-label">Birthday</dt>
                        <dd className="user-fact-value">{user.birthday}</dd>
                    </div>
                )}

                {pageUpdated && (
                    <div className="user-fact-row">
                        <dt className="user-fact-label">Page Updated</dt>
                        <dd className="user-fact-value">{pageUpdated}</dd>
                    </div>
                )}
            </dl>
        </>
    )

    return (
        <div className="user-page">
            <div className="user-layout">
                <section className="user-infobox user-infobox-mobile">
                    {renderInfobox()}
                </section>

                <article className="user-article">
                    <section className="user-card user-article-header">
                        <div className="user-card-title-row">
                            <h1>{user.id}</h1>
                            <button
                                type="button"
                                className="user-refresh-button"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                            >
                                {isRefreshing ? "Refreshing..." : "Refresh"}
                            </button>
                        </div>
                        <hr />
                        <h2>About</h2>
                        <p>{user.description}</p>
                    </section>

                    {hasNotes && (
                        <section className="user-card">
                            <h2>Notes</h2>
                            <hr />
                            <p>{user.notes}</p>
                        </section>
                    )}
                </article>

                <aside className="user-infobox user-infobox-desktop">{renderInfobox()}</aside>
            </div>
        </div>
    )
}

export default UserPage
