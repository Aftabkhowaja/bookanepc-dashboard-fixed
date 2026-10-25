export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ connected: false, error: "Method not allowed." });
  }

  try {
    const response = await fetch("https://aftabkhowaja.pythonanywhere.com/health", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const connected = response.ok && String(data.status || "").toLowerCase() === "ok";
    return res.status(200).json({ connected, status: data.status || "" });
  } catch (error) {
    return res.status(200).json({ connected: false, error: error.message || "Health check failed." });
  }
}
