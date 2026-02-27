export default {
  async fetch(req, env) {
    const url = new URL(req.url)

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    }

    if (url.pathname === "/stats") {
      // Try to get cached stats
      const cached = await env.STATS?.get?.("stats")
      if (cached) return new Response(cached, { headers: corsHeaders })

      const stats = await fetchStats(env)

      // Cache if KV available
      if (env.STATS?.put) {
        await env.STATS.put("stats", JSON.stringify(stats), { expirationTtl: 300 })
      }

      return new Response(JSON.stringify(stats), { headers: corsHeaders })
    }

    return new Response("Not found", { status: 404 })
  }
}

// Helper to fetch Discord stats using bot token
async function fetchDiscordStats(botToken, guildId) {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
      headers: {
        "Authorization": `Bot ${botToken}`
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
  const botToken = env.DISCORD_BOT_TOKEN
  const guildId = "1395741172256739348" // Replace with your server's ID
  const subreddit = "teenarazzi" // Replace with your subreddit

  const [discord, reddit] = await Promise.all([
    fetchDiscordStats(botToken, guildId),
    fetch(`https://www.reddit.com/r/${subreddit}/about.json`, {
      headers: { "User-Agent": "teenarazzi/1.0" }
    })
      .then(r => r.json())
      .then(data => ({
        members: data?.data?.subscribers ?? null,
        online: data?.data?.accounts_active ?? null
      }))
      .catch(() => ({ members: null, online: null }))
  ])

  return {
    discord,
    reddit,
    timestamp: Math.floor(Date.now() / 1000) // Unix timestamp in seconds
  }
}