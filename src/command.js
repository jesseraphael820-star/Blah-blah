import { SlashCommandBuilder } from 'discord.js';

// Single source of truth for the /deobf command definition,
// shared by the runtime (auto-register on boot) and the manual
// registration script.
export const deobfCommand = new SlashCommandBuilder()
  .setName('deobf')
  .setDescription('Deobfusca um arquivo JavaScript a partir de uma URL.')
  .addStringOption((opt) =>
    opt
      .setName('url')
      .setDescription('URL direta do arquivo .js a deobfuscar')
      .setRequired(true),
  );
