# PhoneCheck

Site de diagnóstico de celulares que roda **inteiramente no navegador**. A pessoa abre o site no próprio aparelho, inicia a verificação e recebe um relatório visual do que está funcionando e do que precisa de atenção.

## Recursos

- **13 verificações automáticas**: modelo do dispositivo, sistema e versão, navegador e compatibilidade, resolução, tamanho da tela, taxa de atualização (medida em tempo real), orientação, toque, conexão com a internet (latência real), velocidade de download (download real), bateria, memória/processamento (benchmark em Web Worker) e GPU.
- **7 testes interativos** (só com autorização/participação do usuário): câmera, microfone, alto-falante, vibração, sensores de movimento, teste de pixels em tela cheia e mapa de toque.
- Painel final com indicador circular, contadores, gráfico por categoria, relatório completo com filtros e data/hora.
- Exportação em **PDF**, **compartilhamento** (Web Share ou área de transferência), **histórico local**, tema claro/escuro e efeitos sonoros opcionais (desativados por padrão).

## Honestidade dos resultados

- Nenhum resultado é simulado. Quando o navegador não expõe uma informação, o teste aparece como **"Não disponível"** e não entra no percentual.
- O percentual é `aprovados ÷ testes executados` — **não** representa a saúde física do aparelho.
- Testes que dependem da percepção humana (alto-falante, vibração, pixels) são marcados como "confirmado pelo usuário".

## Privacidade

Nada é enviado para servidores próprios. O histórico fica no `localStorage`. O teste de conexão faz requisições anônimas a `gstatic.com`/`cloudflare.com`, e o teste de velocidade baixa dados de `speed.cloudflare.com`. O jsPDF é carregado do cdnjs apenas quando o PDF é gerado.

## Como executar

É um site estático (HTML + CSS + JavaScript em módulos ES), sem etapa de build.

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

Câmera, microfone e sensores exigem **HTTPS** (ou `localhost`). Para publicar, qualquer hospedagem estática com HTTPS funciona (GitHub Pages, Netlify, Vercel, Cloudflare Pages).

## Estrutura

```
index.html            telas (início, diagnóstico, resultado, histórico)
css/styles.css        design system, glassmorphism, animações, responsivo, temas
js/app.js             orquestração do fluxo
js/ui.js              renderização da interface
js/detect.js          identificação de dispositivo/sistema/navegador
js/tests/auto.js      verificações automáticas
js/tests/interactive.js  testes com permissão/participação
js/score.js           status e cálculo do resumo
js/report.js          PDF e compartilhamento
js/history.js         histórico local
js/sound.js           efeitos sonoros (Web Audio)
js/icons.js           ícones SVG
```
