import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
const dom = new JSDOM('<!doctype html><body></body>', { url:'https://mail.test.invalid', runScripts:'dangerously' });
for (const k of ['window','document','Element','HTMLElement','SVGElement','Node','DOMParser']) globalThis[k]=dom.window[k];
const { parse, compileScript } = await import('vue/compiler-sfc');
const { createApp, nextTick } = await import('vue');
const source = await readFile(new URL('../src/components/ShadowHtmlComponent.vue',import.meta.url),'utf8');
const { descriptor } = parse(source);
const compiled = compileScript(descriptor,{id:'test-shadow',inlineTemplate:true}).content
  .replaceAll(/from ["']vue["']/g, `from ${JSON.stringify(pathToFileURL(require.resolve('vue')).href)}`)
  .replace("'../utils/mail-html.mjs'",JSON.stringify(new URL('../src/utils/mail-html.mjs',import.meta.url).href));
const Component = (await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))).default;
const { sanitizeMailHtml } = await import('../src/utils/mail-html.mjs');
test('SendBox desktop and mobile use the reviewed component, text/source stay interpolated',async()=>{
  const s=await readFile(new URL('../src/components/SendBox.vue',import.meta.url),'utf8');
  assert.equal((s.match(/<ShadowHtmlComponent v-else :htmlContent="curMail.content"/g)||[]).length,2);
  assert.doesNotMatch(s,/v-html="curMail.content"/);
  assert.equal((s.match(/<pre v-else-if="!curMail.is_html"/g)||[]).length,2);
});
test('mounted component blocks active HTML, isolates styles, preserves normal content',async()=>{
  dom.window.pwned=0;
  const host=document.createElement('div'); document.body.append(host);
  const app=createApp(Component,{htmlContent:`<p><b>正常正文</b></p><style>body{display:none}</style><table><tr><td style="color:red">表格</td></tr></table><a href="https://example.com">链接</a><img src="https://example.com/a.png" onerror="window.pwned++"><img src="data:image/png;base64,iVBORw0KGgo="><script>window.pwned++</script><a href="javascript:window.pwned++">坏链接</a><iframe srcdoc="bad"></iframe>`});
  app.mount(host); await nextTick();
  const root=host.firstElementChild.shadowRoot;
  assert.ok(root); assert.ok(root.querySelector('style')); assert.equal(document.querySelector('style'),null);
  assert.match(root.querySelector('style').textContent,/body\{display:none\}/);
  assert.match(root.textContent,/正常正文/); assert.equal(root.querySelector('a').href,'https://example.com/');
  assert.equal(root.querySelector('table td').textContent,'表格');
  assert.equal(root.querySelector('table td').style.color,'red');
  assert.deepEqual([...root.querySelectorAll('img')].map(img=>img.getAttribute('src')),
    ['https://example.com/a.png','data:image/png;base64,iVBORw0KGgo=']);
  for(const e of root.querySelectorAll('*')) {
    for(const a of e.attributes) assert.ok(!/^on/i.test(a.name));
    e.dispatchEvent(new dom.window.Event('error'));
  }
  assert.equal(root.querySelector('script,iframe'),null); assert.equal(dom.window.pwned,0);
  app.unmount(); host.remove();
});
test('negative control executes an uncleaned event payload',()=>{
  dom.window.pwned=0;
  const raw=document.createElement('div');document.body.append(raw);
  try {
    raw.innerHTML='<img src="x" onerror="window.pwned=99">';
    raw.querySelector('img').dispatchEvent(new dom.window.Event('error'));
    assert.equal(dom.window.pwned,99);
  } finally {raw.remove();dom.window.pwned=0;}
});
test('fallback strips global styles while keeping inline formatting',async()=>{
  const attach=Element.prototype.attachShadow; Element.prototype.attachShadow=undefined;
  const host=document.createElement('div'); document.body.append(host);
  const app=createApp(Component,{htmlContent:'<style>body{display:none}</style><p style="color:red">safe</p><img onerror="bad()">'});
  try { app.mount(host); await nextTick(); assert.equal(host.querySelector('style'),null); assert.match(host.innerHTML,/color: ?red/); }
  finally { app.unmount();host.remove();Element.prototype.attachShadow=attach; }
  assert.doesNotMatch(sanitizeMailHtml('<svg onload="bad()"></svg><form>bad</form>'),/onload|<form/);
});
