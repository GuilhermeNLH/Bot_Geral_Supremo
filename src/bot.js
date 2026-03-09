/**
 * src/bot.js – Discord bot entrypoint.
 *
 * Usage:
 *   node src/bot.js   (or npm start)
 *
 * Required environment variables (see .env.example):
 *   DISCORD_TOKEN       Discord bot token
 *   TRELLO_API_KEY      Trello API key
 *   TRELLO_TOKEN        Trello user token
 *   TRELLO_BOARD_ID     Target Trello board ID
 */

require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { TrelloClient } = require('./trelloClient');
const trelloCommand = require('./commands/trello');

// ── Validation ────────────────────────────────────────────────────────────────

const required = ['DISCORD_TOKEN', 'TRELLO_API_KEY', 'TRELLO_TOKEN', 'TRELLO_BOARD_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ── Discord client ────────────────────────────────────────────────────────────

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const trello = new TrelloClient(
  process.env.TRELLO_API_KEY,
  process.env.TRELLO_TOKEN,
  process.env.TRELLO_BOARD_ID,
);

// ── Event: ready ──────────────────────────────────────────────────────────────

client.once('ready', (c) => {
  console.log(`✅ Logged in as ${c.user.tag} (ID: ${c.user.id})`);
  c.user.setActivity('o quadro Trello 📋', { type: ActivityType.Watching });
});

// ── Event: interactionCreate ──────────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'trello') return;

  try {
    await trelloCommand.execute(interaction, trello);
  } catch (err) {
    console.error('Unhandled error in trello command:', err);
    const msg = '❌ Ocorreu um erro inesperado. Tente novamente mais tarde.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, ephemeral: true });
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

client.login(process.env.DISCORD_TOKEN);
