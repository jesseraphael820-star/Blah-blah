# Junta o código ISO 3166-2 de cada estado do mapa (WORLD.states) a partir do admin-1 da Natural Earth.
import json, sys
world_js, admin1, out = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(world_js, encoding='utf-8').read()
W = json.loads(src[src.index('{'):src.rindex('}') + 1])
a2 = [c['a'] for c in W['countries']]
geo = json.load(open(admin1, encoding='utf-8'))
by = {}
for f in geo['features']:
    p = f['properties']
    code = p.get('iso_3166_2') or ''
    if not code or code.endswith('~') or '-' not in code: continue
    for nm in (p.get('name_pt'), p.get('name'), p.get('name_en')):
        if nm: by.setdefault((code.split('-')[0], nm), code)
res = {}
for i, s in enumerate(W['states']['list']):
    cc = a2[s['c']]
    code = by.get((cc, s['n']))
    if code and cc != 'BR': res[str(i)] = code
json.dump(res, open(out, 'w'))
print(len(res), 'estados com código ISO (fora o Brasil) de', len(W['states']['list']))
