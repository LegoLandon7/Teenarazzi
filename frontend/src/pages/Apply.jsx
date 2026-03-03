import { useEffect, useRef, useState } from "react"

import "../css/tools/flex-container.css"
import "../css/tools/dividers.css"
import "./Apply.css"
import { apiUrl } from "../lib/api.js"

const STEPS = [
    { id: "identity", title: "Identity", hint: "Pick your main profile name." },
    { id: "community", title: "Community", hint: "Choose Discord, Reddit, or both." },
    { id: "writeup", title: "Writeup", hint: "Write the text for your profile page." },
    { id: "details", title: "Optional Details", hint: "Add any extra public details." },
    { id: "finish", title: "Final Check", hint: "Answer the required question." }
]

const INITIAL_FORM = {
    displayName: "",
    activeCommunity: "",
    discordUsername: "",
    discordOldUsernames: "",
    redditUsername: "",
    redditOldUsernames: "",
    nicknames: "",
    description: "",
    pronouns: "",
    gender: "",
    sexuality: "",
    age: "",
    birthday: "",
    extraDetails: "",
    middyGoat: "",
    website: ""
}

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim()
const TURNSTILE_SCRIPT_ID = "cf-turnstile-script"
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

function ensureTurnstileScript() {
    if (typeof window === "undefined") return
    if (document.getElementById(TURNSTILE_SCRIPT_ID)) return

    const script = document.createElement("script")
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    document.head.appendChild(script)
}

function Apply() {
    const [formData, setFormData] = useState(INITIAL_FORM)
    const [stepIndex, setStepIndex] = useState(0)
    const [error, setError] = useState("")
    const [submitted, setSubmitted] = useState(false)
    const [submissionId, setSubmissionId] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [turnstileToken, setTurnstileToken] = useState("")
    const turnstileContainerRef = useRef(null)
    const turnstileWidgetIdRef = useRef(null)

    const isFinalStep = stepIndex === STEPS.length - 1

    const resetTurnstile = () => {
        if (!TURNSTILE_SITE_KEY) return
        setTurnstileToken("")

        const widgetId = turnstileWidgetIdRef.current
        if (widgetId === null || widgetId === undefined) return
        if (!window.turnstile || typeof window.turnstile.reset !== "function") return

        try {
            window.turnstile.reset(widgetId)
        } catch {
            // Ignore widget reset errors and keep form usable.
        }
    }

    useEffect(() => {
        if (!TURNSTILE_SITE_KEY) return

        ensureTurnstileScript()
        let cancelled = false

        const tryRender = () => {
            if (cancelled) return
            if (turnstileWidgetIdRef.current !== null) return
            if (!turnstileContainerRef.current) return
            if (!window.turnstile || typeof window.turnstile.render !== "function") return

            try {
                turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
                    sitekey: TURNSTILE_SITE_KEY,
                    callback: token => setTurnstileToken(typeof token === "string" ? token : ""),
                    "expired-callback": () => setTurnstileToken(""),
                    "error-callback": () => setTurnstileToken("")
                })
            } catch {
                // Ignore render errors and keep polling while script initializes.
            }
        }

        const intervalId = setInterval(tryRender, 200)
        tryRender()

        return () => {
            cancelled = true
            clearInterval(intervalId)

            const widgetId = turnstileWidgetIdRef.current
            if (
                widgetId !== null
                && widgetId !== undefined
                && window.turnstile
                && typeof window.turnstile.remove === "function"
            ) {
                try {
                    window.turnstile.remove(widgetId)
                } catch {
                    // Ignore widget remove errors during unmount.
                }
            }
            turnstileWidgetIdRef.current = null
        }
    }, [])

    const updateField = (event) => {
        const { name, value } = event.target
        setSubmitted(false)
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const validateStep = (index) => {
        if (index === 0 && !formData.displayName.trim()) {
            return "Please enter a display name."
        }

        if (index === 1) {
            if (!formData.activeCommunity) return "Choose where you are active."
            if (formData.activeCommunity === "discord" && !formData.discordUsername.trim()) {
                return "Please enter your Discord username."
            }
            if (formData.activeCommunity === "reddit" && !formData.redditUsername.trim()) {
                return "Please enter your Reddit username."
            }
            if (formData.activeCommunity === "both" && (!formData.discordUsername.trim() || !formData.redditUsername.trim())) {
                return "Please enter both Discord and Reddit usernames."
            }
        }

        if (index === 2 && !formData.description.trim()) {
            return "Please add a short description."
        }

        if (index === 3 && formData.age.trim()) {
            const age = Number(formData.age)
            if (!Number.isFinite(age) || age < 0 || age > 120) {
                return "Age must be between 0 and 120."
            }
        }

        if (index === 4 && !formData.middyGoat) {
            return "Please answer the required question."
        }

        return null
    }

    const goNext = () => {
        const validationError = validateStep(stepIndex)
        if (validationError) {
            setError(validationError)
            return
        }

        setError("")
        setStepIndex(prev => Math.min(prev + 1, STEPS.length - 1))
    }

    const goBack = () => {
        if (isSubmitting) return
        setSubmitted(false)
        setError("")
        setStepIndex(prev => Math.max(prev - 1, 0))
    }

    const handleSubmit = (event) => {
        event.preventDefault()
        if (isSubmitting) return

        const validationError = validateStep(stepIndex)
        if (validationError) {
            setError(validationError)
            setSubmitted(false)
            return
        }

        if (TURNSTILE_SITE_KEY && !turnstileToken) {
            setError("Please complete the spam check before submitting.")
            setSubmitted(false)
            return
        }

        const requestBody = {
            ...formData,
            displayName: formData.displayName.trim(),
            nicknames: formData.nicknames.trim(),
            discordUsername: formData.discordUsername.trim(),
            discordOldUsernames: formData.discordOldUsernames.trim(),
            redditUsername: formData.redditUsername.trim(),
            redditOldUsernames: formData.redditOldUsernames.trim(),
            description: formData.description.trim(),
            pronouns: formData.pronouns.trim(),
            gender: formData.gender.trim(),
            sexuality: formData.sexuality.trim(),
            age: formData.age.trim(),
            birthday: formData.birthday.trim(),
            extraDetails: formData.extraDetails.trim(),
            website: formData.website.trim(),
            ...(TURNSTILE_SITE_KEY ? { turnstileToken } : {})
        }

        setIsSubmitting(true)
        setSubmissionId("")
        setError("")
        setSubmitted(false)

        fetch(apiUrl("/v1/submissions"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        })
            .then(async (res) => {
                const contentType = res.headers.get("Content-Type") || ""
                const data = contentType.includes("application/json")
                    ? await res.json().catch(() => ({}))
                    : {}
                if (!res.ok) {
                    if (res.status === 429) {
                        throw new Error(data?.error || "Too many submissions. Please wait and try again later.")
                    }
                    throw new Error(data?.error || "Failed to submit form.")
                }
                return data
            })
            .then((data) => {
                setSubmissionId(data?.id || "")
                setSubmitted(true)
                setError("")
            })
            .catch((submitError) => {
                setSubmitted(false)
                const rawMessage = String(submitError?.message || "")
                const lowered = rawMessage.toLowerCase()
                if (
                    lowered.includes("networkerror")
                    || lowered.includes("network error")
                    || lowered.includes("failed to fetch")
                ) {
                    setError("Could not reach the submissions service. Please wait a bit and try again.")
                    return
                }
                setError(rawMessage || "Failed to submit form.")
            })
            .finally(() => {
                setIsSubmitting(false)
                resetTurnstile()
            })
    }

    const progressPercent = ((stepIndex + 1) / STEPS.length) * 100

    if (submitted) {
        return (
            <div className="main-content apply-page">
                <section className="apply-card apply-complete-card">
                    <header className="apply-top">
                        <h1>Application Submitted</h1>
                    </header>

                    <div className="apply-complete-body">
                        <p>Your application was sent successfully and is now pending review.</p>
                        {submissionId && (
                            <p className="apply-complete-id">{`Submission ID: ${submissionId}`}</p>
                        )}
                    </div>
                </section>
            </div>
        )
    }

    return (
        <div className="main-content apply-page">
            <section className="apply-card">
                <header className="apply-top">
                    <h1>User Page Application</h1>
                    <span className="apply-step-counter">{`Step ${stepIndex + 1}/${STEPS.length}`}</span>
                </header>

                <div className="apply-progress-track" aria-hidden="true">
                    <div className="apply-progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>

                <form className="apply-form" onSubmit={handleSubmit} noValidate>
                    <input
                        type="text"
                        name="website"
                        value={formData.website}
                        onChange={updateField}
                        autoComplete="off"
                        tabIndex={-1}
                        className="apply-honeypot"
                        aria-hidden="true"
                    />

                    <div className="apply-step-header">
                        <h2>{STEPS[stepIndex].title}</h2>
                        <p>{STEPS[stepIndex].hint}</p>
                    </div>

                    {stepIndex === 0 && (
                        <fieldset className="apply-group" aria-label="Identity">
                            <label htmlFor="displayName">Display Name *</label>
                            <input
                                id="displayName"
                                name="displayName"
                                type="text"
                                value={formData.displayName}
                                onChange={updateField}
                                placeholder="example_user"
                            />

                            <label htmlFor="nicknames">Nicknames (comma-separated)</label>
                            <input
                                id="nicknames"
                                name="nicknames"
                                type="text"
                                value={formData.nicknames}
                                onChange={updateField}
                                placeholder="lego, TheLegoGuy"
                            />
                        </fieldset>
                    )}

                    {stepIndex === 1 && (
                        <fieldset className="apply-group" aria-label="Community">
                            <label>Active On *</label>
                            <div className="apply-community-choices">
                                <label className={`apply-choice ${formData.activeCommunity === "discord" ? "active" : ""}`}>
                                    <input
                                        type="radio"
                                        name="activeCommunity"
                                        value="discord"
                                        checked={formData.activeCommunity === "discord"}
                                        onChange={updateField}
                                    />
                                    Discord
                                </label>
                                <label className={`apply-choice ${formData.activeCommunity === "reddit" ? "active" : ""}`}>
                                    <input
                                        type="radio"
                                        name="activeCommunity"
                                        value="reddit"
                                        checked={formData.activeCommunity === "reddit"}
                                        onChange={updateField}
                                    />
                                    Reddit
                                </label>
                                <label className={`apply-choice ${formData.activeCommunity === "both" ? "active" : ""}`}>
                                    <input
                                        type="radio"
                                        name="activeCommunity"
                                        value="both"
                                        checked={formData.activeCommunity === "both"}
                                        onChange={updateField}
                                    />
                                    Both
                                </label>
                            </div>

                            {(formData.activeCommunity === "discord" || formData.activeCommunity === "both") && (
                                <>
                                    <label htmlFor="discordUsername">Discord Username *</label>
                                    <input
                                        id="discordUsername"
                                        name="discordUsername"
                                        type="text"
                                        value={formData.discordUsername}
                                        onChange={updateField}
                                        placeholder="example_user"
                                    />

                                    <label htmlFor="discordOldUsernames">Old Discord Usernames</label>
                                    <input
                                        id="discordOldUsernames"
                                        name="discordOldUsernames"
                                        type="text"
                                        value={formData.discordOldUsernames}
                                        onChange={updateField}
                                        placeholder="old_name_1, old_name_2"
                                    />
                                </>
                            )}

                            {(formData.activeCommunity === "reddit" || formData.activeCommunity === "both") && (
                                <>
                                    <label htmlFor="redditUsername">Reddit Username *</label>
                                    <input
                                        id="redditUsername"
                                        name="redditUsername"
                                        type="text"
                                        value={formData.redditUsername}
                                        onChange={updateField}
                                        placeholder="u/example_user"
                                    />

                                    <label htmlFor="redditOldUsernames">Old Reddit Usernames</label>
                                    <input
                                        id="redditOldUsernames"
                                        name="redditOldUsernames"
                                        type="text"
                                        value={formData.redditOldUsernames}
                                        onChange={updateField}
                                        placeholder="u/old_name_1, u/old_name_2"
                                    />
                                </>
                            )}
                        </fieldset>
                    )}

                    {stepIndex === 2 && (
                        <fieldset className="apply-group" aria-label="Writeup">
                            <label htmlFor="description">Short Description *</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={updateField}
                                rows={6}
                                placeholder="Write about the user in third person if possible."
                            />

                            <label htmlFor="extraDetails">Extra Notes</label>
                            <textarea
                                id="extraDetails"
                                name="extraDetails"
                                value={formData.extraDetails}
                                onChange={updateField}
                                rows={4}
                                placeholder="Anything else you want shown."
                            />
                        </fieldset>
                    )}

                    {stepIndex === 3 && (
                        <fieldset className="apply-group" aria-label="Optional Details">
                            <label htmlFor="pronouns">Pronouns</label>
                            <input
                                id="pronouns"
                                name="pronouns"
                                type="text"
                                value={formData.pronouns}
                                onChange={updateField}
                                placeholder="he/him, she/her, they/them..."
                            />

                            <label htmlFor="gender">Gender</label>
                            <input
                                id="gender"
                                name="gender"
                                type="text"
                                value={formData.gender}
                                onChange={updateField}
                                placeholder="Optional"
                            />

                            <label htmlFor="sexuality">Sexuality</label>
                            <input
                                id="sexuality"
                                name="sexuality"
                                type="text"
                                value={formData.sexuality}
                                onChange={updateField}
                                placeholder="Optional"
                            />

                            <label htmlFor="age">Age</label>
                            <input
                                id="age"
                                name="age"
                                type="number"
                                value={formData.age}
                                onChange={updateField}
                                min={0}
                                max={120}
                                placeholder="Optional"
                            />

                            <label htmlFor="birthday">Birthday</label>
                            <input
                                id="birthday"
                                name="birthday"
                                type="text"
                                value={formData.birthday}
                                onChange={updateField}
                                placeholder="July 30 2008"
                            />
                        </fieldset>
                    )}

                    {stepIndex === 4 && (
                        <fieldset className="apply-group" aria-label="Final Check">
                            <label>Is middy the goat? *</label>
                            <label className="apply-radio">
                                <input
                                    type="radio"
                                    name="middyGoat"
                                    value="yes"
                                    checked={formData.middyGoat === "yes"}
                                    onChange={updateField}
                                />
                                <span>Yes</span>
                            </label>
                            <label className="apply-radio">
                                <input
                                    type="radio"
                                    name="middyGoat"
                                    value="no"
                                    checked={formData.middyGoat === "no"}
                                    onChange={updateField}
                                />
                                <span>No 😠😠😠</span>
                            </label>

                            {TURNSTILE_SITE_KEY && (
                                <div className="apply-turnstile">
                                    <label>Spam Check *</label>
                                    <div ref={turnstileContainerRef} className="apply-turnstile-widget" />
                                </div>
                            )}
                        </fieldset>
                    )}

                    {error && <p className="apply-message apply-error">{error}</p>}
                    {submitted && (
                        <p className="apply-message apply-success">
                            {`Submitted successfully${submissionId ? ` (ID: ${submissionId})` : ""}.`}
                        </p>
                    )}

                    <div className="apply-actions">
                        {stepIndex > 0 && (
                            <button type="button" className="apply-secondary-button" onClick={goBack} disabled={isSubmitting}>
                                Back
                            </button>
                        )}
                        {!isFinalStep && (
                            <button type="button" onClick={goNext} disabled={isSubmitting}>
                                Continue
                            </button>
                        )}
                        {isFinalStep && <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit"}</button>}
                    </div>
                </form>
            </section>
        </div>
    )
}

export default Apply
