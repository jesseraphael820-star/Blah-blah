"""Gera dist/porto-sol.html: o jogo inteiro em um único arquivo (fácil de compartilhar/hospedar)."""
import os, re
s = open('index.html', encoding='utf-8').read()
for f in ['world', 'audio', 'entities', 'main']:
    s = s.replace(f'<script src="js/{f}.js"></script>', '<script>\n' + open(f'js/{f}.js', encoding='utf-8').read() + '\n</script>')
s = s.replace('<link rel="manifest" href="manifest.json">\n', '')
os.makedirs('dist', exist_ok=True)
open('dist/porto-sol.html', 'w', encoding='utf-8').write(s)
print('ok: dist/porto-sol.html')
