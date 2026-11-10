import {test} from 'node:test';import {DatabaseSync} from 'node:sqlite';import assert from 'node:assert/strict';import {AsyncLocalStorage} from 'node:async_hooks';
globalThis.self=globalThis;
const transport=new AsyncLocalStorage();
const originalError=console.error;console.error=(...args)=>{const f=transport.getStore();if(f)f.errors.push(args);else originalError(...args);};
globalThis.fetch=async(url,init)=>{const f=transport.getStore();assert(f,'network outside fixture');f.webhooks.push(JSON.parse(init.body));return new Response('{}');};
const {email,TelegramModule,Jwt,CONSTANTS}=await import('./runtime/candidate-test.mjs');
TelegramModule.Telegram.prototype.callApi=async function(method,payload){const f=transport.getStore();assert(f,'Telegram outside fixture');assert.equal(method,'sendMessage');f.telegram.push(payload);return {message_id:1};};
async function fixture({fail=false,stale=false,webhook=true}={}){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE raw_mails(id INTEGER PRIMARY KEY,source TEXT,address TEXT,raw TEXT,message_id TEXT)');
 const kv=new Map(),ids=new Map([['a@test.invalid',8],['b@test.invalid',9]]);let nextId=100;
 const env={JWT_SECRET:'fixture-only',TELEGRAM_BOT_TOKEN:'fixture-only',FRONTEND_URL:'https://fixture.invalid',ENABLE_WEBHOOK:webhook?'true':'false',KV:{async get(k,type){const v=kv.get(k);return type==='json'&&v?JSON.parse(v):v??null;}},DB:{withSession(mode){assert.equal(mode,'first-primary');return this;},prepare(sql){return {bind(...args){return {async run(){assert(sql.startsWith('INSERT INTO raw_mails'));if(fail==='throw')throw Error('fixture INSERT failed');if(fail===true)return {success:false,meta:{last_row_id:999}};const inserted=sqlite.prepare(sql).run(...args);const id=Number(inserted.lastInsertRowid);await new Promise(r=>setTimeout(r,id%2?15:0));return {success:true,meta:{last_row_id:fail==='missing'?undefined:fail==='zero'?0:fail==='fraction'?1.5:fail==='string'?String(id):id}};},async first(column){assert(!sql.includes('raw_mails'),'ambiguous mail-row SELECT forbidden');assert(sql.includes('FROM address WHERE id = ? AND name = ?'));assert.equal(column,'id');return ids.get(args[1])===Number(args[0])?Number(args[0]):null;}};}};}}};
 for(const [address,id]of ids){const user=address.startsWith('a')?'111':'222';kv.set(`${CONSTANTS.TG_KV_PREFIX}:${address}`,user);kv.set(`${CONSTANTS.TG_KV_PREFIX}:${user}`,JSON.stringify([await Jwt.sign({address,address_id:stale?7:id},env.JWT_SECRET,'HS256')]));}
 kv.set(CONSTANTS.TG_KV_SETTINGS_KEY,JSON.stringify({miniAppUrl:'https://fixture.invalid'}));kv.set(CONSTANTS.WEBHOOK_KV_ADMIN_MAIL_SETTINGS_KEY,JSON.stringify({enabled:true,url:'https://webhook.invalid',method:'POST',headers:'{}',body:'{"id":"${id}","to":"${to}","subject":"${subject}","url":"${url}"}'}));
 async function receive(address,messageId,subject){const f={telegram:[],webhooks:[],rejected:[],forwarded:[],errors:[]};const raw=`From: Sender <sender@outside.invalid>\r\nTo: ${address}\r\nSubject: ${subject}\r\n${messageId?`Message-ID: ${messageId}\r\n`:''}Content-Type: text/plain\r\n\r\nbody ${subject}`;
 const msg={from:'sender@outside.invalid',to:address,headers:new Headers(messageId?{'Message-ID':messageId}:{}),raw,rawSize:raw.length,setReject:x=>f.rejected.push(x),forward:async x=>f.forwarded.push(x),reply:async()=>{throw Error('real reply forbidden');}};await transport.run(f,()=>email(msg,env,{}));return f;}
 return {get rows(){return sqlite.prepare("SELECT * FROM raw_mails ORDER BY id").all();},env,receive};
}
for(const messageId of ['<duplicate@fixture>',null])test(`repeated/missing Message-ID=${messageId} links each new row`,async()=>{
 const f=await fixture();await f.receive('a@test.invalid',messageId,'old');const r=await f.receive('a@test.invalid',messageId,'new');assert.equal(r.telegram.length,1);assert.equal(r.webhooks.length,1);const row=f.rows.find(x=>x.raw.includes('Subject: new'));
 const link=r.telegram[0].reply_markup.inline_keyboard[0][0].web_app.url;assert.equal(new URL(link).searchParams.get('mail_id'),String(row.id));assert.equal(r.webhooks[0].id,String(row.id));assert.equal(r.telegram[0].chat_id,'111');assert.equal(f.rows[0].message_id,messageId);
});
test('same-address concurrent receives retain per-request INSERT identity',async()=>{
 const f=await fixture();const all=await Promise.all(Array.from({length:16},(_,i)=>f.receive('a@test.invalid','<same>',`concurrent-${i}`)));
 for(let i=0;i<all.length;i++){const row=f.rows.find(x=>x.raw.includes(`Subject: concurrent-${i}\n`) || x.raw.includes(`Subject: concurrent-${i}\r\n`));const r=all[i];assert.equal(r.telegram.length,1);assert.equal(new URL(r.telegram[0].reply_markup.inline_keyboard[0][0].web_app.url).searchParams.get('mail_id'),String(row.id));assert.equal(r.webhooks[0].id,String(row.id));}
});
test('different addresses with same Message-ID never cross personal recipients or links',async()=>{
 const f=await fixture();const results=await Promise.all(['a','b'].map(x=>f.receive(`${x}@test.invalid`,'<same>',x)));
 for(let i=0;i<2;i++){const address=['a','b'][i]+'@test.invalid',r=results[i];assert.equal(r.telegram[0].chat_id,['111','222'][i]);assert.equal(r.webhooks[0].to,address);assert.equal(f.rows.find(x=>String(x.id)===r.webhooks[0].id).address,address);}
});
for(const fail of [true,'throw'])test(`actual INSERT failure=${fail} rejects once without pushes`,async()=>{const f=await fixture({fail});const r=await f.receive('a@test.invalid','<same>','failed');assert.equal(r.rejected.length,1);assert.equal(f.rows.length,0);assert.equal(r.telegram.length,0);assert.equal(r.webhooks.length,0);});
for(const fail of ['zero','fraction','string','missing'])test(`successful INSERT with invalid ID=${fail} retains mail, no reject or linked pushes`,async()=>{const f=await fixture({fail});const r=await f.receive('a@test.invalid','<same>','retained');assert.equal(r.rejected.length,0);assert.equal(f.rows.length,1);assert.equal(r.telegram.length,0);assert.equal(r.webhooks.length,0);assert.deepEqual(r.errors,[[JSON.stringify({event:'mail_row_id_unavailable'})]]);});
test('row ID does not authorize stale personal Telegram credentials',async()=>{const f=await fixture({stale:true});const r=await f.receive('a@test.invalid','<same>','stale');assert.equal(f.rows.length,1);assert.equal(r.telegram.length,0);});
