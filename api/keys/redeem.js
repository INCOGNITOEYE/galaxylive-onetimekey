import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const { key, deviceId } = req.body || {};
  if (typeof key !== 'string' || typeof deviceId !== 'string' || key.length > 80 || deviceId.length < 16 || deviceId.length > 200) {
    return res.status(400).json({ ok: false, error: 'A valid key and deviceId are required' });
  }
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ ok: false, error: 'Server database configuration is missing' });
  try {
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.rpc('redeem_galaxy_key', { p_key: key.trim(), p_device_hash: deviceId, p_app_id: 'GALAXY_LIVE_01' });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) return res.status(403).json({ ok: false, error: result?.message || 'Key is invalid, expired, or already used on another device' });
    return res.status(200).json({ ok: true, message: 'Key activated', expiresAt: result.expires_at, appId: 'GALAXY_LIVE_01' });
  } catch (error) {
    console.error('key redemption failed:', error.message);
    return res.status(500).json({ ok: false, error: 'Key verification failed. Check server logs.' });
  }
}
