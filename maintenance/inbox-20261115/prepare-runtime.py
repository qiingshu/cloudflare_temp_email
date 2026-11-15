from pathlib import Path
import shutil,json,hashlib,sys
base=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve()
if out.exists():raise SystemExit('Output must be new')
shutil.copytree(base,out)
p=out/'assets/index-auth-20261109-telegram-9c6f08af.js';s=p.read_text()
assert hashlib.sha256(p.read_bytes()).hexdigest() == 'b2a6fbb153213740543832470390fa5d3dd2cacfa5c24061e9e36f3e5b6b3692', 'Baseline main module changed'
a=s.index('      ], async ([se, _e], [I, K]) => {',s.index('      fetchMailData:'))
b=s.index('      }, ae = async () => {',a)
old=s[a:b]
new='''      ], async ([se, _e]) => {
        if (requestedPage?.page === se && requestedPage.pageSize === _e) return;
        if (loadedPage.page !== se || loadedPage.pageSize !== _e) await Q();
      });
      let loadedPage = { page: y.value, pageSize: C.value };
      let requestedPage = null;
      const Q = async () => {
        const pagination = { page: y.value, pageSize: C.value };
        requestedPage = pagination;
        l.value = true;
        try {
          const { results: se, count: _e } = await n.fetchMailData(pagination.pageSize, (pagination.page - 1) * pagination.pageSize);
          const mails = await Promise.all(se.map(async (I) => (I.checked = false, await kW(I))));
          if (requestedPage !== pagination) return false;
          p.value = mails;
          loadedPage = pagination;
          v.value = _e;
          S.value = !r.value && p.value.length > 0 ? p.value[0] : null;
          return true;
        } catch (se) {
          if (requestedPage !== pagination) return false;
          t.error(se.message || "error"), console.error(se);
          if (y.value === pagination.page && C.value === pagination.pageSize) {
            y.value = loadedPage.page;
            C.value = loadedPage.pageSize;
          }
          return false;
        } finally {
          if (requestedPage === pagination) {
            requestedPage = null;
            l.value = false;
          }
        }
'''
s=s[:a]+new+s[b:]
a=s.index('      }, ve = async () => {',s.index('      fetchMailData:'));b=s.index('      }, V = async () => {',a)
old2=s[a:b]
new2=old2.replace('        try {','        const deletedIds = new Set();\n        try {',1).replace('await n.deleteMail(I.id), E.value = true, P.value = {','await n.deleteMail(I.id), deletedIds.add(I.id), P.value = {').replace('          t.success(T("success")), await Q();','''          p.value = p.value.filter(mail => !deletedIds.has(mail.id));
          v.value = Math.max(0, v.value - deletedIds.size);
          if (deletedIds.has(S.value?.id)) S.value = null;
          E.value = true;
          t.success(T("success")), await Q();''').replace('        } catch (se) {','''        } catch (se) {
          p.value = p.value.filter(mail => !deletedIds.has(mail.id));
          v.value = Math.max(0, v.value - deletedIds.size);
          if (deletedIds.has(S.value?.id)) S.value = null;''').replace('          l.value = false, E.value = true;','          l.value = false;')
s=s[:a]+new2+s[b:];p.write_text(s)
# Export only modified closures for isolated state tests before URL rewriting.
(out.parent/'runtime-closures.json').write_text(json.dumps({'refresh':new[new.index('      let loadedPage'):], 'delete':new2[new2.index('        const deletedIds'):]}))
# Rename changed entry and the transitive set of importers to keep browser caches safe.
js={f.name:f for f in (out/'assets').iterdir() if f.suffix in ('.js','.mjs')}
changed={p.name}
while True:
 nxt=changed|{name for name,f in js.items() if any(x in f.read_text() for x in changed)}
 if nxt==changed:break
 changed=nxt
mapping={name:Path(name).stem+'-inbox-20261115'+Path(name).suffix for name in changed}
for name in sorted(changed):
 txt=js[name].read_text()
 for oldname,newname in sorted(mapping.items(),key=lambda x:-len(x[0])):txt=txt.replace(oldname,newname)
 (out/'assets'/mapping[name]).write_text(txt)
# Restore original main path so old cached import graphs remain byte-identical.
p.write_bytes((base/'assets'/p.name).read_bytes())
p=out/'index.html';txt=p.read_text()
for oldname,newname in mapping.items():txt=txt.replace(oldname,newname)
p.write_text(txt)
(out.parent/'runtime-diff-sections.txt').write_text(old+'\n---\n'+new+'\n---\n'+old2+'\n---\n'+new2)
print('baseline files',len([f for f in base.rglob('*') if f.is_file()]),'cache-safe modules',len(changed))
