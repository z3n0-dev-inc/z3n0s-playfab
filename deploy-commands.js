require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const token   = process.env.DISCORD_BOT_TOKEN;
const appId   = process.env.DISCORD_APP_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !appId || !guildId) { console.error('Missing env vars'); process.exit(1); }

const commands = [
  {
    name: 'link',
    description: 'Link your Discord account to your ZTD in-game account',
    options: [{
      name: 'username',
      description: 'Your exact ZTD username (case-sensitive)',
      type: ApplicationCommandOptionType.String,
      required: true,
    }],
  },
  {
    name: 'playerinfo',
    description: 'View your ZTD player stats (mods can look up other players)',
    options: [
      { name: 'discord_member', description: '[Mods] Look up a linked Discord member', type: ApplicationCommandOptionType.User, required: false },
      { name: 'playfab_username', description: '[Mods] Look up by ZTD username', type: ApplicationCommandOptionType.String, required: false },
      { name: 'playfab_id', description: '[Mods] Look up by PlayFab ID', type: ApplicationCommandOptionType.String, required: false },
    ],
  },
  {
    name: 'grant',
    description: '[Owner] Grant a PlayFab item to a player',
    options: [
      { name: 'player', description: 'ZTD username or PlayFab ID', type: ApplicationCommandOptionType.String, required: true },
      {
        name: 'item',
        description: 'Item to grant',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: '🛡 Moderator Panel',       value: 'mod_panel' },
          { name: '👑 Owner Panel',           value: 'owner_panel' },
          { name: '⚙️ Dev Panel',             value: 'dev_panel' },
          { name: '🦇 Shadow Commander',      value: 'cosmetic_shadow_commander' },
          { name: '🌟 Neon Warden',           value: 'cosmetic_neon_warden' },
          { name: '🕳 Void Hunter',           value: 'cosmetic_void_hunter' },
          { name: '👑 Celestial Overlord',    value: 'cosmetic_celestial_overlord' },
          { name: '🗼 All Owner Towers',      value: 'Owner_towers' },
          { name: '🥇 Gold Survivor Badge',   value: 'cosmetic_gold_badge' },
          { name: '🎖 Veteran Badge',         value: 'cosmetic_veteran_badge' },
        ],
      },
    ],
  },
  {
    name: 'revoke',
    description: '[Owner] Revoke a PlayFab item from a player',
    options: [
      { name: 'player', description: 'ZTD username or PlayFab ID', type: ApplicationCommandOptionType.String, required: true },
      {
        name: 'item',
        description: 'Item to revoke',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: '🛡 Moderator Panel',       value: 'mod_panel' },
          { name: '👑 Owner Panel',           value: 'owner_panel' },
          { name: '⚙️ Dev Panel',             value: 'dev_panel' },
          { name: '🦇 Shadow Commander',      value: 'cosmetic_shadow_commander' },
          { name: '🌟 Neon Warden',           value: 'cosmetic_neon_warden' },
          { name: '🕳 Void Hunter',           value: 'cosmetic_void_hunter' },
          { name: '👑 Celestial Overlord',    value: 'cosmetic_celestial_overlord' },
          { name: '🥇 Gold Survivor Badge',   value: 'cosmetic_gold_badge' },
          { name: '🎖 Veteran Badge',         value: 'cosmetic_veteran_badge' },
        ],
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
    console.log('Done! Commands will appear in Discord within a few seconds.');
  } catch (e) {
    console.error('Failed:', e.message);
  }
})();
