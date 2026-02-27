export default {
  async fetch(req, env) {
    const url = new URL(req.url)

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    }

    if (url.pathname === "/api/stats") {
      const cached = await env.STATS.get("stats")
      if (cached) return new Response(cached, { headers: corsHeaders })

      const stats = await fetchStats(env)
      await env.STATS.put("stats", JSON.stringify(stats), { expirationTtl: 300 })
      return new Response(JSON.stringify(stats), { headers: corsHeaders })
    }

    return new Response("Not found", { status: 404 })
  }
}

async function fetchStats(env) {
  const [discord, reddit] = await Promise.all([
    fetch("https://discord.com/api/v10/invites/razzi?with_counts=true", {
      headers: { Authorization: `Bot ${env.BOT_TOKEN}` }
    }).then(r => r.json()),

    fetch("https://www.reddit.com/r/teenarazzi/about.json", {
      headers: { "User-Agent": "teenarazzi/1.0" }
    }).then(r => r.json())
  ])

  return {
    discord: {
      members: discord.approximate_member_count,
      online: discord.approximate_presence_count
    },
    reddit: {
      members: reddit.data.subscribers,
      online: reddit.data.accounts_active
    },
    timestamp: new Date().toISOString()
  }
}