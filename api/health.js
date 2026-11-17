export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ok: true,
    service: "GALAXY CENTRAL KEY SYSTEM",
    version: "1.0.0",
    message: "Backend is reachable. License generation is not enabled yet."
  });
}
