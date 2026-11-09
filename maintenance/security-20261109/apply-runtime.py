"""Apply narrowly scoped patches to verified production downloads, never rebuild old main.

Usage: python apply-runtime.py BASELINE_DIR OUTPUT_DIR
BASELINE_DIR contains index.js and assets/{index-auth-20261109.js,Mail-gWf0Bcc3-mailnav20261030.js}.
No upload, deployment, account changes, or database access is performed.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

here = Path(__file__).resolve().parent
baseline, output = map(lambda x: Path(x).resolve(), sys.argv[1:])
if output == baseline or baseline in output.parents:
    raise SystemExit('Output must be separate from baseline')
manifest = json.loads((here / 'baseline.json').read_text())
for filename, expected in [
    ('index.js', manifest['worker_sha256']),
    ('assets/index-auth-20261109.js', manifest['frontend_sha256']),
]:
    actual = hashlib.sha256((baseline / filename).read_bytes()).hexdigest()
    if actual != expected:
        raise SystemExit(f'Baseline mismatch: {filename}')
if output.exists():
    raise SystemExit('Output already exists; use a new directory')
shutil.copytree(baseline, output)
for name in ['worker-production.patch', 'frontend-production.patch', 'telegram-frontend-production.patch']:
    subprocess.run(['patch', '--batch', '--fuzz=0', '-p0', '-i', str(here / name)], cwd=output, check=True)
for name in ['mail-html.mjs', 'dompurify-3.4.17.mjs']:
    shutil.copy2(here.parents[1] / 'frontend/src/utils' / name, output / 'assets' / name)
if hashlib.sha256((output / 'index.js').read_bytes()).hexdigest() != manifest['candidate_worker_sha256']:
    raise SystemExit('Candidate worker hash mismatch')
print('Verified runtime patch prepared; nothing deployed')
