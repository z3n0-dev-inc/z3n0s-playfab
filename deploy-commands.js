// deploy-commands.js — Run ONCE to register slash commands with Discord
// Usage: node deploy-commands.js
require('dotenv').config();

const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const token   = process.env.DISCORD_BOT_TOKEN;
const appId   = process.env.DISCORD_APP_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !appId || !guildId) {
  console.error('Missing DISCORD_BOT_TOKEN, DISCORD_APP_ID, or DISCORD_GUILD_ID in .env');
  process.exit(1);
}

const commands = [
  {
    name: 'link',
    description: 'Link your Discord account to your ZTD account',
    options: [
      {
        name: 'username',
        description: 'Your exact ZTD username (case-sensitive)',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  {
    name: 'playerinfo',
    description: 'View your ZTD player stats',
    options: [
      {
        name: 'discord_member',
        description: '[Mods] View a linked Discord member\'s account',
        type: ApplicationCommandOptionType.User,
        required: false,
      },
      {
        name: 'playfab_username',
        description: '[Mods] Look up by ZTD username',
        type: ApplicationCommandOptionType.String,
        required: false,
      },
      {
        name: 'playfab_id',
        description: '[Mods] Look up by PlayFab ID',
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Registering commands…');
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
    console.log('Done. Commands will appear in Discord within a few seconds.');
  } catch (e) {
    console.error('Failed:', e.message);
  }
})();
