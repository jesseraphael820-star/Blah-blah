# Lê o arquivo do pacote br-state-flags COMO TEXTO (sem executar nada) e monta um SVG por estado.
import re, sys, json, ast
src = open(sys.argv[1], encoding='utf-8').read()
out = {}
TOK = re.compile(r'\s+|/\*.*?\*/|//[^\n]*|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|\.\.\.|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[A-Za-z_$][\w$]*|[()\[\]{},:;=>.]', re.S)
def tokens(s, i):
    while i < len(s):
        m = TOK.match(s, i)
        if not m: raise SyntaxError(s[i:i+40])
        t = m.group(0); i = m.end()
        if t.isspace() or t.startswith('/*') or t.startswith('//'): continue
        yield t, i
class P:
    def __init__(self, s, i): self.g = tokens(s, i); self.next()
    def next(self): self.t, self.pos = next(self.g, (None, None))
    def eat(self, x):
        if self.t != x: raise SyntaxError(f'esperava {x}, achou {self.t}')
        self.next()
    def value(self):
        t = self.t
        if t in ('jsx', 'jsxs'):
            self.next(); self.eat('('); tag = self.value(); self.eat(','); props = self.value()
            if self.t == ',': self.next(); self.value()
            self.eat(')'); return ('el', tag, props)
        if t == '{':
            self.next(); o = {}
            while self.t != '}':
                if self.t == '...': self.next(); self.next()
                else:
                    k = self.t; self.next(); k = ast.literal_eval(k) if k[0] in ('"', "'") else k
                    self.eat(':'); o[k] = self.value()
                if self.t == ',': self.next()
            self.next(); return o
        if t == '[':
            self.next(); a = []
            while self.t != ']':
                a.append(self.value())
                if self.t == ',': self.next()
            self.next(); return a
        self.next()
        if t[0] == '"': return ast.literal_eval(t)
        if t[0] == "'": return t[1:-1]
        if re.match(r'-?[\d.]', t): return t
        if t in ('true', 'false', 'null', 'undefined'): return None if t in ('null', 'undefined') else t
        raise SyntaxError('valor inesperado ' + t)
REN = {'className': 'class', 'xmlSpace': 'xml:space', 'xlinkHref': 'xlink:href', 'xmlnsXlink': 'xmlns:xlink'}
KEEP = {'viewBox','preserveAspectRatio','gradientUnits','gradientTransform','patternUnits','patternTransform','spreadMethod','textLength','lengthAdjust','markerWidth','markerHeight','refX','refY','stdDeviation','clipPathUnits','maskUnits','startOffset','pathLength'}
def attr(k): return k if k in KEEP else REN.get(k) or re.sub(r'[A-Z]', lambda m: '-' + m.group(0).lower(), k)
def esc(v): return str(v).replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')
def ser(n):
    if n is None: return ''
    if isinstance(n, list): return ''.join(ser(x) for x in n)
    if isinstance(n, tuple):
        _, tag, props = n; a = ''
        for k, v in props.items():
            if k == 'children' or v is None: continue
            if k in ('width', 'height') and tag == 'svg': continue
            if isinstance(v, dict): a += ' style="' + esc(';'.join(f'{attr(sk)}:{sv}' for sk, sv in v.items())) + '"'
            else: a += f' {attr(k)}="{esc(v)}"'
        if tag == 'svg': a += ' width="144" height="96" preserveAspectRatio="none"'
        return f'<{tag}{a}>{ser(props.get("children"))}</{tag}>'
    return esc(n)
for m in re.finditer(r'^var ([A-Z]{2}) = \(props\) => ', src, re.M):
    uf = m.group(1)
    try: out[uf] = ser(P(src, m.end()).value())
    except Exception as e: print(uf, 'falhou:', e)
json.dump(out, open(sys.argv[2], 'w'))
print(len(out), 'SVGs;', sum(len(v) for v in out.values()), 'bytes')
