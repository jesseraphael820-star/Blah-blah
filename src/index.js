import 'dotenv/config.js';
import { Client, GatewayIntentBits, Events, AttachmentBuilder, REST, Routes } from 'discord.js';
import { downloadSource, deobfuscate } from './deobfuscate.js';
import { deobfCommand } from './command.js';

// Discord hard-limits a single message to 2000 chars. We inline a short
// preview and always attach the full result as a file.
const PREVIEW_CHARS = 1500;

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Falta DISCORD_TOKEN no ambiente (.env).');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Register the slash command on boot (idempotent). This is what makes the
// bot work on hosts like Discloud where you can't run a separate script.
async function registerCommands(clientId) {
  const guildId = process.env.GUILD_ID;
  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  await rest.put(route, { body: [deobfCommand.toJSON()] });
  console.log(
    guildId
      ? `/deobf registrado na guild ${guildId}.`
      : '/deobf registrado globalmente (propaga em até ~1h).',
  );
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot online como ${c.user.tag}`);
  try {
    await registerCommands(c.user.id);
  } catch (err) {
    console.error('Falha ao registrar comando no boot:', err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'deobf') return;

  const url = interaction.options.getString('url', true);

  // Deobfuscation can take several seconds; defer so we don't hit the 3s ack limit.
  await interaction.deferReply();

  try {
    const source = await downloadSource(url);
    if (!source.trim()) {
      await interaction.editReply('O arquivo baixado está vazio.');
      return;
    }

    const code = await deobfuscate(source);

    // Derive an output filename from the URL path.
    let base = 'deobf';
    try {
      const name = new URL(url).pathname.split('/').pop() || '';
      base = name.replace(/\.js$/i, '').replace(/[^\w.-]/g, '_') || 'deobf';
    } catch {
      /* keep default */
    }

    const file = new AttachmentBuilder(Buffer.from(code, 'utf8'), {
      name: `${base}.deobf.js`,
    });

    const fence = '```';
    // Prevent an embedded ``` in the code from breaking our fenced block.
    const safe = (s) => s.replace(/`/g, '​`');
    const preview =
      code.length > PREVIEW_CHARS
        ? `${safe(code.slice(0, PREVIEW_CHARS))}\n… (truncado — ver arquivo anexado)`
        : safe(code);

    await interaction.editReply({
      content: `✅ Deobfuscado \`${url}\`\n${fence}js\n${preview}\n${fence}`,
      files: [file],
    });
  } catch (err) {
    console.error('Erro no /deobf:', err);
    await interaction.editReply(`❌ ${err.message || 'Erro ao deobfuscar.'}`);
  }
});

client.login(token);
