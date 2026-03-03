import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import "./Admin.css"
import { apiUrl } from "../lib/api.js"

const DEFAULT_AVATAR_URL = "https://cdn.discordapp.com/embed/avatars/0.png"

const EMPTY_USER_FORM = {
  slug: "",
  id: "",
  description: "",
  notes: "",
  nicknames: "",
  discordCurrent: "",
  discordOld: "",
  redditCurrent: "",
  redditOld: "",
  pronouns: "",
  sexuality: "",
  birthday: "",
  ageValue: "",
  ageTimestamp: "",
  pageTimestamp: "",
  discordAvatarUrl: "",
  redditAvatarUrl: ""
}

async function parseJsonResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || "Request failed")
  }
  return data
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function cleanNullableText(value) {
  const cleaned = cleanText(value)
  return cleaned || null
}

function normalizeList(list) {
  if (!Array.isArray(list)) return []
  const unique = new Set()
  const result = []
  for (const value of list) {
    if (typeof value !== "string") continue
    const cleaned = value.trim()
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (unique.has(key)) continue
    unique.add(key)
    result.push(cleaned)
  }
  return result
}

function csvToList(value) {
  return normalizeList(
    cleanText(value)
      .split(",")
      .map(item => item.trim())
      .filter(Boolean)
  )
}

function listToCsv(list) {
  return normalizeList(list).join(", ")
}

function toUnixTimestamp(value) {
  const cleaned = cleanText(value)
  if (!cleaned) return null
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

function normalizeSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "")
}

function toLocalDateTime(unixSeconds) {
  const parsed = Number(unixSeconds)
  if (!Number.isFinite(parsed) || parsed <= 0) return "Unknown"
  return new Date(parsed * 1000).toLocaleString()
}

function isDiscordAvatarUrl(value) {
  const cleaned = cleanText(value).toLowerCase()
  return cleaned.includes("cdn.discordapp.com")
}

function isRedditAvatarUrl(value) {
  const cleaned = cleanText(value).toLowerCase()
  return cleaned.includes("redditmedia.com")
}

function userToForm(slug, user) {
  const discordUsernames = normalizeList(user?.usernames?.discord)
  const redditUsernames = normalizeList(user?.usernames?.reddit)
  const nicknames = normalizeList(user?.nicknames)

  const primaryAvatarUrl = cleanText(user?.avatarUrl)
  const discordAvatarUrl = cleanText(user?.avatars?.discord)
    || (isDiscordAvatarUrl(primaryAvatarUrl) ? primaryAvatarUrl : "")
  const redditAvatarUrl = cleanText(user?.avatars?.reddit)
    || (isRedditAvatarUrl(primaryAvatarUrl) ? primaryAvatarUrl : "")

  return {
    slug: slug || "",
    id: cleanText(user?.id),
    description: cleanText(user?.description),
    notes: cleanText(user?.notes),
    nicknames: listToCsv(nicknames),
    discordCurrent: discordUsernames[0] || "",
    discordOld: listToCsv(discordUsernames.slice(1)),
    redditCurrent: redditUsernames[0] || "",
    redditOld: listToCsv(redditUsernames.slice(1)),
    pronouns: cleanText(user?.pronouns),
    sexuality: cleanText(user?.sexuality),
    birthday: cleanText(user?.birthday),
    ageValue: user?.age?.value === null || user?.age?.value === undefined ? "" : String(user.age.value),
    ageTimestamp: user?.age?.timestamp ? String(user.age.timestamp) : "",
    pageTimestamp: user?.timestamp ? String(user.timestamp) : "",
    discordAvatarUrl,
    redditAvatarUrl
  }
}

function formToUser(form) {
  const now = Math.floor(Date.now() / 1000)
  const discordCurrent = cleanText(form.discordCurrent)
  const redditCurrent = cleanText(form.redditCurrent)
  const discordOld = csvToList(form.discordOld)
  const redditOld = csvToList(form.redditOld)
  const nicknames = csvToList(form.nicknames)
  const ageValueText = cleanText(form.ageValue)

  let ageValue = null
  if (ageValueText) {
    const parsedAge = Number(ageValueText)
    if (Number.isFinite(parsedAge) && parsedAge >= 0 && parsedAge <= 120) {
      ageValue = Math.floor(parsedAge)
    }
  }

  const ageTimestamp = ageValue === null ? null : (toUnixTimestamp(form.ageTimestamp) || now)
  const pageTimestamp = toUnixTimestamp(form.pageTimestamp) || now

  const discordAvatarUrl = cleanNullableText(form.discordAvatarUrl)
  const redditAvatarUrl = cleanNullableText(form.redditAvatarUrl)
  const primaryAvatarUrl = discordAvatarUrl || redditAvatarUrl || DEFAULT_AVATAR_URL

  return {
    id: cleanText(form.id),
    avatarUrl: primaryAvatarUrl,
    avatars: {
      discord: discordAvatarUrl,
      reddit: redditAvatarUrl
    },
    notes: cleanNullableText(form.notes),
    usernames: {
      discord: discordCurrent ? [discordCurrent, ...discordOld] : [null],
      reddit: redditCurrent ? [redditCurrent, ...redditOld] : [null]
    },
    nicknames: nicknames.length > 0 ? nicknames : [null],
    description: cleanText(form.description),
    pronouns: cleanNullableText(form.pronouns),
    sexuality: cleanNullableText(form.sexuality),
    age: {
      value: ageValue,
      timestamp: ageTimestamp
    },
    birthday: cleanNullableText(form.birthday),
    timestamp: pageTimestamp
  }
}

function ReadonlyField({ label, value, multiline = false }) {
  const text = cleanText(value)

  return (
    <div className="admin-readonly-field">
      <label>{label}</label>
      {multiline ? (
        <textarea readOnly value={text} rows={4} />
      ) : (
        <input readOnly value={text} />
      )}
    </div>
  )
}

function AvatarTile({ label, url }) {
  const cleaned = cleanText(url)
  return (
    <div className="admin-avatar-tile">
      <span>{label}</span>
      {cleaned ? (
        <img src={cleaned} alt={`${label} avatar`} />
      ) : (
        <div className="admin-avatar-missing">No avatar</div>
      )}
    </div>
  )
}

function Admin() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [authMessage, setAuthMessage] = useState("")
  const [activeTab, setActiveTab] = useState("applications")

  const [statusFilter, setStatusFilter] = useState("pending")
  const [submissions, setSubmissions] = useState([])
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("")
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [reviewNote, setReviewNote] = useState("")
  const [slugOverride, setSlugOverride] = useState("")
  const [promoteToUsers, setPromoteToUsers] = useState(true)
  const [queueMessage, setQueueMessage] = useState("")
  const [queueError, setQueueError] = useState("")
  const [queueLoading, setQueueLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [users, setUsers] = useState([])
  const [selectedUserSlug, setSelectedUserSlug] = useState("")
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [userSearch, setUserSearch] = useState("")
  const [activeUserSection, setActiveUserSection] = useState("identity")
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM)
  const [userMessage, setUserMessage] = useState("")
  const [userError, setUserError] = useState("")
  const [userLoading, setUserLoading] = useState(false)
  const [usersListLoading, setUsersListLoading] = useState(false)
  const hasLoadedUsersRef = useRef(false)

  const selectedSubmissionPayload = useMemo(
    () => selectedSubmission?.payload || null,
    [selectedSubmission]
  )
  const selectedUserSummary = useMemo(
    () => users.find(item => item.slug === selectedUserSlug) || null,
    [selectedUserSlug, users]
  )

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase()
    if (!search) return users
    return users.filter(item => (
      item.slug.toLowerCase().includes(search)
      || String(item.user_id || "").toLowerCase().includes(search)
    ))
  }, [userSearch, users])

  const checkSession = async () => {
    try {
      await parseJsonResponse(await fetch(apiUrl("/v1/admin/session"), { credentials: "include" }))
      setIsAuthed(true)
      setAuthError("")
    } catch {
      setIsAuthed(false)
    } finally {
      setAuthChecked(true)
    }
  }

  const loadSubmissions = useCallback(async (status) => {
    setQueueLoading(true)
    setQueueError("")
    try {
      const data = await parseJsonResponse(
        await fetch(apiUrl(`/v1/admin/submissions?status=${encodeURIComponent(status)}&limit=100`), {
          credentials: "include"
        })
      )
      const nextSubmissions = data.submissions || []
      setSubmissions(nextSubmissions)
      if (nextSubmissions.length > 0) {
        const nextId = selectedSubmissionId && nextSubmissions.some(item => item.id === selectedSubmissionId)
          ? selectedSubmissionId
          : nextSubmissions[0].id
        setSelectedSubmissionId(nextId)
      } else {
        setSelectedSubmissionId("")
        setSelectedSubmission(null)
      }
    } catch (error) {
      setQueueError(error.message)
      setSubmissions([])
      setSelectedSubmissionId("")
      setSelectedSubmission(null)
    } finally {
      setQueueLoading(false)
    }
  }, [selectedSubmissionId])

  const loadSubmissionDetail = useCallback(async (submissionId) => {
    if (!submissionId) {
      setSelectedSubmission(null)
      return
    }

    try {
      const data = await parseJsonResponse(
        await fetch(apiUrl(`/v1/admin/submissions/${submissionId}`), {
          credentials: "include"
        })
      )
      setSelectedSubmission(data.submission || null)
      setReviewNote(data.submission?.review_note || "")
      setSlugOverride("")
      setQueueError("")
    } catch (error) {
      setSelectedSubmission(null)
      setQueueError(error.message)
    }
  }, [])

  const loadUsers = useCallback(async (options = {}) => {
    const { keepSelection = true, showLoader = true } = options
    if (showLoader) {
      setUsersListLoading(true)
    }
    setUserError("")
    try {
      const data = await parseJsonResponse(
        await fetch(apiUrl("/v1/admin/users"), { credentials: "include" })
      )
      const nextUsers = data.users || []
      setUsers(nextUsers)
      if (!isCreatingUser && nextUsers.length > 0) {
        setSelectedUserSlug(previousSlug => {
          if (keepSelection && previousSlug && nextUsers.some(item => item.slug === previousSlug)) {
            return previousSlug
          }
          return nextUsers[0].slug
        })
      }
      if (!isCreatingUser && nextUsers.length === 0) {
        setSelectedUserSlug("")
      }
    } catch (error) {
      setUserError(error.message)
      setUsers([])
      if (!isCreatingUser) {
        setSelectedUserSlug("")
      }
    } finally {
      hasLoadedUsersRef.current = true
      if (showLoader) {
        setUsersListLoading(false)
      }
    }
  }, [isCreatingUser])

  const loadUserDetail = useCallback(async (slug) => {
    if (!slug) return

    setUserError("")
    try {
      const data = await parseJsonResponse(
        await fetch(apiUrl(`/v1/admin/users/${encodeURIComponent(slug)}`), {
          credentials: "include"
        })
      )
      setUserForm(userToForm(data.slug || slug, data.user || {}))
    } catch (error) {
      setUserError(error.message)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [])

  useEffect(() => {
    if (!isAuthed) return
    if (activeTab === "applications") {
      loadSubmissions(statusFilter)
    } else if (activeTab === "users") {
      loadUsers({ keepSelection: true, showLoader: !hasLoadedUsersRef.current })
    }
  }, [isAuthed, activeTab, statusFilter, loadSubmissions, loadUsers])

  useEffect(() => {
    if (!isAuthed || activeTab !== "applications") return
    loadSubmissionDetail(selectedSubmissionId)
  }, [isAuthed, activeTab, selectedSubmissionId, loadSubmissionDetail])

  useEffect(() => {
    if (!isAuthed || activeTab !== "users" || isCreatingUser) return
    if (!selectedUserSlug) {
      setUserForm(EMPTY_USER_FORM)
      return
    }
    loadUserDetail(selectedUserSlug)
  }, [isAuthed, activeTab, isCreatingUser, selectedUserSlug, loadUserDetail])

  const login = async (event) => {
    event.preventDefault()
    setAuthError("")
    setAuthMessage("")
    try {
      await parseJsonResponse(
        await fetch(apiUrl("/v1/admin/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ password })
        })
      )
      setIsAuthed(true)
      setPassword("")
      setAuthMessage("Logged in.")
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const logout = async () => {
    try {
      await parseJsonResponse(
        await fetch(apiUrl("/v1/admin/logout"), {
          method: "POST",
          credentials: "include"
        })
      )
    } catch {
      // Ignore logout errors and clear local state anyway.
    }
    setIsAuthed(false)
    setSelectedSubmission(null)
    setSelectedSubmissionId("")
    setUsers([])
    setUsersListLoading(false)
    hasLoadedUsersRef.current = false
    setSelectedUserSlug("")
    setUserForm(EMPTY_USER_FORM)
    setAuthMessage("Logged out.")
  }

  const changeSubmissionStatus = async (status) => {
    if (!selectedSubmissionId) return
    setActionLoading(true)
    setQueueError("")
    setQueueMessage("")
    try {
      const data = await parseJsonResponse(
        await fetch(apiUrl(`/v1/admin/submissions/${selectedSubmissionId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            status,
            reviewNote,
            slug: slugOverride || undefined,
            promoteToUsers: status === "approved" ? promoteToUsers : false,
            reviewedBy: "admin-ui"
          })
        })
      )
      setQueueMessage(
        `Updated to ${status}${data.userSlug ? ` (user: ${data.userSlug})` : ""}.`
      )
      await loadSubmissions(statusFilter)
      if (activeTab === "users") {
        await loadUsers({ keepSelection: true, showLoader: false })
      }
    } catch (error) {
      setQueueError(error.message)
    } finally {
      setActionLoading(false)
    }
  }

  const updateUserField = (event) => {
    const { name, value } = event.target
    setUserForm(prev => ({ ...prev, [name]: value }))
    setUserMessage("")
    setUserError("")
  }

  const startCreatingUser = () => {
    setIsCreatingUser(true)
    setSelectedUserSlug("")
    setActiveUserSection("identity")
    setUserMessage("")
    setUserError("")
    setUserForm({
      ...EMPTY_USER_FORM,
      pageTimestamp: String(Math.floor(Date.now() / 1000))
    })
  }

  const selectExistingUser = (slug) => {
    if (!slug) {
      setIsCreatingUser(false)
      setSelectedUserSlug("")
      return
    }
    setIsCreatingUser(false)
    setSelectedUserSlug(slug)
    setUserMessage("")
    setUserError("")
  }

  const saveUser = async () => {
    const slug = normalizeSlug(isCreatingUser ? userForm.slug : selectedUserSlug)
    if (!slug) {
      setUserError("User slug is required.")
      return
    }

    if (!cleanText(userForm.id)) {
      setUserError("Display name (id) is required.")
      return
    }

    if (isCreatingUser && users.some(item => item.slug === slug)) {
      setUserError("That slug already exists.")
      return
    }

    setUserLoading(true)
    setUserError("")
    setUserMessage("")
    try {
      const user = formToUser(userForm)
      await parseJsonResponse(
        await fetch(apiUrl(`/v1/admin/users/${encodeURIComponent(slug)}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user })
        })
      )
      setUserMessage(isCreatingUser ? "User created." : "User updated.")
      setIsCreatingUser(false)
      setSelectedUserSlug(slug)
      await loadUsers({ keepSelection: true, showLoader: false })
      await loadUserDetail(slug)
    } catch (error) {
      setUserError(error.message)
    } finally {
      setUserLoading(false)
    }
  }

  const deleteUser = async () => {
    if (isCreatingUser || !selectedUserSlug) return
    const confirmed = window.confirm(`Delete user "${selectedUserSlug}"? This cannot be undone.`)
    if (!confirmed) return

    setUserLoading(true)
    setUserError("")
    setUserMessage("")
    try {
      await parseJsonResponse(
        await fetch(apiUrl(`/v1/admin/users/${encodeURIComponent(selectedUserSlug)}`), {
          method: "DELETE",
          credentials: "include"
        })
      )
      setUserMessage(`Deleted ${selectedUserSlug}.`)
      setSelectedUserSlug("")
      setUserForm(EMPTY_USER_FORM)
      await loadUsers({ keepSelection: false, showLoader: false })
    } catch (error) {
      setUserError(error.message)
    } finally {
      setUserLoading(false)
    }
  }

  const refreshUserAvatars = async () => {
    if (isCreatingUser || !selectedUserSlug) return

    setUserLoading(true)
    setUserError("")
    setUserMessage("")
    try {
      await parseJsonResponse(
        await fetch(apiUrl(`/v1/admin/users/${encodeURIComponent(selectedUserSlug)}/refresh-avatars`), {
          method: "POST",
          credentials: "include"
        })
      )
      setUserMessage("Avatar refresh complete.")
      await loadUsers({ keepSelection: true, showLoader: false })
      await loadUserDetail(selectedUserSlug)
    } catch (error) {
      setUserError(error.message)
    } finally {
      setUserLoading(false)
    }
  }

  if (!authChecked) {
    return (
      <div className="main-content admin-page">
        <section className="admin-card">
          <h1>Admin</h1>
          <p>Checking session...</p>
        </section>
      </div>
    )
  }

  if (!isAuthed) {
    return (
      <div className="main-content admin-page">
        <section className="admin-card admin-login">
          <h1>Admin Access</h1>
          <p>Enter the admin password to continue.</p>

          <form onSubmit={login}>
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="submit">Log In</button>
          </form>

          {authError && <p className="admin-message admin-error">{authError}</p>}
          {authMessage && <p className="admin-message admin-success">{authMessage}</p>}
        </section>
      </div>
    )
  }

  return (
    <div className="main-content admin-page">
      <section className="admin-card">
        <header className="admin-header">
          <h1>Admin Panel</h1>
          <div className="admin-mode-switch">
            <button
              type="button"
              className={activeTab === "applications" ? "active" : ""}
              onClick={() => setActiveTab("applications")}
            >
              <strong>Applications</strong>
              <span>Review submissions</span>
            </button>
            <button
              type="button"
              className={activeTab === "users" ? "active" : ""}
              onClick={() => setActiveTab("users")}
            >
              <strong>Users</strong>
              <span>Edit profiles</span>
            </button>
          </div>
          <div className="admin-header-actions">
            <button type="button" onClick={logout}>Log Out</button>
          </div>
        </header>

        {activeTab === "applications" && (
          <div className="admin-grid">
            <aside className="admin-list">
              <div className="admin-filter">
                <label htmlFor="submission-status">Status</label>
                <select
                  id="submission-status"
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="spam">Spam</option>
                  <option value="all">All</option>
                </select>
              </div>

              {queueLoading && <p>Loading submissions...</p>}
              {!queueLoading && submissions.length === 0 && <p>No submissions found.</p>}

              <div className="admin-list-scroll">
                {submissions.map(item => (
                  <button
                    type="button"
                    key={item.id}
                    className={`admin-list-item ${item.id === selectedSubmissionId ? "selected" : ""}`}
                    onClick={() => setSelectedSubmissionId(item.id)}
                  >
                    <strong>{item.display_name}</strong>
                    <span>{item.status}</span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="admin-detail">
              {!selectedSubmission && <p>Select a submission to review.</p>}

              {selectedSubmission && (
                <>
                  <h2>{selectedSubmission.display_name}</h2>
                  <p>{`Submitted: ${toLocalDateTime(selectedSubmission.created_at)}`}</p>
                  <p>{`Community: ${selectedSubmission.active_community}`}</p>
                  <p>{`Current status: ${selectedSubmission.status}`}</p>

                  <div className="admin-avatar-grid">
                    <AvatarTile label="Discord Avatar" url={selectedSubmissionPayload?.avatars?.discord} />
                    <AvatarTile label="Reddit Avatar" url={selectedSubmissionPayload?.avatars?.reddit} />
                  </div>

                  <div className="admin-readonly-grid">
                    <ReadonlyField label="Display Name" value={selectedSubmissionPayload?.displayName} />
                    <ReadonlyField label="Active On" value={selectedSubmissionPayload?.activeCommunity} />
                    <ReadonlyField label="Discord Username" value={selectedSubmissionPayload?.socials?.discord?.current} />
                    <ReadonlyField label="Discord Old Names" value={listToCsv(selectedSubmissionPayload?.socials?.discord?.old)} />
                    <ReadonlyField label="Reddit Username" value={selectedSubmissionPayload?.socials?.reddit?.current} />
                    <ReadonlyField label="Reddit Old Names" value={listToCsv(selectedSubmissionPayload?.socials?.reddit?.old)} />
                    <ReadonlyField label="Nicknames" value={listToCsv(selectedSubmissionPayload?.nicknames)} />
                    <ReadonlyField label="Pronouns" value={selectedSubmissionPayload?.details?.pronouns} />
                    <ReadonlyField label="Gender" value={selectedSubmissionPayload?.details?.gender} />
                    <ReadonlyField label="Sexuality" value={selectedSubmissionPayload?.details?.sexuality} />
                    <ReadonlyField label="Age" value={selectedSubmissionPayload?.details?.age} />
                    <ReadonlyField label="Birthday" value={selectedSubmissionPayload?.details?.birthday} />
                  </div>

                  <ReadonlyField
                    label="Description"
                    value={selectedSubmissionPayload?.description}
                    multiline
                  />
                  <ReadonlyField
                    label="Extra Details"
                    value={selectedSubmissionPayload?.extraDetails}
                    multiline
                  />

                  <label htmlFor="review-note">Review Note</label>
                  <textarea
                    id="review-note"
                    value={reviewNote}
                    onChange={event => setReviewNote(event.target.value)}
                    rows={4}
                  />

                  <label htmlFor="slug-override">Slug Override (optional)</label>
                  <input
                    id="slug-override"
                    value={slugOverride}
                    onChange={event => setSlugOverride(event.target.value)}
                    placeholder="example_user"
                  />

                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={promoteToUsers}
                      onChange={event => setPromoteToUsers(event.target.checked)}
                    />
                    Promote approved submission into users
                  </label>

                  <div className="admin-actions">
                    <button type="button" disabled={actionLoading} onClick={() => changeSubmissionStatus("approved")}>
                      Approve
                    </button>
                    <button type="button" disabled={actionLoading} onClick={() => changeSubmissionStatus("rejected")}>
                      Reject
                    </button>
                    <button type="button" disabled={actionLoading} onClick={() => changeSubmissionStatus("spam")}>
                      Mark Spam
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {activeTab === "users" && (
          <div className="admin-grid">
            <aside className="admin-list">
              <div className="admin-users-top">
                <button type="button" className="admin-create-button" onClick={startCreatingUser}>
                  + Add User
                </button>

                <label htmlFor="admin-user-search">Find User</label>
                <input
                  id="admin-user-search"
                  type="text"
                  value={userSearch}
                  onChange={event => setUserSearch(event.target.value)}
                  placeholder="Search by slug or display name"
                  disabled={isCreatingUser}
                />
              </div>

              {usersListLoading && users.length === 0 && <p>Loading users...</p>}
              {!usersListLoading && users.length === 0 && <p>No users found.</p>}

              <div className="admin-list-scroll">
                {filteredUsers.map(item => (
                  <button
                    type="button"
                    key={item.slug}
                    className={`admin-list-item ${item.slug === selectedUserSlug && !isCreatingUser ? "selected" : ""}`}
                    onClick={() => selectExistingUser(item.slug)}
                  >
                    <div className="admin-user-list-row">
                      <img
                        src={item.avatar_url || item.discord_avatar_url || item.reddit_avatar_url || DEFAULT_AVATAR_URL}
                        alt={`${item.slug} avatar`}
                      />
                      <div>
                        <strong>{item.slug}</strong>
                        <span>{item.user_id}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="admin-detail">
              {!isCreatingUser && !selectedUserSlug && <p>Select a user to edit, or create a new user.</p>}

              {(isCreatingUser || selectedUserSlug) && (
                <>
                  <div className="admin-user-editor-header">
                    <h2>{isCreatingUser ? "Create User" : selectedUserSlug}</h2>
                    {!isCreatingUser && selectedUserSummary && (
                      <p>{`Last updated: ${toLocalDateTime(selectedUserSummary.updated_at)}`}</p>
                    )}
                  </div>

                  <div className="admin-section-tabs" role="tablist" aria-label="User editor sections">
                    <button
                      type="button"
                      className={activeUserSection === "identity" ? "active" : ""}
                      onClick={() => setActiveUserSection("identity")}
                    >
                      Identity
                    </button>
                    <button
                      type="button"
                      className={activeUserSection === "handles" ? "active" : ""}
                      onClick={() => setActiveUserSection("handles")}
                    >
                      Handles
                    </button>
                    <button
                      type="button"
                      className={activeUserSection === "profile" ? "active" : ""}
                      onClick={() => setActiveUserSection("profile")}
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      className={activeUserSection === "details" ? "active" : ""}
                      onClick={() => setActiveUserSection("details")}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className={activeUserSection === "avatars" ? "active" : ""}
                      onClick={() => setActiveUserSection("avatars")}
                    >
                      Avatars
                    </button>
                  </div>

                  {activeUserSection === "identity" && (
                    <div className="admin-form-grid">
                      <div className="admin-form-field">
                        <label htmlFor="user-slug">Slug *</label>
                        <input
                          id="user-slug"
                          name="slug"
                          value={isCreatingUser ? userForm.slug : selectedUserSlug}
                          onChange={updateUserField}
                          disabled={!isCreatingUser}
                          placeholder="example_user"
                        />
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor="user-id">Display Name *</label>
                        <input
                          id="user-id"
                          name="id"
                          value={userForm.id}
                          onChange={updateUserField}
                          placeholder="example_user"
                        />
                      </div>

                      <div className="admin-form-field admin-form-field-wide">
                        <label htmlFor="user-nicknames">Nicknames</label>
                        <input
                          id="user-nicknames"
                          name="nicknames"
                          value={userForm.nicknames}
                          onChange={updateUserField}
                          placeholder="nick_1, nick_2"
                        />
                      </div>
                    </div>
                  )}

                  {activeUserSection === "handles" && (
                    <div className="admin-form-grid">
                      <div className="admin-form-field">
                        <label htmlFor="user-discord-current">Discord Username</label>
                        <input
                          id="user-discord-current"
                          name="discordCurrent"
                          value={userForm.discordCurrent}
                          onChange={updateUserField}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor="user-discord-old">Old Discord Names</label>
                        <input
                          id="user-discord-old"
                          name="discordOld"
                          value={userForm.discordOld}
                          onChange={updateUserField}
                          placeholder="name_1, name_2"
                        />
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor="user-reddit-current">Reddit Username</label>
                        <input
                          id="user-reddit-current"
                          name="redditCurrent"
                          value={userForm.redditCurrent}
                          onChange={updateUserField}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor="user-reddit-old">Old Reddit Names</label>
                        <input
                          id="user-reddit-old"
                          name="redditOld"
                          value={userForm.redditOld}
                          onChange={updateUserField}
                          placeholder="u/name_1, u/name_2"
                        />
                      </div>

                    </div>
                  )}

                  {activeUserSection === "profile" && (
                    <div className="admin-form-grid">
                      <div className="admin-form-field admin-form-field-wide">
                        <label htmlFor="user-description">Description *</label>
                        <textarea
                          id="user-description"
                          name="description"
                          value={userForm.description}
                          onChange={updateUserField}
                          rows={6}
                        />
                      </div>

                      <div className="admin-form-field admin-form-field-wide">
                        <label htmlFor="user-notes">Notes</label>
                        <textarea
                          id="user-notes"
                          name="notes"
                          value={userForm.notes}
                          onChange={updateUserField}
                          rows={5}
                        />
                      </div>
                    </div>
                  )}

                  {activeUserSection === "details" && (
                    <div className="admin-form-grid">
                      <div className="admin-form-field">
                        <label htmlFor="user-pronouns">Pronouns</label>
                        <input
                          id="user-pronouns"
                          name="pronouns"
                          value={userForm.pronouns}
                          onChange={updateUserField}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor="user-sexuality">Sexuality</label>
                        <input
                          id="user-sexuality"
                          name="sexuality"
                          value={userForm.sexuality}
                          onChange={updateUserField}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor="user-birthday">Birthday</label>
                        <input
                          id="user-birthday"
                          name="birthday"
                          value={userForm.birthday}
                          onChange={updateUserField}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor="user-age-value">Age</label>
                        <input
                          id="user-age-value"
                          name="ageValue"
                          type="number"
                          min={0}
                          max={120}
                          value={userForm.ageValue}
                          onChange={updateUserField}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor="user-age-timestamp">Age Timestamp (unix)</label>
                        <input
                          id="user-age-timestamp"
                          name="ageTimestamp"
                          value={userForm.ageTimestamp}
                          onChange={updateUserField}
                        />
                      </div>

                      <div className="admin-form-field">
                        <label htmlFor="user-page-timestamp">Page Updated (unix)</label>
                        <input
                          id="user-page-timestamp"
                          name="pageTimestamp"
                          value={userForm.pageTimestamp}
                          onChange={updateUserField}
                        />
                      </div>
                    </div>
                  )}

                  {activeUserSection === "avatars" && (
                    <>
                      <div className="admin-avatar-grid">
                        <AvatarTile label="Discord Avatar" url={userForm.discordAvatarUrl} />
                        <AvatarTile label="Reddit Avatar" url={userForm.redditAvatarUrl} />
                      </div>

                      <div className="admin-form-grid">
                        <div className="admin-form-field">
                          <label htmlFor="user-discord-avatar">Discord Avatar URL</label>
                          <input
                            id="user-discord-avatar"
                            name="discordAvatarUrl"
                            value={userForm.discordAvatarUrl}
                            onChange={updateUserField}
                          />
                        </div>

                        <div className="admin-form-field">
                          <label htmlFor="user-reddit-avatar">Reddit Avatar URL</label>
                          <input
                            id="user-reddit-avatar"
                            name="redditAvatarUrl"
                            value={userForm.redditAvatarUrl}
                            onChange={updateUserField}
                          />
                        </div>
                      </div>

                      <p className="admin-avatar-note">
                        Primary avatar is automatic now: Discord avatar first, then Reddit avatar.
                      </p>
                    </>
                  )}

                  <div className="admin-actions">
                    <button type="button" disabled={userLoading} onClick={saveUser}>
                      {isCreatingUser ? "Create User" : "Save User"}
                    </button>
                    {!isCreatingUser && (
                      <>
                        <button type="button" disabled={userLoading} onClick={refreshUserAvatars}>
                          Refresh Avatars
                        </button>
                        <button type="button" disabled={userLoading} className="admin-danger" onClick={deleteUser}>
                          Delete User
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {queueError && <p className="admin-message admin-error">{queueError}</p>}
        {queueMessage && <p className="admin-message admin-success">{queueMessage}</p>}
        {userError && <p className="admin-message admin-error">{userError}</p>}
        {userMessage && <p className="admin-message admin-success">{userMessage}</p>}
        {authMessage && <p className="admin-message admin-success">{authMessage}</p>}
      </section>
    </div>
  )
}

export default Admin
