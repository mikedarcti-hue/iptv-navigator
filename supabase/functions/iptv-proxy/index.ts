const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, url, type, server, username, password } = await req.json();

    if (action === "test") {
      // Test connection by fetching HEAD or a small portion
      const testUrl =
        type === "m3u"
          ? url
          : `${server.replace(/\/$/, "")}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(testUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "IPTVClient/1.0" },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `HTTP ${res.status}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For Xtream, verify JSON response has user_info
      if (type === "xtream") {
        const data = await res.json();
        if (!data.user_info) {
          return new Response(
            JSON.stringify({ success: false, error: "Credenciais inválidas" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ success: true, user_info: data.user_info }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fetch_m3u") {
      const fetchUrl = url;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(fetchUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "IPTVClient/1.0" },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `HTTP ${res.status}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const text = await res.text();
      const channels = parseM3U(text);

      return new Response(
        JSON.stringify({ success: true, channels }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "fetch_xtream") {
      const base = server.replace(/\/$/, "");
      const auth = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

      // Fetch categories
      const catRes = await fetch(
        `${base}/player_api.php?${auth}&action=get_live_categories`,
        { headers: { "User-Agent": "IPTVClient/1.0" } }
      );
      const categories = catRes.ok ? await catRes.json() : [];

      // Fetch live streams
      const streamRes = await fetch(
        `${base}/player_api.php?${auth}&action=get_live_streams`,
        { headers: { "User-Agent": "IPTVClient/1.0" } }
      );
      const streams = streamRes.ok ? await streamRes.json() : [];

      // Build category map
      const catMap: Record<string, string> = {};
      if (Array.isArray(categories)) {
        for (const c of categories) {
          catMap[c.category_id] = c.category_name;
        }
      }

      // Map streams to channels
      const channels = Array.isArray(streams)
        ? streams.slice(0, 2000).map((s: any, i: number) => ({
            id: String(s.stream_id || i),
            name: s.name || "Sem nome",
            logo: s.stream_icon || "",
            group: catMap[s.category_id] || "Sem categoria",
            url: `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${s.stream_id}.ts`,
            epgNow: s.epg_channel_id || "",
          }))
        : [];

      return new Response(
        JSON.stringify({ success: true, channels }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação inválida" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (err: any) {
    const msg = err.name === "AbortError" ? "Timeout: servidor não respondeu" : (err.message || "Erro desconhecido");
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function parseM3U(text: string) {
  const lines = text.split("\n").map((l) => l.trim());
  const channels: any[] = [];
  let current: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#EXTINF:")) {
      const nameMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const idMatch = line.match(/tvg-id="([^"]*)"/);

      current = {
        id: idMatch?.[1] || String(channels.length),
        name: nameMatch?.[1]?.trim() || "Sem nome",
        logo: logoMatch?.[1] || "",
        group: groupMatch?.[1] || "Sem categoria",
        url: "",
        epgNow: "",
      };
    } else if (current && line && !line.startsWith("#")) {
      current.url = line;
      channels.push(current);
      current = null;
    }
  }

  return channels.slice(0, 2000);
}
