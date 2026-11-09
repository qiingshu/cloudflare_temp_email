import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { build } from 'esbuild';

// Bundle the actual helpers. Stub only unrelated address creation/configuration
// boundaries; JWT verification and D1 identity checks are real implementation.
const bundle = await build({
  stdin: { contents: `export * from './src/telegram_api/common.ts'; export { Jwt } from 'hono/utils/jwt'; export {sendMailToTelegram} from './src/telegram_api/telegram.ts'; export {CONSTANTS} from './src/constants.ts'; export {default as miniapp} from './src/telegram_api/miniapp.ts';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'unrelated-boundaries', setup(b) {
    b.onResolve({ filter: /^\.\.\/(utils|common)$/ }, args =>
      args.importer.includes('/telegram_api/') ? { path: args.path, namespace: 'stub' } : null);
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `export const getIntValue=(v,d)=>Number(v)||d; export const getJsonSetting=async()=>[]; export const getDomains=()=>[]; export const getJsonObjectValue=()=>null; export const getStringValue=v=>v; export const checkCfTurnstile=async()=>{}; export const commonParseMail=async()=>({subject:'test',text:'body'}); export const deleteAddressWithData=()=>{throw Error('not exercised')}; export const newAddress=()=>{throw Error('not exercised')};` }));
    b.onResolve({filter:/^telegraf(?:\/filters)?$/},args=>({path:args.path,namespace:'telegram-mock'}));
    b.onLoad({filter:/.*/,namespace:'telegram-mock'},()=>({contents:`export const callbackQuery=()=>{}; export const Markup={inlineKeyboard:()=>({}),button:{webApp:()=>({})}}; export class Telegraf {constructor(){this.telegram={sendMessage:async(id,text)=>globalThis.__sent.push({id,text})};} use(){} command(){} on(){}}` }));
  }}],
});
const { Jwt, bindTelegramAddress, unbindTelegramAddress, telegramOwnsCurrentAddress, pruneDeletedTelegramCredential,sendMailToTelegram,CONSTANTS,miniapp } =
  await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const prefix = 'temp-mail-telegram:';
function fixture() {
  const data = new Map();
  const env = { JWT_SECRET: 'local-test-only-secret', KV: {
    async get(k, mode) { const v=data.get(k); return mode==='json' && v ? JSON.parse(v) : v ?? null; },
    async put(k,v) { data.set(k,v); }, async delete() { throw Error('must not delete routing hints'); },
  }, DB: { withSession(mode) { assert.equal(mode,'first-primary'); return this; },
    prepare() { return { bind(id,name) { return { async first() { return String(id)==='8' && name==='a@test.invalid' ? 8 : null; } }; } }; },
  }};
  return { c:{ env }, data };
}
const token = id => Jwt.sign({address:'a@test.invalid',address_id:id},'local-test-only-secret','HS256');
test('old identity cannot bind or overwrite, current credential authorizes delivery', async()=>{
  const {c,data}=fixture(); const old=await token(7), current=await token(8);
  await bindTelegramAddress(c,'222',current);
  const before=[...data];
  await assert.rejects(bindTelegramAddress(c,'111',old), /无效凭证/);
  assert.deepEqual([...data],before);
  data.set(prefix+'111',JSON.stringify([old]));
  assert.equal(await telegramOwnsCurrentAddress(c,'111','a@test.invalid'),false);
  assert.equal(await telegramOwnsCurrentAddress(c,'222','a@test.invalid'),true);
});
test('stranger unbind does not remove another user routing or authorization',async()=>{
  const {c,data}=fixture(); await bindTelegramAddress(c,'222',await token(8));
  await unbindTelegramAddress(c,'111','a@test.invalid');
  assert.equal(data.get(prefix+'a@test.invalid'),'222');
  assert.equal(await telegramOwnsCurrentAddress(c,'222','a@test.invalid'),true);
  await unbindTelegramAddress(c,'222','a@test.invalid');
  assert.equal(await telegramOwnsCurrentAddress(c,'222','a@test.invalid'),false);
});
test('deleted-id cleanup preserves a newly created same-name credential',async()=>{
  const {c,data}=fixture(); const current=await token(8);
  data.set(prefix+'a@test.invalid','222'); data.set(prefix+'222',JSON.stringify([await token(7),current]));
  await pruneDeletedTelegramCredential(c,'a@test.invalid','7');
  assert.deepEqual(JSON.parse(data.get(prefix+'222')),[current]);
  assert.equal(await telegramOwnsCurrentAddress(c,'222','a@test.invalid'),true);
});
test('unavailable D1 never authorizes personal delivery',async()=>{
  const {c,data}=fixture(); data.set(prefix+'222',JSON.stringify([await token(8)]));
  c.env.DB.withSession=()=>{throw Error('D1 unavailable')};
  assert.equal(await telegramOwnsCurrentAddress(c,'222','a@test.invalid'),false);
});
test('actual delivery skips stale owner, preserves global delivery, sends current owner once',async()=>{
  const {c,data}=fixture(); c.env.TELEGRAM_BOT_TOKEN='local-only'; globalThis.__sent=[];
  data.set(prefix+'a@test.invalid','111'); data.set(prefix+'111',JSON.stringify([await token(7)]));
  data.set(CONSTANTS.TG_KV_SETTINGS_KEY,JSON.stringify({enableGlobalMailPush:true,globalMailPushList:['999']}));
  await sendMailToTelegram(c,'a@test.invalid',{rawEmail:'fixture'},'msg');
  assert.deepEqual(globalThis.__sent.map(m=>m.id),['999']);
  globalThis.__sent=[]; data.delete(CONSTANTS.TG_KV_SETTINGS_KEY);
  await bindTelegramAddress(c,'222',await token(8));
  await sendMailToTelegram(c,'a@test.invalid',{rawEmail:'fixture'},'msg');
  assert.deepEqual(globalThis.__sent.map(m=>m.id),['222']);
  assert.match(globalThis.__sent[0].text,/Subject: test/);
});
test('authenticated Mini App rejects old bind and filters old credentials from its list',async()=>{
  const {c,data}=fixture(); c.env.TELEGRAM_BOT_TOKEN='local-only';
  const init=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:111})}); init.sort();
  const secret=createHmac('sha256','WebAppData').update(c.env.TELEGRAM_BOT_TOKEN).digest();
  init.set('hash',createHmac('sha256',secret).update([...init].map(([k,v])=>k+'='+v).join('\n')).digest('hex'));
  c.req={json:async()=>({initData:init.toString(),jwt:await token(7)})};
  c.json=(body)=>Response.json(body); c.text=(body,status)=>new Response(body,{status});
  const before=[...data]; const rejected=await miniapp.bindAddress(c);
  assert.equal(rejected.status,400); assert.deepEqual([...data],before);
  const valid=await token(8);data.set(prefix+'111',JSON.stringify([await token(7),valid]));
  const response=await miniapp.getTelegramBindAddress(c);
  assert.deepEqual(await response.json(),[{address:'a@test.invalid',jwt:valid}]);
});
