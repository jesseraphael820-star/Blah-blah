# LOOKSMAXXING AI

Estúdio de simulação visual de looksmaxxing com inteligência artificial. O usuário envia uma foto do rosto e simula cortes de cabelo, cuidados com a pele, barba, iluminação e acessórios, sempre com comparação **ANTES | DEPOIS**.

## Funcionalidades

- **Upload de foto**: arrastar e soltar, galeria ou câmera (celular), prévia, trocar/remover. A imagem é normalizada no navegador (orientação corrigida, redimensionada e **sem metadados EXIF/GPS**).
- **Detecção automática de rosto**: MediaPipe BlazeFace rodando 100% no navegador (WASM + modelo servidos pelo próprio site), com caixa e pontos-chave sobre a foto e opção "Enquadrar rosto".
- **Ferramentas com IA** (30+ opções):
  - **Pele (Skinmaxxing)**: tom uniforme, manchas e vermelhidão, hidratação, 3 níveis de textura, intensidade sutil/moderado/forte.
  - **Cabelo (Hairmaxxing)**: low fade, mid fade, French crop, buzz cut, curto/médio/longo, ondulado, cacheado, volume, slick back, franja, undercut.
  - **Rosto**: iluminação (estúdio, lateral, golden hour, neon), barbas, contorno por luz e sombra (sem alterar anatomia), sobrancelhas, estilos de roupa.
  - **Acessórios**: boné Smashing, snapback, dad hat, trucker, gorro, bucket (com cores), óculos (aviador, wayfarer, redondo, retangular), corrente, brinco, headphone.
  - **Gua Sha**: guia educativo de uso seguro, ilustração do acessório de aço, comparação ilustrativa e simulação com IA de você usando a ferramenta.
  - **Hábitos**: sono, hidratação, pele, postura e atividade física, com checklist diário.
- **Comparador ANTES | DEPOIS**: controle deslizante vertical (mouse, toque e teclado), lado a lado, comparar com original ou com a versão anterior, desfazer/refazer, restaurar original, salvar imagem editada e salvar a imagem de comparação.
- **Dashboard**: Minha foto, Ferramentas, Últimas simulações, Favoritos, Histórico, Configurações.
- **Privacidade**: consentimento antes do primeiro envio à IA; foto e histórico guardados só no navegador (IndexedDB), com opção de desativar e de apagar tudo.

## Integração de IA

As edições são feitas no servidor (`/api/edit`), por um destes provedores:

| Provedor | Variável | Modelo padrão |
| --- | --- | --- |
| OpenAI Images API (`/v1/images/edits`) | `OPENAI_API_KEY` | `gpt-image-1` com `input_fidelity: high` (preserva o rosto) |
| Replicate | `REPLICATE_API_TOKEN` | `black-forest-labs/flux-kontext-pro` |

**Sem chave configurada, o app não finge editar**: mostra uma mensagem explicando como configurar a integração e não envia a foto.

O cliente envia apenas ids de ferramenta validados; o prompt é montado no servidor (`src/lib/tools.ts`) com regras rígidas de preservação de identidade ("mude SOMENTE X, mantenha o mesmo rosto, sem embelezar ou alterar anatomia").

## Rodar localmente

Requer Node.js 20.9+.

```bash
npm install            # também copia o WASM do MediaPipe para public/mediapipe
cp .env.example .env.local   # preencha OPENAI_API_KEY ou REPLICATE_API_TOKEN
npm run dev            # http://localhost:3000
```

## Publicar na Vercel

1. Importe o repositório na Vercel (framework detectado: Next.js).
2. Em **Settings → Environment Variables**, adicione `OPENAI_API_KEY` (ou `REPLICATE_API_TOKEN`). Variáveis opcionais estão em `.env.example`.
3. Faça o deploy. A rota `/api/edit` usa `maxDuration = 120` s (edições podem levar de 20 a 60 s).

## Testes

```bash
npm run typecheck
npm run build
# teste ponta a ponta (Playwright + Chromium):
npm i -D playwright && npx playwright install chromium
# coloque uma foto frontal de rosto em tests/fixtures/face.jpg
npm run test:e2e
```

O teste E2E sobe o servidor de produção sem chaves e cobre: API sem configuração, upload e rejeição de arquivo inválido, detecção de rosto, mensagem de IA não configurada (sem envio da foto), consentimento, carregamento, comparador (arrastar e teclado), lado a lado, edições encadeadas, desfazer/refazer/restaurar, downloads, favoritos, histórico persistente após recarregar, exclusões, Gua Sha, hábitos e layout no celular sem rolagem horizontal. Nesse teste, a resposta do provedor de IA é interceptada para não gastar créditos.

## Estrutura

```
src/
  app/                 páginas (/, /studio, /privacidade) e rotas de API
    api/edit           edição com IA (validação, rate limit, sem armazenamento)
    api/status         informa se a IA está configurada (sem expor chaves)
  components/
    compare/           comparador ANTES | DEPOIS e overlay de processamento
    education/         Gua Sha e hábitos
    landing/           cabeçalho, rodapé e upload da home
    studio/            dashboard, editor, painel de ferramentas, histórico, configurações
    ui/                componentes reutilizáveis (Button, Card, Modal, Toaster…)
    upload/            upload de foto e overlay de detecção de rosto
  lib/
    server/            config de provedor, validação de imagem, rate limit, provedores
    tools.ts           catálogo de ferramentas e montagem de prompts
    image.ts           processamento de imagem no navegador
    face-detection.ts  MediaPipe
    storage.ts         IndexedDB local
  store/studio.tsx     estado global (versões, histórico, favoritos, configurações)
```

## Segurança

- Chaves de API só no servidor; nunca chegam ao navegador.
- Validação de tamanho (≤ 4 MB), MIME e assinatura real do arquivo (magic bytes).
- Prompts definidos no servidor, sem texto livre do usuário.
- Limite de requisições por IP (`RATE_LIMIT_PER_MINUTE`, melhor esforço em serverless).
- Respostas `no-store`; cabeçalhos de segurança (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- Nenhuma imagem é gravada em disco, banco ou logs do servidor.

> As imagens são simulações visuais para inspiração. Não representam resultados garantidos e não substituem orientação médica ou profissional.
