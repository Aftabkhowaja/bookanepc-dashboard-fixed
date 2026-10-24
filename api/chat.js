const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT =
  "You are the BookAnEPC live revenue dashboard assistant. Help with EPC outreach, real client sends, the daily queue, website leads, replies, and the next sensible action. Be concise and do not invent send totals.";

function geminiApiKey() {
  if (!Object.prototype.hasOwnProperty.call(process.env, "GEMINI_API_KEY")) return "";
  const key = process.env.GEMINI_API_KEY;
  return typeof key === "string" ? key.trim() : "";
}

function readJson(req) {
  const body = req.body;
  if (body == null) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString("utf8"));
    } catch {
      return {};
    }
  }
  if (typeof body === "object") return body;
  return {};
}

function toContents(messages) {
  const turns = [];
  for (const message of messages) {
    if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
    const text = String(message.content || "").trim();
    if (!text) continue;
    const role = message.role === "assistant" ? "model" : "user";
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n${text}`;
    else turns.push({ role, parts: [{ text: text.slice(0, 8000) }] });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns.slice(-20);
}

function extractReply(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part?.text || "").join("").trim();
}

function publicError(text) {
  return String(text || "Chat request failed").replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = geminiApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
  }

  const body = readJson(req);
  const messages = Array.isArray(body.messages)
    ? body.messages
    : body.message
      ? [{ role: "user", content: body.message }]
      : [];
  const contents = toContents(messages);
  if (!contents.length) {
    return res.status(400).json({ error: "A user message is required" });
  }

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: publicError(data?.error?.message || `Gemini request failed (${response.status})`),
      });
    }

    const reply = extractReply(data);
    if (!reply) return res.status(502).json({ error: "Gemini returned an empty response" });
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(502).json({ error: publicError(err?.message || "Gemini request failed") });
  }
}
