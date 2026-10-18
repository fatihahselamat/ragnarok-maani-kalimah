#!/usr/bin/env python3
"""Jana senarai fail + versi cache dalam sw.js. Jalankan dari akar projek: python3 tools/stamp.py"""
import hashlib, json, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
skip_dirs = {'.git', 'tools', 'node_modules'}
skip_files = {'sw.js', 'README.md', 'netlify.toml', '.gitignore', '.nojekyll'}
files, h = [], hashlib.sha1()
for d, ds, fs in os.walk(root):
    ds[:] = sorted(x for x in ds if x not in skip_dirs)
    for f in sorted(fs):
        if f in skip_files: continue
        p = os.path.join(d, f)
        rel = os.path.relpath(p, root).replace(os.sep, '/')
        files.append('./' + rel)
        h.update(rel.encode()); h.update(open(p, 'rb').read())
files.insert(0, './')
src = open(os.path.join(root, 'sw.js'), encoding='utf-8').read()
src = re.sub(r"const VERSION = '.*?';", "const VERSION = 'maani-%s';" % h.hexdigest()[:10], src)
src = re.sub(r"const FILES = .*?;\n", "const FILES = %s;\n" % json.dumps(files, ensure_ascii=False), src, count=1, flags=re.S)
open(os.path.join(root, 'sw.js'), 'w', encoding='utf-8').write(src)
print(len(files), 'fail dalam cache')
