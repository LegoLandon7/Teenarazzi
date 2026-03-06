import { useEffect, useEffectEvent, useRef } from "react"

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

function resetTurnstileWidget(widgetId) {
    if (widgetId === null || widgetId === undefined) return
    if (!window.turnstile || typeof window.turnstile.reset !== "function") return

    try {
        window.turnstile.reset(widgetId)
    } catch {
        // Ignore widget reset errors and keep the form usable.
    }
}

function TurnstileWidget({ className = "", onTokenChange, resetSignal = 0, siteKey = "" }) {
    const containerRef = useRef(null)
    const widgetIdRef = useRef(null)
    const notifyTokenChange = useEffectEvent((token) => {
        if (typeof onTokenChange === "function") {
            onTokenChange(typeof token === "string" ? token : "")
        }
    })

    useEffect(() => {
        if (!siteKey) return undefined

        ensureTurnstileScript()
        let cancelled = false

        const tryRender = () => {
            if (cancelled) return
            if (widgetIdRef.current !== null) return
            if (!containerRef.current) return
            if (!window.turnstile || typeof window.turnstile.render !== "function") return

            try {
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    callback: token => notifyTokenChange(token),
                    "expired-callback": () => notifyTokenChange(""),
                    "error-callback": () => notifyTokenChange("")
                })
                window.clearInterval(intervalId)
            } catch {
                // Ignore render errors while the script is still booting.
            }
        }

        const intervalId = window.setInterval(tryRender, 200)
        tryRender()

        return () => {
            cancelled = true
            window.clearInterval(intervalId)

            const widgetId = widgetIdRef.current
            if (
                widgetId !== null
                && widgetId !== undefined
                && window.turnstile
                && typeof window.turnstile.remove === "function"
            ) {
                try {
                    window.turnstile.remove(widgetId)
                } catch {
                    // Ignore widget removal errors during unmount.
                }
            }

            widgetIdRef.current = null
            notifyTokenChange("")
        }
    }, [siteKey])

    useEffect(() => {
        if (!siteKey) return
        notifyTokenChange("")
        resetTurnstileWidget(widgetIdRef.current)
    }, [siteKey, resetSignal])

    if (!siteKey) return null

    return <div ref={containerRef} className={className} />
}

export default TurnstileWidget
