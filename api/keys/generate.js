
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

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vplinkToken = process.env.VPLINK_API_TOKEN;
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://galaxylive-onetimekey.vercel.app';

  if (!url || !serviceKey || !vplinkToken) {
    return res.status(500).json({
      ok: false,
      error: 'Server configuration is missing'
    });
  }

  let db;
  let licenseId;

  try {
    db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: app, error: appError } = await db
      .from('apps')
      .select('app_id,is_active')
      .eq('app_id', APP_ID)
      .maybeSingle();

    if (appError) throw appError;
    if (!app || !app.is_active) {
      return res.status(403).json({
        ok: false,
        error: 'This app is not active'
      });
    }

    const now = new Date();
    const expires = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    let inserted;
    let insertError;

    for (let i = 0; i < 4; i++) {
      const result = await db
        .from('license_keys')
        .insert({
          app_id: APP_ID,
          key_value: makeKey(),
          status: 'generated',
          generated_at: now.toISOString(),
          expires_at: expires.toISOString()
        })
        .select('id,key_value,generated_at,expires_at')
        .single();

      inserted = result.data;
      insertError = result.error;

      if (!insertError) break;
      if (insertError.code !== '23505') throw insertError;
    }

    if (insertError || !inserted) {
      throw insertError || new Error('Could not create key');
    }

    licenseId = inserted.id;

    const { data: session, error: sessionError } = await db
      .from('link_sessions')
      .insert({
        app_id: APP_ID,
        license_id: licenseId,
        provider: 'vplink.in',
        status: 'pending'
      })
      .select('id')
      .single();

    if (sessionError) throw sessionError;

    const destination = `${baseUrl}/?session=${encodeURIComponent(session.id)}`;

    const shortenerUrl = new URL('https://vplink.in/api/');
    shortenerUrl.searchParams.set('api', vplinkToken);
    shortenerUrl.searchParams.set('url', destination);

    const response = await fetch(shortenerUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(15000)
    });

    const responseText = await response.text();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error('VPLink returned an invalid response');
    }

    if (!response.ok || result.status !== 'success' || !result.shortenedUrl) {
      throw new Error(result.message || 'VPLink short link creation failed');
    }

    const { error: updateError } = await db
      .from('link_sessions')
      .update({ short_url: result.shortenedUrl })
      .eq('id', session.id);

    if (updateError) throw updateError;

    return res.status(201).json({
      ok: true,
      shortUrl: result.shortenedUrl,
      expiresAt: inserted.expires_at,
      validitySeconds: 21600
    });

  } catch (error) {
    console.error('VPLink key generation failed:', error.message);

    if (db && licenseId) {
      await db
        .from('license_keys')
        .update({ status: 'expired' })
        .eq('id', licenseId);
    }

    return res.status(500).json({
      ok: false,
      error: 'Could not create the VPLink key session'
    });
  }
}
