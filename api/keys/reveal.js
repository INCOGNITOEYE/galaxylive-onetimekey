import { createClient } from '@supabase/supabase-js';

const APP_ID = 'GALAXY_LIVE_01';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'GET only' });
  }

  const sessionId = String(req.query.session || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
    return res.status(400).json({ ok: false, error: 'Invalid key session' });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return res.status(500).json({ ok: false, error: 'Server configuration is missing' });
  }

  try {
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: session, error: sessionError } = await db
      .from('link_sessions')
      .select('id,app_id,license_id,revealed_at')
      .eq('id', sessionId)
      .eq('app_id', APP_ID)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session || session.revealed_at) {
      return res.status(410).json({ ok: false, error: 'This key link has already been used or is invalid.' });
    }

    const { data: license, error: licenseError } = await db
      .from('license_keys')
      .select('key_value,generated_at,expires_at,status')
      .eq('id', session.license_id)
      .eq('app_id', APP_ID)
      .maybeSingle();

    if (licenseError) throw licenseError;
    if (!license || license.status !== 'generated' || new Date(license.expires_at).getTime() <= Date.now()) {
      return res.status(410).json({ ok: false, error: 'This access key has expired or is no longer available.' });
    }

    const { data: claimed, error: claimError } = await db
      .from('link_sessions')
      .update({ revealed_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('app_id', APP_ID)
      .is('revealed_at', null)
      .select('id')
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimed) {
      return res.status(410).json({ ok: false, error: 'This key link has already been used.' });
    }

    return res.status(200).json({
      ok: true,
      key: license.key_value,
      generatedAt: license.generated_at,
      expiresAt: license.expires_at
    });
  } catch (error) {
    console.error('Key reveal failed:', error.message);
    return res.status(500).json({ ok: false, error: 'Could not reveal this access key.' });
  }
}
