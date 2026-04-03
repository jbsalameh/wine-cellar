import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-3.1-flash-lite";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured on server." });
  }

  const { type, system, prompt, base64, mediaType, maxOutputTokens = 1000 } = req.body;

  try {
    const genAI = new GoogleGenerativeAI(key);

    if (type === "vision") {
      const model = genAI.getGenerativeModel({ model: MODEL });
      const result = await model.generateContent([
        { inlineData: { data: base64, mimeType: mediaType } },
        prompt,
      ]);
      return res.json({ text: result.response.text() });
    }

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: system,
    });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens },
    });
    return res.json({ text: result.response.text() });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Gemini API error" });
  }
}
