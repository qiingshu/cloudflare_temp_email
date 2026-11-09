import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=new URL('.',import.meta.url).pathname.replace(/\/$/,'');
const helper=await readFile(root+'/worker-security-helpers.mjs','utf8');
const context={crypto:webcrypto,TextEncoder,Uint8Array};vm.createContext(context);vm.runInContext(helper,context);
const env={JWT_SECRET:'isolated-test-key',TELEGRAM_BOT_TOKEN:'isolated-bot-token'};
const secret=await context.mailSecurityWebhookSecret(env);
assert.match(secret,/^[a-f0-9]{64}$/);
assert.equal(await context.mailSecurityVerifyWebhook(secret,env),true);
for(const token of [null,'',secret.slice(1),'0'.repeat(64),'A'.repeat(64)]) assert.equal(await context.mailSecurityVerifyWebhook(token,env),false);
assert.equal(await context.mailSecurityVerifyWebhook(secret,{...env,TELEGRAM_BOT_TOKEN:'different'}),false);
const queries=[];
const db={prepare(sql){return {bind(...args){queries.push({sql,args});return {async first(){return args[0]==='7'&&args[1]==='test@example.invalid'?7:null;},sql,args}}}},async batch(statements){return statements.map(()=>({success:true}))}};
env.DB={withSession(mode){assert.equal(mode,'first-primary');return db}};
assert.equal(await context.mailSecurityAddressIdentity(env,{address:'test@example.invalid',address_id:'7'}),true);
for(const payload of [{address:'test@example.invalid',address_id:6},{address:'other@example.invalid',address_id:7},{address:'test@example.invalid'},null]) assert.equal(await context.mailSecurityAddressIdentity(env,payload),false);
assert.equal(await context.mailSecurityDeleteAddress(env,'7'),true);
const deletion=queries.filter(q=>q.sql.startsWith('DELETE'));
assert.equal(deletion.length,6);assert.equal(deletion.at(-1).sql,'DELETE FROM address WHERE id = ?');
await writeFile(root+'/deletion-queries.json',JSON.stringify(deletion));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://mail-test.invalid/',runScripts:'dangerously'});
globalThis.window=dom.window;
const {sanitizeMailHtml,mailTextHtml}=await import(new URL('../../frontend/src/utils/mail-html.mjs',import.meta.url));
globalThis.document=dom.window.document;
const {document,Event}=dom.window;
dom.window.pwned=0;
const control=document.createElement('img');control.setAttribute('onerror','window.pwned=99');control.dispatchEvent(new Event('error'));assert.equal(dom.window.pwned,99);dom.window.pwned=0;
const payloads=[`<img src=x onerror="window.pwned=1">`,`<svg onload="window.pwned=2"></svg>`,`<script>window.pwned=3</script>`,`<a href="javascript:window.pwned=4">x</a>`,`<iframe srcdoc="<script>parent.pwned=5</script>"></iframe>`,`<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=window.pwned=6>">`];
for(const payload of payloads){
 const clean=sanitizeMailHtml(payload);
 for(const shadow of [false,true]){
  const host=document.createElement('div');document.body.append(host);
  const target=shadow?host.attachShadow({mode:'open'}):host;target.innerHTML=clean;
  for(const node of target.querySelectorAll('*')){
   for(const name of node.getAttributeNames())assert.ok(!/^on/i.test(name));
   for(const event of ['error','load','click'])node.dispatchEvent(new Event(event));
  }
 }
 assert.ok(!/<(?:script|iframe|svg|math)\b/i.test(clean));
 assert.ok(!/javascript:/i.test(clean));
}
assert.equal(dom.window.pwned,0);
const good=sanitizeMailHtml('<table><tr><td style="color:red">验证码 123456</td></tr></table><img src="https://example.invalid/image.png"><img src="blob:https://mail-test.invalid/test"><a href="https://example.invalid">原文</a>');
assert.ok(good.includes('<table>'));assert.ok(good.includes('验证码 123456'));assert.ok(good.includes('https://example.invalid/image.png'));assert.ok(good.includes('blob:https://mail-test.invalid/test'));
assert.ok(mailTextHtml('<img src=x onerror="window.pwned=7">').includes('&lt;img'));
const app=await readFile(process.env.MAIL_FRONTEND_CANDIDATE,'utf8');
assert.equal((app.match(/sandbox: "allow-popups allow-popups-to-escape-sandbox"/g)||[]).length,2);
assert.ok(!app.includes('srcdoc: S.value.message'));
assert.ok(!app.includes('innerHTML: e.htmlContent'));
console.log('PASS: webhook auth, address identity, delete ordering, HTML sanitizer adversarial cases with executable negative control, text escaping and formatting preservation');
await writeFile(root+'/test-results.json',JSON.stringify({passed:true,scope:'isolated Node WebCrypto, jsdom and SQLite; no production accounts or mail used',maliciousPayloadCount:6,renderModes:['shadow','fallback'],iframe:'static sandbox check only; real browser test blocked by process socket restriction',webhook:'helper validation only; real Telegram not tested',address:'mock database plus SQLite rollback and recreation tests'},null,2)+'\n');
dom.window.close();
