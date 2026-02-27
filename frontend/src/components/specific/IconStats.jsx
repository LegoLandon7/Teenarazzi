import { useState, useEffect } from 'react'

import './IconStats.css'

function IconStats() {
    const [discordTotal, setDiscordTotal] = useState('[ERROR]')
    const [discordActive, setDiscordActive] = useState('[ERROR]')
    const [redditTotal, setRedditTotal] = useState('[ERROR]')
    const [redditActive, setRedditActive] = useState('[ERROR]')
    const [lastUpdated, setLastUpdated] = useState(null)

    const fetchStats = async () => {
        try {
            const res = await fetch('https://api.teenarazzi.com/stats')
            const data = await res.json()

            setDiscordTotal(data.discord.members ?? '[ERROR]')
            setDiscordActive(data.discord.online ?? '[ERROR]')
            setRedditTotal(data.reddit.members ?? '[ERROR]')
            setRedditActive(data.reddit.online ?? '[ERROR]')
            setLastUpdated(data.timestamp ?? null)
        } catch (err) {
            console.error('Failed to fetch stats:', err)
        }
    }

    useEffect(() => {
        fetchStats()
        const interval = setInterval(fetchStats, 30 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const formatTimestamp = (ts) => {
        if (!ts) return ''
        const date = new Date(ts * 1000)
        return date.toLocaleString()
    }

    return (
        <div className="icon-stat-container"> 
            <a className="icon-stat"
                style={{ "--stat-color": "rgba(88, 101, 242, 0.5)" }}
                href="https://discord.gg/razzi" target="_blank" rel="noopener noreferrer"
            ><h1>
                Discord
            </h1><p>
                Total members: <span style={{color: typeof discordTotal === 'number' && !isNaN(discordTotal) ? "green" : "red"}}>{discordTotal}</span> <br />
                Active members: <span style={{color: typeof discordActive === 'number' && !isNaN(discordActive) ? "green" : "red"}}>{discordActive}</span> <br />
            </p><div className="last-updated">{"Last Updated: " + formatTimestamp(lastUpdated)}</div></a>
            <a className="icon-stat"
                style={{ "--stat-color": "rgba(255, 86, 0, 0.5)" }}
                href="https://reddit.com/r/teenarazzi" target="_blank" rel="noopener noreferrer"
            ><h1>
                Reddit
            </h1><p>
                Total members: <span style={{color: typeof redditTotal === 'number' && !isNaN(redditTotal) ? "green" : "red"}}>{redditTotal}</span> <br />
                Active members: <span style={{color: typeof redditActive === 'number' && !isNaN(redditActive) ? "green" : "red"}}>{redditActive}</span> <br />
            </p><div className="last-updated">{"Last Updated: " + formatTimestamp(lastUpdated)}</div></a>
        </div>
    )
}

export default IconStats