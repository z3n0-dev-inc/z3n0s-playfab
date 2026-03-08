require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  console.log('Clearing commands...');
  await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_APP_ID, process.env.DISCORD_GUILD_ID), { body: [] });
  console.log('Cleared! Now run: node deploy-commands.js');
})();
