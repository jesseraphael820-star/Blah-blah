# deobf-discord-bot

Bot de Discord com um comando slash `/deobf <URL>` que baixa um arquivo
JavaScript, deobfusca/desminifica com [webcrack](https://github.com/j4k0xb/webcrack)
e responde com um preview + o arquivo `.deobf.js` completo anexado.

O webcrack lida com saída do obfuscator.io, unminify genérico, desempacotamento
de string-arrays e divisão de bundles webpack/browserify.

## Setup

1. **Crie a aplicação e o bot** no [Discord Developer Portal](https://discord.com/developers/applications):
   - Em **Bot**, clique em *Reset Token* e copie o token.
   - Em **General Information**, copie o *Application ID* (= `CLIENT_ID`).
2. **Convide o bot** no servidor (OAuth2 > URL Generator):
   - Scopes: `bot` e `applications.commands`.
   - Nenhuma permissão especial é necessária (só enviar mensagens/anexos).
3. **Configure o ambiente:**
   ```bash
   cp .env.example .env
   # preencha DISCORD_TOKEN, CLIENT_ID e (opcional) GUILD_ID
   ```
4. **Instale as dependências:**
   ```bash
   npm install
   ```
5. **Registre o comando slash:**
   ```bash
   npm run register
   ```
   Com `GUILD_ID` setado o comando aparece na hora; sem ele, o registro é
   global e pode levar até ~1h.
6. **Rode o bot:**
   ```bash
   npm start
   ```

## Uso

No Discord:

```
/deobf url: https://exemplo.com/arquivo.min.js
```

O bot responde com um trecho inline e anexa o arquivo deobfuscado completo.

## Limites

- Download: máx **8 MB**, timeout de 20s, apenas `http(s)`.
- O preview inline é truncado em ~1500 caracteres (limite de mensagem do
  Discord); o arquivo anexado sempre contém o resultado completo.

## Hospedar na Discloud

O projeto já vem com `discloud.config`. O bot **registra o `/deobf` sozinho ao
ligar**, então não precisa rodar `npm run register` na Discloud.

1. No **painel da Discloud** (ou via app da Discloud no Discord), adicione a
   variável de ambiente **`DISCORD_TOKEN`** com o token do bot.
   - Opcional: `GUILD_ID` para o comando aparecer na hora em um servidor.
   - Não precisa de `CLIENT_ID` na Discloud — o bot descobre sozinho ao ligar.
   - **Nunca** coloque o token no `discloud.config` nem no Git.
2. Faça o deploy de uma destas formas:
   - **Zip:** gere um `.zip` da pasta (sem `node_modules`) e suba pelo site ou
     com `.up` (app da Discloud no Discord). A Discloud instala as dependências
     pelo `package.json` automaticamente.
   - **CLI:** `npm i -g discloud` → `discloud login` → `discloud up`.
3. Pronto — o bot sobe, registra o `/deobf` e fica online 24/7.

> `RAM=256` no `discloud.config` dá folga para o parsing do webcrack. Ajuste
> conforme teu plano.

## Requisitos

- Node.js 18+
