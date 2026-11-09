"""After apply-runtime.py, prepare cache-safe Pages preserving original customized modules.
Usage: python finalize-pages.py RUNTIME_DIR BASELINE_DIR OUTPUT_DIR
No network, credentials, deployment or database operations.
"""
from pathlib import Path
import sys,shutil,subprocess,json
runtime,baseline,output=map(lambda p:Path(p).resolve(),sys.argv[1:])
if output.exists():raise SystemExit('Output must be new')
shutil.copytree(runtime,output)
subprocess.run(['patch','--batch','--fuzz=0','-p0','-i',str(Path(__file__).with_name('iframe-cid-compat.patch').resolve())],cwd=output,check=True)
(output/'index.js').unlink()
modules=[p for p in (output/'assets').iterdir() if p.suffix in ['.js','.mjs']]
mapping={p.name:p.stem+'-security-f98cd117'+p.suffix for p in modules}
for p in modules:
 text=p.read_text()
 for old,new in sorted(mapping.items(),key=lambda x:-len(x[0])):text=text.replace(old,new)
 (p.parent/mapping[p.name]).write_text(text)
for p in modules:
 old=baseline/'assets'/p.name
 if old.exists():p.write_bytes(old.read_bytes())
 else:p.unlink()
p=output/'index.html';text=p.read_text()
for old,new in mapping.items():text=text.replace(old,new)
p.write_text(text)
print('Prepared cache-safe frontend with sandbox CID compatibility; nothing deployed')
