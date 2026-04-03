const MODEL = "gemini-3.1-flash-lite";
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export default async function handler(req, res) {
  // CORS headers so the browser fetch works in all environments
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY is not set on the server." });

  const { type, system, prompt, base64, mediaType, maxOutputTokens = 1000 } = req.body;

  let body;

  if (type === "vision") {
    body = {
      contents: [{
        parts: [
          { inline_data: { mime_type: mediaType, data: base64 } },
          { text: prompt },
        ],
      }],
    };
  } else {
    body = {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens },
    };
  }

  try {
    const response = await fetch(`${BASE_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message || `Gemini error (${response.status})`;
      return res.status(response.status).json({ error: msg });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return res.json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}
