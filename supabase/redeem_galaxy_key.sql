-- Run once in Supabase SQL Editor.
-- Atomically binds a generated key to its first device and prevents reuse.
create or replace function public.redeem_galaxy_key(
  p_key text,
  p_device_hash text,
  p_app_id text
)
returns table(ok boolean, message text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.license_keys%rowtype;
begin
  select * into k
  from public.license_keys
  where key_value = p_key and app_id = p_app_id
  for update;

  if not found then
    return query select false, 'Invalid key or app mismatch', null::timestamptz;
    return;
  end if;

  if k.expires_at <= now() then
    update public.license_keys set status = 'expired' where id = k.id;
    return query select false, 'Key expired', k.expires_at;
    return;
  end if;

  if k.status = 'redeemed' then
    if k.device_hash = p_device_hash then
      return query select true, 'Already activated on this device', k.expires_at;
    else
      return query select false, 'Key already used on another device', k.expires_at;
    end if;
    return;
  end if;

  if k.status <> 'generated' then
    return query select false, 'Key is not available', k.expires_at;
    return;
  end if;

  update public.license_keys
  set status = 'redeemed', device_hash = p_device_hash,
      activated_at = now(), redeemed_at = now()
  where id = k.id;

  return query select true, 'Key activated', k.expires_at;
end;
$$;

revoke all on function public.redeem_galaxy_key(text,text,text) from public;
grant execute on function public.redeem_galaxy_key(text,text,text) to service_role;
