"""Gera dist/porto-sol.html: o jogo inteiro em um único arquivo (fácil de compartilhar/hospedar)."""
import os, re
s = open('index.html', encoding='utf-8').read()
s = s.replace('<script src="js/vendor/three.min.js"></script>', '<script>\n' + open('js/vendor/three.min.js', encoding='utf-8').read() + '\n</script>')
for f in ['world', 'audio', 'entities', 'render3d', 'main']:
    s = s.replace(f'<script src="js/{f}.js"></script>', '<script>\n' + open(f'js/{f}.js', encoding='utf-8').read() + '\n</script>')
s = s.replace('<link rel="manifest" href="manifest.json">\n', '')
os.makedirs('dist', exist_ok=True)
open('dist/porto-sol.html', 'w', encoding='utf-8').write(s)
print('ok: dist/porto-sol.html')
