/**
 * src/deploy-commands.js
 *
 * One-time script to register slash commands with the Discord API.
 *
 * Usage:
 *   node src/deploy-commands.js
 *
 * Set DISCORD_GUILD_ID in .env for guild-scoped (instant) deployment,
 * or leave it unset for global deployment (can take up to 1 hour).
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { data } = require('./commands/trello');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) throw new Error('Missing DISCORD_TOKEN in environment');
if (!clientId) throw new Error('Missing DISCORD_CLIENT_ID in environment');

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  const commands = [data.toJSON()];

  if (guildId) {
    const result = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
    console.log(`✅ Registered ${result.length} command(s) in guild ${guildId}`);
  } else {
    const result = await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`✅ Registered ${result.length} global command(s)`);
  }
})();
