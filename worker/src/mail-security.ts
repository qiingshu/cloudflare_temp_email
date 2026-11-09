export async function mailSecurityWebhookSecret(env: Bindings) {
  if (!env.JWT_SECRET || !env.TELEGRAM_BOT_TOKEN) throw new Error('Webhook configuration unavailable');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.JWT_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('email.telegram.webhook.v1:'+env.TELEGRAM_BOT_TOKEN));
  return Array.from(new Uint8Array(signed), b=>b.toString(16).padStart(2,'0')).join('');
}
export async function mailSecurityVerifyWebhook(provided: string | null, env: Bindings) {
  if (typeof provided !== 'string' || !/^[a-f0-9]{64}$/.test(provided)) return false;
  if (!env.JWT_SECRET || !env.TELEGRAM_BOT_TOKEN) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.JWT_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, Uint8Array.from(provided.match(/../g)!,  x=>parseInt(x,16)), new TextEncoder().encode('email.telegram.webhook.v1:'+env.TELEGRAM_BOT_TOKEN));
}
export async function mailSecurityAddressIdentity(env: Bindings, payload: {address?: unknown; address_id?: unknown} | null | undefined) {
  if (!payload || typeof payload.address !== 'string' || !payload.address || !/^[1-9][0-9]*$/.test(String(payload.address_id ?? ''))) return false;
  const db = env.DB.withSession('first-primary');
  return !!await db.prepare('SELECT id FROM address WHERE id = ? AND name = ?').bind(String(payload.address_id), payload.address).first('id');
}
export async function mailSecurityDeleteAddress(env: Bindings, id: string) {
  const db = env.DB.withSession('first-primary');
  const statements = ['raw_mails','address_sender','sendbox','auto_reply_mails'].map(table => db.prepare(`DELETE FROM ${table} WHERE address IN (SELECT name FROM address WHERE id = ?)`).bind(id));
  statements.push(db.prepare('DELETE FROM users_address WHERE address_id = ?').bind(id));
  statements.push(db.prepare('DELETE FROM address WHERE id = ?').bind(id));
  const results = await db.batch(statements);
  return results.every(result=>result.success);
}
