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
      const testUrl =
        type === "m3u"
          ? url
          : `${server.replace(/\/$/, "")}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(testUrl, {
        method: type === "m3u" ? "HEAD" : "GET",
        signal: controller.signal,
        headers: { "User-Agent": "IPTVClient/1.0" },
      });
      clearTimeout(timeout);

      if (type === "xtream") {
        const data = await res.json();
        if (!data.user_info) {
          return json({ success: false, error: "Credenciais inválidas" });
        }
        return json({ success: true, user_info: data.user_info });
      }

      return json({ success: true });
    }

    if (action === "fetch_m3u") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "IPTVClient/1.0" },
      });
      clearTimeout(timeout);

      if (!res.ok || !res.body) {
        return json({ success: false, error: `HTTP ${res.status}` });
      }

      // Stream-parse M3U to avoid loading entire file into memory
      const channels = await streamParseM3U(res.body, 1500);
      return json({ success: true, channels });
    }

    if (action === "fetch_xtream") {
      const base = server.replace(/\/$/, "");
      const auth = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

      // Fetch categories (small payload)
      const catRes = await fetch(
        `${base}/player_api.php?${auth}&action=get_live_categories`,
        { headers: { "User-Agent": "IPTVClient/1.0" } }
      );
      const categories = catRes.ok ? await catRes.json() : [];

      const catMap: Record<string, string> = {};
      if (Array.isArray(categories)) {
        for (const c of categories) {
          catMap[c.category_id] = c.category_name;
        }
      }

      // Fetch live streams - stream parse to limit memory
      const streamRes = await fetch(
        `${base}/player_api.php?${auth}&action=get_live_streams`,
        { headers: { "User-Agent": "IPTVClient/1.0" } }
      );

      if (!streamRes.ok) {
        return json({ success: false, error: `HTTP ${streamRes.status}` });
      }

      const streams = await streamRes.json();
      const channels = Array.isArray(streams)
        ? streams.slice(0, 1500).map((s: any, i: number) => ({
            id: String(s.stream_id || i),
            name: s.name || "Sem nome",
            logo: s.stream_icon || "",
            group: catMap[s.category_id] || "Sem categoria",
            url: `${base}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${s.stream_id}.ts`,
            epgNow: "",
          }))
        : [];

      return json({ success: true, channels });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (err: any) {
    const msg = err.name === "AbortError"
      ? "Timeout: servidor não respondeu"
      : (err.message || "Erro desconhecido");
    return json({ success: false, error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function streamParseM3U(
  body: ReadableStream<Uint8Array>,
  maxChannels: number
): Promise<any[]> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  const channels: any[] = [];
  let buffer = "";
  let current: any = null;

  while (channels.length < maxChannels) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.substring(0, newlineIdx).trim();
      buffer = buffer.substring(newlineIdx + 1);

      if (line.startsWith("#EXTINF:")) {
        const nameMatch = line.match(/,(.+)$/);
        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        const groupMatch = line.match(/group-title="([^"]*)"/);

        current = {
          id: String(channels.length),
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
        if (channels.length >= maxChannels) break;
      }
    }
  }

  // Cancel remaining stream to free memory
  try { reader.cancel(); } catch {}
  return channels;
}
