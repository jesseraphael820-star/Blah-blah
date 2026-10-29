import 'dotenv/config.js';
import { REST, Routes } from 'discord.js';
import { deobfCommand } from './command.js';

// Standalone command registration (optional — the bot also auto-registers
// on startup). Useful for local dev when you want to (re)register without
// running the full bot.
// If GUILD_ID is set, registers to that guild (instant). Otherwise global.
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('Faltam DISCORD_TOKEN e/ou CLIENT_ID no ambiente (.env).');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

try {
  await rest.put(route, { body: [deobfCommand.toJSON()] });
  console.log(
    guildId
      ? `Comando /deobf registrado na guild ${guildId}.`
      : 'Comando /deobf registrado globalmente (pode levar até ~1h).',
  );
} catch (err) {
  console.error('Erro ao registrar comando:', err);
  process.exit(1);
}
