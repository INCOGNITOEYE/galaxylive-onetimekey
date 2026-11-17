export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  return res.status(200).json({
    ok: true,
    service: 'GALAXY CENTRAL KEY SYSTEM',
    version: '1.1.0',
    databaseConfigurationPresent: configured,
    endpoints: { generateKey: 'POST /api/keys/generate', redeemKey: 'POST /api/keys/redeem' },
    note: 'VPLink completion verification is not connected.'
  });
}
