# Sabor IA — Avaliador de Bebidas e Comidas

Site que avalia **bebidas e comidas por imagem** usando IA (Claude, da Anthropic).

Envie (ou tire) uma foto e receba:

- **Nota geral de 0 a 10** e notas por critério (Saúde, Sabor, Energia/Saciedade, Hidratação/Apresentação)
- **Potencial** do item (energia, foco, recuperação, saciedade…)
- **O que ele faz no seu corpo** (pico de glicose, efeito da cafeína, hidratação…)
- Pontos positivos e negativos
- Nutrição estimada (calorias, açúcar, proteína, gordura, cafeína)
- Com o que combina, melhor momento para consumir, dica para melhorar a nota e alertas
- Histórico das últimas avaliações (salvo no navegador)

## Como usar

1. Abra `index.html` no navegador (ou publique a pasta no GitHub Pages / Netlify / Vercel).
2. Clique em **⚙️ Configurar** e cole sua chave da API da Anthropic (obtenha em https://console.anthropic.com).
3. Escolha *Detectar*, *Bebida* ou *Comida*, envie a foto e clique em **Avaliar agora**.

Também dá para arrastar a imagem ou colar com Ctrl+V.

## Observações

- A chave fica salva apenas no `localStorage` do seu navegador e é enviada direto para a API da Anthropic.
  Como é um site estático, não publique o site com uma chave embutida — para uso público, coloque um pequeno backend que guarde a chave.
- As avaliações são estimativas da IA e não substituem orientação de nutricionista ou médico.

## Arquivos

- `index.html` — estrutura da página
- `style.css` — visual (com modo escuro automático)
- `app.js` — envio da imagem, chamada à API com saída JSON estruturada e exibição do resultado
