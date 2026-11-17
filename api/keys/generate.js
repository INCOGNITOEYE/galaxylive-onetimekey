import { randomBytes, randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const APP_ID = 'GALAXY_LIVE_01';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomPart(length) {
  const bytes = randomBytes(length);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}
function makeKey() {
  const number = String(randomInt(0, 1000000)).padStart(6, '0');
  return `GALAXYLIVE-${number}-${randomPart(5)}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ ok: false, error: 'Server database configuration is missing' });
  try {
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: app, error: appError } = await db.from('apps').select('app_id,is_active').eq('app_id', APP_ID).maybeSingle();
    if (appError) throw appError;
    if (!app || !app.is_active) return res.status(403).json({ ok: false, error: 'This app is not active' });
    let keyValue, inserted, insertError;
    for (let i = 0; i < 4; i++) {
      keyValue = makeKey();
      const result = await db.from('license_keys').insert({ app_id: APP_ID, key_value: keyValue, status: 'generated', generated_at: new Date().toISOString(), expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() }).select('key_value,generated_at,expires_at').single();
      inserted = result.data; insertError = result.error;
      if (!insertError) break;
      if (insertError.code !== '23505') throw insertError;
    }
    if (insertError || !inserted) throw insertError || new Error('Could not create a unique key');
    return res.status(201).json({ ok: true, key: inserted.key_value, generatedAt: inserted.generated_at, expiresAt: inserted.expires_at, validitySeconds: 21600, appId: APP_ID });
  } catch (error) {
    console.error('key generation failed:', error.message);
    return res.status(500).json({ ok: false, error: 'Key generation failed. Check server logs.' });
  }
}
