const MODEL = "gpt-4o-mini";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Send a POST request to /api/chat." });
  }

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(503).json({
      error: "OPENAI_API_KEY is not set. Add OPENAI_API_KEY to the server environment (Vercel project settings) and redeploy.",
    });
  }

  let body;
  try {
    body = readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  const messages = sanitiseMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 600,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `OpenAI request failed (${response.status}).`;
      return res.status(response.status).json({ error: message });
    }

    const reply = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!reply) return res.status(502).json({ error: "OpenAI returned an empty reply." });
    return res.status(200).json({ reply, model: MODEL });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Could not reach OpenAI." });
  }
}
