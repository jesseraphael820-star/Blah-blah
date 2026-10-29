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

## Requisitos

- Node.js 18+
