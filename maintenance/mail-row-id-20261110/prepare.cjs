const fs=require('node:fs'),crypto=require('node:crypto'),esbuild=require(process.env.ESBUILD_MODULE || '../../worker/node_modules/esbuild');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
let worker=fs.readFileSync('./runtime/baseline.js','utf8');if(hash(worker)!=='0a109e789a8081f80604c9a30a2ad48d923a30ab6f513027f3ce94499dcbb9c4')throw Error('wrong production baseline');
const mapping={sendMailToTelegram:'_P',CONSTANTS:'pe',parseMail:'hQ',newTelegramBot:'uv',Markup:'Fo.Markup',telegramOwnsCurrentAddress:'pr3Owns',triggerWebhook:'lH',getBooleanValue:'$e',commonParseMail:'_o',sendWebhook:'gb'};
function compile(file,name){let s=fs.readFileSync('../../worker/src/'+file,'utf8');s=s.slice(s.indexOf('export async function '+name+'('));const end=s.indexOf('\nexport ',1);if(end>=0)s=s.slice(0,end);s=s.replace(/^export /,'');for(const [a,b]of Object.entries(mapping))s=s.replace(new RegExp('\\b'+a+'\\b','g'),()=>b);return esbuild.transformSync(s,{loader:'ts',target:'es2022',format:'esm'}).code;}
function replace(start,end,replacement){const a=worker.indexOf(start),b=worker.indexOf(end,a+1);if(a<0||b<0)throw Error(start);worker=worker.slice(0,a)+replacement+'\n'+worker.slice(b);}
replace('async function _P(', '__name(_P,',compile('telegram_api/telegram.ts','sendMailToTelegram'));
replace('async function lH(', '__name(lH,',compile('common.ts','triggerWebhook'));
const start=worker.indexOf('async function xQ('),end=worker.indexOf('__name(xQ,',start);let email=worker.slice(start,end),before=email;
email=email.replace('let o = e34.headers.get("Message-ID");','let o = e34.headers.get("Message-ID"), storedMailId;').replace('let { success: a } = await t.DB.prepare("INSERT INTO raw_mails','let { success: a, meta } = await t.DB.prepare("INSERT INTO raw_mails').replace('    a || (e34.setReject','    if (a && Number.isSafeInteger(meta?.last_row_id) && meta.last_row_id > 0) storedMailId = meta.last_row_id;\n    else (e34.setReject').replaceAll('e34.to, i, o);','e34.to, i, storedMailId);');if(email===before||!email.includes('meta.last_row_id'))throw Error('email patch failed');worker=worker.slice(0,start)+email+worker.slice(end);
fs.writeFileSync('./runtime/candidate.js',worker);
fs.writeFileSync('./evidence/candidate.json',JSON.stringify({baseline_sha256:hash(fs.readFileSync('./runtime/baseline.js')),candidate_sha256:hash(worker),changed_sections:['sendMailToTelegram','triggerWebhook','email INSERT/calls'],preserved:'All other deployed code bytes, hello forwarding, AuthInbox RPC, session/rate/permission/cleanup code; Pages untouched'},null,2)+'\n');
for(const [label,text]of [['baseline',fs.readFileSync('./runtime/baseline.js','utf8')],['candidate',worker]]){
const tests=text.replace('import { connect as fve } from "cloudflare:sockets";','const fve=()=>{throw Error("isolated sockets stub")};').replace(/export \{[\s\S]*?\};?\s*$/,'')+'\nexport {xQ as email,_P as sendMailToTelegram,lH as triggerWebhook,pr3Owns as telegramOwnsCurrentAddress,Fo as TelegramModule,Ct as Jwt,pe as CONSTANTS};';
fs.writeFileSync('./runtime/'+label+'-test.mjs',tests);
}
