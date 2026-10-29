import 'dotenv/config.js';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

// Registers the /deobf slash command.
// If GUILD_ID is set, registers to that guild (instant, good for dev).
// Otherwise registers globally (can take up to ~1h to propagate).
const command = new SlashCommandBuilder()
  .setName('deobf')
  .setDescription('Deobfusca um arquivo JavaScript a partir de uma URL.')
  .addStringOption((opt) =>
    opt
      .setName('url')
      .setDescription('URL direta do arquivo .js a deobfuscar')
      .setRequired(true),
  );

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
  await rest.put(route, { body: [command.toJSON()] });
  console.log(
    guildId
      ? `Comando /deobf registrado na guild ${guildId}.`
      : 'Comando /deobf registrado globalmente (pode levar até ~1h).',
  );
} catch (err) {
  console.error('Erro ao registrar comando:', err);
  process.exit(1);
}
