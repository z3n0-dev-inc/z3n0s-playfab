require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const http   = require('http');
const PF     = require('./playfab');
const embeds = require('./embeds');

const STAFF_CHANNEL  = process.env.DISCORD_STAFF_CHANNEL;
const MOD_ROLE_ID    = process.env.MOD_ROLE_ID;
const BOT_HTTP_PORT  = process.env.BOT_HTTP_PORT || 3001;
const BOT_SECRET     = process.env.BOT_SECRET    || 'ztd-internal';

if (!process.env.DISCORD_BOT_TOKEN)                           { console.error('[Bot] DISCORD_BOT_TOKEN not set'); process.exit(1); }
if (!process.env.PLAYFAB_TITLE_ID || !process.env.PLAYFAB_SECRET_KEY) { console.error('[Bot] PlayFab keys not set'); process.exit(1); }

const _cache  = new Map();
const CACHE_S = 60_000;

async function getCached(playFabId) {
  const hit = _cache.get(playFabId);
  if (hit && Date.now() - hit.ts < CACHE_S) return hit.profile;
  const profile = await PF.getPlayerProfile(playFabId);
  _cache.set(playFabId, { profile, ts: Date.now() });
  return profile;
}

function isMod(member) {
  if (!member || !MOD_ROLE_ID) return false;
  return member.roles.cache.has(MOD_ROLE_ID);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once(Events.ClientReady, async () => {
  console.log(`\n[Bot] Logged in as ${client.user.tag}`);
  console.log(`[Bot] Staff channel: ${STAFF_CHANNEL || 'not set'}`);
  console.log(`[Bot] Mod role:      ${MOD_ROLE_ID   || 'not set'}`);
  const test = await PF.pfServer('/Server/GetTitleData', { Keys: ['_test'] });
  console.log(`[Bot] PlayFab:       ${test.ok ? 'connected' : 'ERROR: ' + test.msg}`);
  client.user.setActivity('Zombie Tower Defence', { type: 0 });
  console.log('[Bot] Ready.\n');
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // /link
  if (interaction.commandName === 'link') {
    await interaction.deferReply({ ephemeral: true });
    const username = interaction.options.getString('username').trim();

    let result = await PF.getAccountByUsername(username);

    // Fallback: accept raw PlayFab ID
    if (!result.ok && /^[0-9A-Fa-f]{12,16}$/i.test(username)) {
      result = { ok: true, playFabId: username, displayName: username };
    }

    if (!result.ok) {
      return interaction.editReply({ embeds: [embeds.err(
        `Couldn't find **${username}** in ZTD.

**Try these:**
• Your exact PlayFab **username** (case-sensitive)
• Your **PlayFab ID** (16-char code — use 📋 Copy ID in the in-game panel)`
      )] });
    }

    const saved = await PF.linkAccount(interaction.user.id, result.playFabId, result.displayName);
    if (!saved) {
      return interaction.editReply({ embeds: [embeds.err('Failed to save the link. Please try again.')] });
    }

    return interaction.editReply({ embeds: [embeds.linkEmbed(result.displayName, result.playFabId)] });
  }

  // /grant
  if (interaction.commandName === 'grant') {
    await interaction.deferReply({ ephemeral: true });

    if (!isMod(interaction.member)) {
      return interaction.editReply({ embeds: [embeds.err('You need the **Moderator** role to use this command.')] });
    }

    const playerInput = interaction.options.getString('player').trim();
    const itemId      = interaction.options.getString('item');

    const resolved = await PF.resolveId(playerInput);
    if (!resolved.ok) {
      return interaction.editReply({ embeds: [embeds.err(`Player not found: **${playerInput}**\nCheck the username/ID and try again.`)] });
    }

    const result = await PF.grantItem(resolved.playFabId, itemId);
    if (!result.ok) {
      return interaction.editReply({ embeds: [embeds.err(`Failed to grant **${itemId}**: ${result.msg}`)] });
    }

    const embed = {
      color: 0x57f287,
      title: 'Item Granted',
      fields: [
        { name: 'Player ID',  value: '`' + resolved.playFabId + '`', inline: true },
        { name: 'Item',       value: '`' + itemId + '`',             inline: true },
        { name: 'Granted by', value: '<@' + interaction.user.id + '>', inline: true },
      ],
      footer: { text: 'Player must re-login to see the item in-game' },
      timestamp: new Date().toISOString(),
    };

    if (STAFF_CHANNEL) {
      const ch = client.channels.cache.get(STAFF_CHANNEL);
      if (ch) ch.send({ embeds: [embed] }).catch(() => {});
    }

    return interaction.editReply({ embeds: [embed] });
  }

  // /revoke
  if (interaction.commandName === 'revoke') {
    await interaction.deferReply({ ephemeral: true });

    if (!isMod(interaction.member)) {
      return interaction.editReply({ embeds: [embeds.err('You need the **Moderator** role to use this command.')] });
    }

    const playerInput = interaction.options.getString('player').trim();
    const itemId      = interaction.options.getString('item');

    const resolved = await PF.resolveId(playerInput);
    if (!resolved.ok) {
      return interaction.editReply({ embeds: [embeds.err(`Player not found: **${playerInput}**`)] });
    }

    const result = await PF.revokeItem(resolved.playFabId, itemId);
    if (!result.ok) {
      return interaction.editReply({ embeds: [embeds.err(`Failed to revoke **${itemId}**: ${result.msg}`)] });
    }

    const embed = {
      color: 0xed4245,
      title: 'Item Revoked',
      fields: [
        { name: 'Player ID',  value: '`' + resolved.playFabId + '`', inline: true },
        { name: 'Item',       value: '`' + itemId + '`',             inline: true },
        { name: 'Revoked by', value: '<@' + interaction.user.id + '>', inline: true },
      ],
      timestamp: new Date().toISOString(),
    };

    if (STAFF_CHANNEL) {
      const ch = client.channels.cache.get(STAFF_CHANNEL);
      if (ch) ch.send({ embeds: [embed] }).catch(() => {});
    }

    return interaction.editReply({ embeds: [embed] });
  }

  // /playerinfo
  if (interaction.commandName === 'playerinfo') {
    await interaction.deferReply({ ephemeral: true });

    const targetUser     = interaction.options.getUser('discord_member');
    const targetUsername = interaction.options.getString('playfab_username');
    const targetId       = interaction.options.getString('playfab_id');
    const modLookup      = targetUser || targetUsername || targetId;

    if (modLookup && !isMod(interaction.member)) {
      return interaction.editReply({ embeds: [embeds.err("You don't have permission to look up other players.")] });
    }

    if (!modLookup) {
      const linked = await PF.getLinkedAccount(interaction.user.id);
      if (!linked) {
        return interaction.editReply({ embeds: [embeds.err(
          "Your Discord account isn't linked to ZTD yet.\nRun `/link` with your in-game username first."
        )] });
      }
      try {
        const profile = await getCached(linked.playFabId);
        return interaction.editReply({ embeds: [embeds.profileEmbed(profile, false)] });
      } catch (e) {
        return interaction.editReply({ embeds: [embeds.err(`Couldn't load profile: ${e.message}`)] });
      }
    }

    let playFabId = null;

    if (targetUser) {
      const links = await PF.getAllLinks();
      const link  = links[targetUser.id];
      if (!link) {
        return interaction.editReply({ embeds: [embeds.err(
          `<@${targetUser.id}> hasn't linked their ZTD account yet.\nTry searching by PlayFab username or ID instead.`
        )] });
      }
      playFabId = link.playFabId;
    } else {
      const resolved = await PF.resolveId(targetId || targetUsername);
      if (!resolved.ok) return interaction.editReply({ embeds: [embeds.err(resolved.msg)] });
      playFabId = resolved.playFabId;
    }

    try {
      const profile = await getCached(playFabId);
      const embed   = embeds.reportEmbed(profile, interaction.user.tag);

      if (STAFF_CHANNEL) {
        const ch = client.channels.cache.get(STAFF_CHANNEL);
        if (ch) ch.send({ embeds: [embed] }).catch(e => console.error('[Bot] Staff channel error:', e.message));
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      return interaction.editReply({ embeds: [embeds.err(`Couldn't load profile: ${e.message}`)] });
    }
  }
});

client.on('error', e => console.error('[Discord error]', e));
process.on('unhandledRejection', e => console.error('[Unhandled]', e));

// ── Internal HTTP server (receives staff report calls from game server) ──
const httpServer = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/internal/staffReport') {
    res.writeHead(404); res.end(); return;
  }

  // Auth check
  const auth = req.headers['x-bot-secret'];
  if (auth !== BOT_SECRET) {
    res.writeHead(401); res.end(JSON.stringify({ ok: false, msg: 'Unauthorized' })); return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { report, staffName } = JSON.parse(body);
      if (!report || !STAFF_CHANNEL) {
        res.writeHead(400); res.end(JSON.stringify({ ok: false, msg: 'Missing report or channel' })); return;
      }

      const ch = client.channels.cache.get(STAFF_CHANNEL);
      if (!ch) {
        res.writeHead(500); res.end(JSON.stringify({ ok: false, msg: 'Staff channel not found' })); return;
      }

      const embed = embeds.reportEmbed(report, staffName || 'in-game mod');
      await ch.send({ embeds: [embed] });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      console.error('[HTTP] staffReport error:', e.message);
      res.writeHead(500); res.end(JSON.stringify({ ok: false, msg: e.message }));
    }
  });
});

httpServer.listen(BOT_HTTP_PORT, () => {
  console.log(`[Bot] Internal HTTP server listening on port ${BOT_HTTP_PORT}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
