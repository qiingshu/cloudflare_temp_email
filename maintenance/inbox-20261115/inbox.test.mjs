import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {ref,watch,nextTick,effectScope}=require('vue');
const src=fs.readFileSync('frontend/src/components/MailBox.vue','utf8');
const runtime=JSON.parse(fs.readFileSync(new URL('./runtime-closures.json',import.meta.url)));
const tick=async()=>{await nextTick();await new Promise(r=>setImmediate(r));await nextTick()};
function setup(kind){
 const page=ref(1),size=ref(20),data=ref([]),count=ref(60),current=ref(null),loading=ref(false),mobile=ref(false),show=ref(false),progress=ref({});
 const notices=[];const message={error:m=>notices.push(['error',m]),success:m=>notices.push(['success',m])};
 let fetcher=async(l,o)=>({results:[{id:o+1}],count:60}),deleter=async()=>{};
 const props={fetchMailData:(...a)=>fetcher(...a),deleteMail:(...a)=>deleter(...a)};
 let code;
 if(kind==='source'){
  code=src.slice(src.indexOf('let loadedPage'),src.indexOf('const backFirstPageAndRefresh'))+src.slice(src.indexOf('const multiActionDeleteMail'),src.indexOf('const multiActionDownload',src.indexOf('const multiActionDeleteMail')))+'return {refresh,remove:multiActionDeleteMail}';
 }else{
  code=runtime.refresh+'};\nconst remove=async()=>{'+runtime.delete+'};\nwatch([y,C],async([a,b])=>{if(requestedPage?.page===a&&requestedPage.pageSize===b)return;if(loadedPage.page!==a||loadedPage.pageSize!==b)await Q()}); return {refresh:Q,remove};';
 }
 const names=['page','pageSize','data','count','curMail','loading','isMobile','showMultiActionDelete','multiActionDeleteProgress','message','props','processItem','t','watch','console','y','C','p','v','S','l','r','E','P','n','kW','T'];
 const args=[page,size,data,count,current,loading,mobile,show,progress,message,props,async x=>x,x=>x,watch,{error(){}},page,size,data,count,current,loading,mobile,show,progress,props,async x=>x,x=>x];
 // Runtime message binding is t; source localization binding is t.
 if(kind==='runtime'){code='const t=message;'+code; names.splice(names.indexOf('t'),1);args.splice(12,1)}
 const scope=effectScope();let api;scope.run(()=>api=new Function(...names,code)(...args));
 return {...api,page,size,data,count,current,loading,mobile,show,notices,stop:()=>scope.stop(),fetch:f=>fetcher=f,delete:f=>deleter=f};
}
for(const kind of ['source','runtime']){
 test(`${kind}: pagination failure preserves mail, restores size/page, retry works`,async()=>{
  const x=setup(kind);await x.refresh();const mail=x.current.value;
  x.fetch(async()=>{throw Error('offline')});x.page.value=2;await tick();
  assert.equal(x.page.value,1);assert.equal(x.current.value,mail);assert.equal(x.data.value[0].id,1);
  x.size.value=50;await tick();assert.equal(x.size.value,20);assert.equal(x.current.value,mail);
  let calls=0;x.fetch(async(l,o)=>{calls++;assert.equal(l,20);assert.equal(o,20);return {results:[{id:21}],count:60}});
  x.page.value=2;await tick();assert.equal(x.current.value.id,21);assert.equal(calls,1);assert.equal(x.loading.value,false);x.stop();
 });
 test(`${kind}: partial batch preserves failed and pending selections for retry`,async()=>{
  const x=setup(kind);x.data.value=[1,2,3].map(id=>({id,checked:true}));x.count.value=3;x.current.value=x.data.value[0];
  const calls=[];x.delete(async id=>{calls.push(id);if(id===2)throw Error('delete failed')});
  await x.remove();assert.deepEqual(calls,[1,2]);assert.deepEqual(x.data.value.map(m=>[m.id,m.checked]),[[2,true],[3,true]]);assert.equal(x.count.value,2);assert.equal(x.current.value,null);assert.equal(x.notices.some(n=>n[0]==='success'),false);assert.equal(x.show.value,false);
  x.delete(async id=>calls.push(id));x.fetch(async()=>{throw Error('refresh failed')});await x.remove();assert.deepEqual(calls,[1,2,2,3]);assert.equal(x.data.value.length,0);assert.equal(x.count.value,0);assert.equal(x.loading.value,false);x.stop();
 });
 test(`${kind}: latest pagination request wins and empty refresh clears count`,async()=>{
  const x=setup(kind);let release;x.fetch(()=>new Promise(r=>release=r));const first=x.refresh();
  x.fetch(async()=>({results:[],count:0}));x.page.value=2;await tick();release({results:[{id:1}],count:60});await first;
  assert.equal(x.data.value.length,0);assert.equal(x.count.value,0);assert.equal(x.page.value,2);x.stop();
 });
}
