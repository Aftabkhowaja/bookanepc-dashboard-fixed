const MODEL = "gemini-2.5-flash";

function readJsonBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === "string") return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8"));
  return req.body;
}

function sanitiseMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
    .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 4000) }))
    .filter((message) => message.content)
    .slice(-20);
}

function toGeminiContents(messages) {
  const contents = [];
  for (const message of messages) {
    const role = message.role === "assistant" ? "model" : "user";
    const previous = contents[contents.length - 1];
    if (previous && previous.role === role) {
      previous.parts[0].text += `\n\n${message.content}`;
      continue;
    }
    contents.push({ role, parts: [{ text: message.content }] });
  }
  while (contents.length && contents[0].role === "model") contents.shift();
  return contents;
}

function redact(value, apiKey) {
  const text = String(value || "");
  if (!apiKey) return text;
  return text.split(apiKey).join("[redacted]");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Send a POST request to /api/chat." });
  }

  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(503).json({
      error: "GEMINI_API_KEY is not set. Add GEMINI_API_KEY to the server environment and redeploy.",
    });
  }

  let body;
  try {
    body = readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  const messages = sanitiseMessages(body.messages);
  const contents = toGeminiContents(messages);
  if (!contents.length || contents[contents.length - 1].role !== "user") {
    return res.status(400).json({ error: "Send at least one user message." });
  }

  const context = typeof body.context === "string" ? body.context.trim().slice(0, 4000) : "";
  const system = [
    "You are the BookAnEPC live revenue dashboard assistant.",
    "Help with EPC lead outreach, the email log, the daily send queue, website leads, and replies.",
    "Be concise. Do not invent live counts. If a figure is not in the dashboard snapshot, say you cannot see it.",
    context ? `Current dashboard snapshot: ${context}` : "No live dashboard snapshot was provided.",
  ].join(" ");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = redact(data?.error?.message || `Gemini request failed (${response.status}).`, apiKey);
      return res.status(response.status).json({ error: message });
    }

    const reply = (data?.candidates?.[0]?.content?.parts || [])
      .map((part) => part?.text || "")
      .join("")
      .trim();
    if (!reply) {
      const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || "empty reply";
      return res.status(502).json({ error: `Gemini returned no text (${reason}).` });
    }
    return res.status(200).json({ reply, model: MODEL });
  } catch (error) {
    return res.status(502).json({ error: redact(error.message || "Could not reach Gemini.", apiKey) });
  }
}
