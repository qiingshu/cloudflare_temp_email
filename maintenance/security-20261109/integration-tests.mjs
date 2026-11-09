import assert from 'node:assert/strict';
import {writeFileSync,writeSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
globalThis.self=globalThis;
let upstreamCalls=0;
globalThis.fetch=async request=>{
 upstreamCalls++;
 const url=String(request);
 if(url.includes('/getMe')) return Response.json({ok:true,result:{id:100,is_bot:true,first_name:'Isolated',username:'isolated_bot'}});
 throw new Error('Unexpected network access in isolated test');
};
const {default:worker}=await import(process.env.MAIL_WORKER_TEST_COPY);
const statements=[];
const db={prepare(sql){return {bind(...args){return {async first(){statements.push({sql,args}); if(sql.includes('SELECT id FROM address WHERE id = ? AND name = ?'))return String(args[0])==='7'&&args[1]==='test@example.invalid'?7:null;return null;},async all(){statements.push({sql,args});return {results:[],success:true};},async run(){statements.push({sql,args});return {success:true,meta:{changes:1}}}}}}},async batch(){throw new Error('Unexpected write')}};
const env={ADMIN_AUTH_LIMITER:{async limit(){return {success:true}}},DB:{...db,withSession(){return db}},JWT_SECRET:'isolated-test-key',TELEGRAM_BOT_TOKEN:'isolated-bot-token',KV:{async get(){return null}},DOMAINS:['example.invalid'],DEFAULT_DOMAINS:['example.invalid'],DEFAULT_LANG:'en',RATE_LIMITER:{async limit(){return {success:true}}}};
function b64(s){return Buffer.from(s).toString('base64url')}
async function token(payload){const value=b64(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+b64(JSON.stringify(payload));const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(env.JWT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return value+'.'+Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))).toString('base64url')}
async function request(path,options={}){return worker.fetch(new Request('https://worker-test.invalid'+path,options),env,{waitUntil(){}})}
assert.equal((await request('/health_check')).status,200);
for(const id of [6,7]){
 const credential=await token({address:'test@example.invalid',address_id:id});
 const response=await request('/api/mails?limit=10&offset=0',{headers:{Authorization:'Bearer '+credential}});
 assert.equal(response.status,id===7?200:401);
}
const malformed=await token({address:'test@example.invalid'});
assert.equal((await request('/api/mails',{headers:{Authorization:'Bearer '+malformed}})).status,401);
const invalid=await token({address:'test@example.invalid',address_id:6});
assert.equal((await request('/external/api/send_mail',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:invalid})})).status,401);
for(const header of [null,'0'.repeat(64)]){
 const headers={'content-type':'application/json'};if(header)headers['x-telegram-bot-api-secret-token']=header;
 assert.equal((await request('/telegram/webhook',{method:'POST',headers,body:'{"update_id":1}'})).status,401);
}
assert.equal(upstreamCalls,0);
assert.equal((await request('/admin/mails',{headers:{'cf-connecting-ip':'192.0.2.1'}})).status,401);
writeFileSync(new URL('./integration-results.json',import.meta.url),JSON.stringify({passed:true,runtime:'Node with self shim; cloudflare:sockets replaced with throwing stub only in test copy',checks:['health unchanged','current address credential 200','old address id 401','missing address id 401','external old credential 401','missing or forged Telegram secret 401 before any external call','admin remains protected'],productionWrites:0},null,2)+'\n');
writeSync(1,'PASS integrated candidate fetch: valid/stale/missing address IDs, external send guard, forged webhook rejected without upstream calls, health/admin protection preserved\n');
