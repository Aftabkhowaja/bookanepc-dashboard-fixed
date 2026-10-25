const UPSTREAM = "https://aftabkhowaja.pythonanywhere.com/dashboard-data";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch(UPSTREAM, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: err?.message || "Dashboard data unavailable" });
  }
}
