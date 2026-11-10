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

## Rodar

Abra `index.html` no navegador, ou:

```bash
python3 -m http.server 8080
```

As respostas são simuladas (modo demonstração). Para respostas reais, substitua `mockReply` em `js/app.js` por uma chamada ao seu backend/API.
