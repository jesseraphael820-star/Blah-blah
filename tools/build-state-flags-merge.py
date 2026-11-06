# Coloca as bandeiras de subdivisões (region-flags, domínio público) em WORLD.stateFlags[país][nome do estado].
import json, sys
world_js, iso_json, png_json = sys.argv[1:4]
src = open(world_js, encoding='utf-8').read()
W = json.loads(src[src.index('{'):src.rindex('}') + 1])
iso = json.load(open(iso_json)); png = json.load(open(png_json))
sf = W.setdefault('stateFlags', {})
n = 0
for i, code in iso.items():
    if code not in png: continue
    st = W['states']['list'][int(i)]; cc = W['countries'][st['c']]['a']
    sf.setdefault(cc, {})[st['n']] = png[code]; n += 1
open(world_js, 'w', encoding='utf-8').write('const WORLD = ' + json.dumps(W, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(n, 'estados receberam bandeira;', {k: len(v) for k, v in sf.items()})
