# Divine AI

Interface web (tema preto) da **Divine AI** — o modelo próprio **Divine AI 1.0** e acesso a vários modelos de outras IAs em um só lugar.

## Modelos

| Provedor | Modelos |
|---|---|
| **Divine** | Divine AI 1.0 |
| **GPT** | GPT Astra 6.1, GPT Sol 6.1, GPT-5.1, GPT-5, GPT-5 mini/nano, GPT-4.1 (+mini), GPT-4o (+mini), o3, o3-pro, o4-mini |
| **Claude** | Opus 5.5, Fable 5.2, Fable 5.1, Sonnet 5.5, Haiku 5.5, Opus 4.5, Sonnet 4.5, Haiku 4.5, Opus 4.1 |
| **Grok** | Grok 4.1, Grok 4.1 Fast, Grok 4, Grok Code Fast, Grok 3, Grok 3 mini |
| **Kimi** | K2 Thinking, K2, K1.5 |
| **Gemini** | Gemini Auto, Argon 4, 3 Pro, 3 Flash, 2.5 Pro/Flash/Flash-Lite, 2.0 Flash, 1.5 Pro/Flash |
| **DeepSeek** | Flash 4.1, V3.2, V3.1, R1, V3, Coder V2, Math, VL2 |

A lista fica em `js/models.js` — basta editar para adicionar ou remover modelos.

## Visual

- Ícone do modelo aparece **na frente** do nome somente quando aquela IA está ativa (no topo, no campo de mensagem e no seletor).
- Quando o Divine AI 1.0 está ativo, aparece o ícone próprio (auréola + estrela) e o texto **"Divine AI"** em roxo com glow.
- Atalhos: `Ctrl K` abre o seletor de modelos, `Ctrl N` inicia nova conversa.

## Rodar com respostas reais

Precisa do Node 18 ou mais novo (sem dependências para instalar).

```bash
cp .env.example .env     # coloque pelo menos uma chave de API no .env
npm start                # ou: node server.js
```

Abra **http://localhost:3000**. O topo da página mostra quantos modelos estão disponíveis com as chaves configuradas.

### Chaves de API

- **Mais simples:** `OPENROUTER_API_KEY` sozinha libera GPT, Claude, Grok, Kimi, Gemini e DeepSeek.
- **Direto no provedor (opcional):** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `MOONSHOT_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`. Quando existe a chave direta, ela tem prioridade sobre o OpenRouter.
- As chaves ficam só no servidor (`.env`, que está no `.gitignore`). O navegador nunca as vê.

### Divine AI 1.0

O Divine AI 1.0 roda sobre um modelo-base escolhido em `DIVINE_BASE_MODEL` (ex.: `claude:claude-sonnet-5-5`), com instruções próprias que fazem ele se apresentar como Divine AI. Se ficar vazio, usa o primeiro provedor que tiver chave.

### IDs dos modelos

O ID que cada modelo usa na API fica em `DIVINE_ROUTES`, no fim de `js/models.js`. Se um provedor responder "modelo não encontrado", ajuste o ID ali. Modelos sem nenhuma rota aparecem como **Sem API** no seletor; modelos sem chave configurada aparecem como **Sem chave**.

### Publicar

Qualquer hospedagem que rode Node serve (Render, Railway, Fly.io, uma VPS). Configure as mesmas variáveis do `.env` no painel da hospedagem. Abrir o `index.html` direto, sem o servidor, mostra a interface mas não gera respostas.
