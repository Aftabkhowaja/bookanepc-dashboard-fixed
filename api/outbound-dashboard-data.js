/* Proxy to PythonAnywhere outbound-dashboard-data endpoint. */
export default async function handler(req, res) {
  try {
    const range = encodeURIComponent(req.query?.range || "7d");
    const upstream = `https://aftabkhowaja.pythonanywhere.com/outbound-dashboard-data?range=${range}`;
    const response = await fetch(upstream, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return res.status(response.status).json({ status: "error", message: `Upstream HTTP ${response.status}` });
    }
    const payload = await response.json();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ status: "ok", ...payload });
  } catch (error) {
    return res.status(502).json({ status: "error", message: error.message || "Could not reach outbound endpoint." });
  }
}
