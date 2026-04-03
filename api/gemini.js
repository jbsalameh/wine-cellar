const MODEL = "gemini-3.1-flash-lite-preview";
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server." });

  const { type, system, prompt, base64, mediaType, maxOutputTokens = 1200, stream = false } = req.body;

  let body;
  if (type === "vision") {
    body = {
      contents: [{ parts: [{ inline_data: { mime_type: mediaType, data: base64 } }, { text: prompt }] }],
    };
  } else {
    body = {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens },
    };
  }

  try {
    if (stream) {
      // Server-sent events streaming
      const upstream = await fetch(`${BASE}:streamGenerateContent?alt=sse&key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        return res.status(upstream.status).json({ error: err?.error?.message || `Gemini error (${upstream.status})` });
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.write("data: [DONE]\n\n"); break; }
        const chunk = decoder.decode(value, { stream: true });
        // Each SSE line from Google: "data: {...json...}"
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const json = JSON.parse(raw);
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
          } catch {}
        }
      }
      res.end();
    } else {
      // Regular JSON response
      const response = await fetch(`${BASE}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || `Gemini error (${response.status})` });
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return res.json({ text });
    }
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}
