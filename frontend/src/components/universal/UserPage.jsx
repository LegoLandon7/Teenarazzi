import { useParams } from "react-router-dom"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { fetchUsersMap } from "../../lib/usersApi.js"
import { apiUrl } from "../../lib/api.js"

import "./UserPage.css"
import "../../css/tools/flex-container.css"

const COPY_TIMEOUT_MS = 1500
const EMPTY_EDIT_FORM = {
    displayName: "",
    description: "",
    notes: "",
    discordCurrent: "",
    discordOld: "",
    redditCurrent: "",
    redditOld: "",
    nicknames: "",
    pronouns: "",
    sexuality: "",
    age: "",
    birthday: "",
    editReason: ""
}

const EDIT_FIELD_DEFINITIONS = [
    { key: "displayName", label: "Display Name", type: "text" },
    { key: "description", label: "Description", type: "text" },
    { key: "notes", label: "Notes", type: "text" },
    { key: "discordCurrent", label: "Discord Username", type: "text" },
    { key: "discordOld", label: "Old Discord Names", type: "csv" },
    { key: "redditCurrent", label: "Reddit Username", type: "text" },
    { key: "redditOld", label: "Old Reddit Names", type: "csv" },
    { key: "nicknames", label: "Nicknames", type: "csv" },
    { key: "pronouns", label: "Pronouns", type: "text" },
    { key: "sexuality", label: "Sexuality", type: "text" },
    { key: "age", label: "Age", type: "age" },
    { key: "birthday", label: "Birthday", type: "text" }
]

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

function normalizeCsvText(value) {
    const seen = new Set()
    const normalized = []
    for (const item of cleanText(value).split(",")) {
        const cleaned = item.trim()
        if (!cleaned) continue
        const key = cleaned.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        normalized.push(cleaned)
    }
    return normalized.join(", ")
}

function normalizeAgeText(value) {
    const cleaned = cleanText(value)
    if (!cleaned) return ""
    const parsed = Number(cleaned)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 120) return null
    return String(Math.floor(parsed))
}

function normalizeEditFieldValue(field, value) {
    if (field.type === "csv") return normalizeCsvText(value)
    if (field.type === "age") return normalizeAgeText(value)
    return cleanText(value)
}

function buildChangedFields(baseForm, nextForm) {
    const changedFields = []

    for (const field of EDIT_FIELD_DEFINITIONS) {
        const from = normalizeEditFieldValue(field, baseForm?.[field.key])
        const to = normalizeEditFieldValue(field, nextForm?.[field.key])

        if (field.type === "age" && to === null) {
            return {
                changedFields: [],
                error: "Age must be between 0 and 120."
            }
        }

        if (from !== to) {
            changedFields.push({
                field: field.key,
                label: field.label,
                from: from || "",
                to: to || ""
            })
        }
    }

    return {
        changedFields,
        error: ""
    }
}

function resolveActiveCommunity(discordUsername, redditUsername) {
    if (discordUsername && redditUsername) return "both"
    if (discordUsername) return "discord"
    if (redditUsername) return "reddit"
    return "both"
}

function userToEditForm(user) {
    const discordUsernames = normalizeList(user?.usernames?.discord)
    const redditUsernames = normalizeList(user?.usernames?.reddit)
    const nicknames = normalizeList(user?.nicknames)
    const ageValue = user?.age?.value

    return {
        displayName: cleanText(user?.id),
        description: cleanText(user?.description),
        notes: cleanText(user?.notes),
        discordCurrent: discordUsernames[0] || "",
        discordOld: discordUsernames.slice(1).join(", "),
        redditCurrent: redditUsernames[0] || "",
        redditOld: redditUsernames.slice(1).join(", "),
        nicknames: nicknames.join(", "),
        pronouns: cleanText(user?.pronouns),
        sexuality: cleanText(user?.sexuality),
        age: ageValue === null || ageValue === undefined ? "" : String(ageValue),
        birthday: cleanText(user?.birthday),
        editReason: ""
    }
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
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [editBaseForm, setEditBaseForm] = useState(EMPTY_EDIT_FORM)
    const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM)
    const [editSubmitState, setEditSubmitState] = useState({
        isSubmitting: false,
        error: "",
        success: "",
        submissionId: ""
    })

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

    useEffect(() => {
        if (userState.status !== "ready" || !userState.user) return
        const nextForm = userToEditForm(userState.user)
        setEditBaseForm(nextForm)
        setEditForm(nextForm)
        setIsEditOpen(false)
        setEditSubmitState({
            isSubmitting: false,
            error: "",
            success: "",
            submissionId: ""
        })
    }, [userId, userState.status, userState.user])

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

    const editDiffPreview = useMemo(
        () => buildChangedFields(editBaseForm, editForm),
        [editBaseForm, editForm]
    )

    const handleEditFieldChange = (event) => {
        const { name, value } = event.target
        setEditForm(prev => ({ ...prev, [name]: value }))
        setEditSubmitState(prev => ({
            ...prev,
            error: "",
            success: "",
            submissionId: ""
        }))
    }

    const resetEditForm = () => {
        setEditForm(editBaseForm)
        setEditSubmitState({
            isSubmitting: false,
            error: "",
            success: "",
            submissionId: ""
        })
    }

    const handleToggleEdit = () => {
        setIsEditOpen(prev => !prev)
        setEditSubmitState(prev => ({
            ...prev,
            error: "",
            success: "",
            submissionId: ""
        }))
    }

    const handleSubmitEditRequest = async (event) => {
        event.preventDefault()
        if (editSubmitState.isSubmitting) return

        if (editDiffPreview.error) {
            setEditSubmitState({
                isSubmitting: false,
                error: editDiffPreview.error,
                success: "",
                submissionId: ""
            })
            return
        }

        if (editDiffPreview.changedFields.length === 0) {
            setEditSubmitState({
                isSubmitting: false,
                error: "No changes detected. Update at least one field before submitting.",
                success: "",
                submissionId: ""
            })
            return
        }

        const displayName = cleanText(editForm.displayName) || cleanText(editBaseForm.displayName) || userId
        const activeCommunity = resolveActiveCommunity(
            cleanText(editForm.discordCurrent),
            cleanText(editForm.redditCurrent)
        )
        const payload = {
            requestType: "edit",
            targetUserSlug: userId,
            targetDisplayName: cleanText(editBaseForm.displayName) || userId,
            displayName,
            activeCommunity,
            changedFields: editDiffPreview.changedFields,
            extraDetails: cleanText(editForm.editReason),
            website: ""
        }

        setEditSubmitState({
            isSubmitting: true,
            error: "",
            success: "",
            submissionId: ""
        })

        try {
            const response = await fetch(apiUrl("/v1/submissions"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })

            const contentType = response.headers.get("Content-Type") || ""
            const data = contentType.includes("application/json")
                ? await response.json().catch(() => ({}))
                : {}
            if (!response.ok) {
                throw new Error(data?.error || "Failed to submit edit request.")
            }

            setEditSubmitState({
                isSubmitting: false,
                error: "",
                success: "Edit request sent to the admin inbox.",
                submissionId: cleanText(data?.id)
            })
            setIsEditOpen(false)
        } catch (submitError) {
            const rawMessage = String(submitError?.message || "")
            const lowered = rawMessage.toLowerCase()
            const message = (
                lowered.includes("networkerror")
                || lowered.includes("network error")
                || lowered.includes("failed to fetch")
            )
                ? "Could not reach the submissions service. Please wait a bit and try again."
                : (rawMessage || "Failed to submit edit request.")

            setEditSubmitState({
                isSubmitting: false,
                error: message,
                success: "",
                submissionId: ""
            })
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
    const changedFieldCount = editDiffPreview.error ? 0 : editDiffPreview.changedFields.length

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
                            <div className="user-card-actions">
                                <button
                                    type="button"
                                    className="user-refresh-button"
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                >
                                    {isRefreshing ? "Refreshing..." : "Refresh"}
                                </button>
                                <button
                                    type="button"
                                    className="user-edit-toggle-button"
                                    onClick={handleToggleEdit}
                                    disabled={editSubmitState.isSubmitting}
                                >
                                    {isEditOpen ? "Close Edit" : "Edit"}
                                </button>
                            </div>
                        </div>
                        <hr />
                        <p>{user.description}</p>

                        {isEditOpen && (
                            <form className="user-edit-form" onSubmit={handleSubmitEditRequest}>
                                <h2>Request a Page Edit</h2>
                                <p className="user-edit-hint">
                                    Only fields you changed are sent to admins.
                                </p>

                                <div className="user-edit-grid">
                                    <label className="user-edit-field">
                                        <span>Display Name</span>
                                        <input
                                            name="displayName"
                                            value={editForm.displayName}
                                            onChange={handleEditFieldChange}
                                        />
                                    </label>

                                    <label className="user-edit-field">
                                        <span>Discord Username</span>
                                        <input
                                            name="discordCurrent"
                                            value={editForm.discordCurrent}
                                            onChange={handleEditFieldChange}
                                        />
                                    </label>

                                    <label className="user-edit-field">
                                        <span>Old Discord Names</span>
                                        <input
                                            name="discordOld"
                                            value={editForm.discordOld}
                                            onChange={handleEditFieldChange}
                                            placeholder="name_1, name_2"
                                        />
                                    </label>

                                    <label className="user-edit-field">
                                        <span>Reddit Username</span>
                                        <input
                                            name="redditCurrent"
                                            value={editForm.redditCurrent}
                                            onChange={handleEditFieldChange}
                                        />
                                    </label>

                                    <label className="user-edit-field">
                                        <span>Old Reddit Names</span>
                                        <input
                                            name="redditOld"
                                            value={editForm.redditOld}
                                            onChange={handleEditFieldChange}
                                            placeholder="u/name_1, u/name_2"
                                        />
                                    </label>

                                    <label className="user-edit-field">
                                        <span>Nicknames</span>
                                        <input
                                            name="nicknames"
                                            value={editForm.nicknames}
                                            onChange={handleEditFieldChange}
                                            placeholder="nick_1, nick_2"
                                        />
                                    </label>

                                    <label className="user-edit-field">
                                        <span>Pronouns</span>
                                        <input
                                            name="pronouns"
                                            value={editForm.pronouns}
                                            onChange={handleEditFieldChange}
                                        />
                                    </label>

                                    <label className="user-edit-field">
                                        <span>Sexuality</span>
                                        <input
                                            name="sexuality"
                                            value={editForm.sexuality}
                                            onChange={handleEditFieldChange}
                                        />
                                    </label>

                                    <label className="user-edit-field">
                                        <span>Age</span>
                                        <input
                                            name="age"
                                            type="number"
                                            min={0}
                                            max={120}
                                            value={editForm.age}
                                            onChange={handleEditFieldChange}
                                        />
                                    </label>

                                    <label className="user-edit-field">
                                        <span>Birthday</span>
                                        <input
                                            name="birthday"
                                            value={editForm.birthday}
                                            onChange={handleEditFieldChange}
                                        />
                                    </label>

                                    <label className="user-edit-field user-edit-field-wide">
                                        <span>Description</span>
                                        <textarea
                                            name="description"
                                            rows={4}
                                            value={editForm.description}
                                            onChange={handleEditFieldChange}
                                        />
                                    </label>

                                    <label className="user-edit-field user-edit-field-wide">
                                        <span>Notes</span>
                                        <textarea
                                            name="notes"
                                            rows={4}
                                            value={editForm.notes}
                                            onChange={handleEditFieldChange}
                                        />
                                    </label>

                                    <label className="user-edit-field user-edit-field-wide">
                                        <span>Reason (optional)</span>
                                        <textarea
                                            name="editReason"
                                            rows={3}
                                            value={editForm.editReason}
                                            onChange={handleEditFieldChange}
                                        />
                                    </label>
                                </div>

                                {editSubmitState.error && (
                                    <p className="user-edit-message user-edit-error">{editSubmitState.error}</p>
                                )}

                                <div className="user-edit-actions">
                                    <span>{`${changedFieldCount} field${changedFieldCount === 1 ? "" : "s"} changed`}</span>
                                    <div className="user-edit-actions-buttons">
                                        <button type="button" onClick={resetEditForm} disabled={editSubmitState.isSubmitting}>
                                            Reset
                                        </button>
                                        <button type="submit" disabled={editSubmitState.isSubmitting}>
                                            {editSubmitState.isSubmitting ? "Sending..." : "Send Edit Request"}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {editSubmitState.success && (
                            <p className="user-edit-message user-edit-success">
                                {editSubmitState.success}
                                {editSubmitState.submissionId ? ` Submission ID: ${editSubmitState.submissionId}` : ""}
                            </p>
                        )}
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
