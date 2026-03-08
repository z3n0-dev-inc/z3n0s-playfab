require('dotenv').config();

const { Client, GatewayIntentBits, Events } = require('discord.js');
const PF     = require('./playfab');
const embeds = require('./embeds');

const STAFF_CHANNEL = process.env.DISCORD_STAFF_CHANNEL;
const MOD_ROLE_ID   = process.env.MOD_ROLE_ID;

// ── Startup checks ────────────────────────────────────────────────
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('[Bot] DISCORD_BOT_TOKEN not set in .env — exiting');
  process.exit(1);
}
if (!process.env.PLAYFAB_TITLE_ID || !process.env.PLAYFAB_SECRET_KEY) {
  console.error('[Bot] PLAYFAB_TITLE_ID or PLAYFAB_SECRET_KEY not set in .env — exiting');
  process.exit(1);
}
if (!MOD_ROLE_ID) {
  console.warn('[Bot] MOD_ROLE_ID not set — moderator commands will be disabled');
}
if (!STAFF_CHANNEL) {
  console.warn('[Bot] DISCORD_STAFF_CHANNEL not set — staff lookups won\'t post to channel');
}

// ── Profile cache — avoids hammering PlayFab on every command ─────
const _cache  = new Map();
const CACHE_S = 60_000; // 60 seconds

async function getCached(playFabId) {
  const hit = _cache.get(playFabId);
  if (hit && Date.now() - hit.ts < CACHE_S) return hit.profile;
  const profile = await PF.getPlayerProfile(playFabId);
  _cache.set(playFabId, { profile, ts: Date.now() });
  return profile;
}

// ── Mod check ─────────────────────────────────────────────────────
function isMod(member) {
  if (!member || !MOD_ROLE_ID) return false;
  return member.roles.cache.has(MOD_ROLE_ID);
}

// ── Client ────────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, async () => {
  console.log(`\n[Bot] Logged in as ${client.user.tag}`);
  console.log(`[Bot] Guild:         ${process.env.DISCORD_GUILD_ID}`);
  console.log(`[Bot] Staff channel: ${STAFF_CHANNEL || 'not set'}`);
  console.log(`[Bot] Mod role:      ${MOD_ROLE_ID   || 'not set'}`);

  // Quick PlayFab connectivity test
  const test = await PF.pfServer('/Server/GetTitleData', { Keys: ['_test'] });
  if (test.ok || test.msg === '') {
    console.log('[Bot] PlayFab connection: ✅ OK');
  } else {
    console.warn('[Bot] PlayFab connection: ⚠️ ', test.msg || 'check PLAYFAB_SECRET_KEY');
  }

  client.user.setActivity('Zombie Tower Defence', { type: 0 });
  console.log('[Bot] Ready.\n');
});

// ── Commands ──────────────────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // ════════════════════════════════════════════════════════════════
  // /link — link Discord account to ZTD PlayFab username
  // ════════════════════════════════════════════════════════════════
  if (interaction.commandName === 'link') {
    await interaction.deferReply({ ephemeral: true });
    const username = interaction.options.getString('username');

    const result = await PF.getAccountByUsername(username);
    if (!result.ok) {
      return interaction.editReply({
        embeds: [embeds.err(
          `Couldn't find **${username}** in ZTD.\n` +
          `Make sure you type your exact in-game username — it's case-sensitive.`
        )],
      });
    }

    const saved = await PF.linkAccount(interaction.user.id, result.playFabId, result.displayName);
    if (!saved) {
      return interaction.editReply({
        embeds: [embeds.err('Failed to save the link. Please try again in a moment.')],
      });
    }

    return interaction.editReply({
      embeds: [embeds.linkEmbed(result.displayName, result.playFabId)],
    });
  }

  // ════════════════════════════════════════════════════════════════
  // /playerinfo — view player stats
  // ════════════════════════════════════════════════════════════════
  if (interaction.commandName === 'playerinfo') {
    await interaction.deferReply({ ephemeral: true });

    const targetUser     = interaction.options.getUser('discord_member');
    const targetUsername = interaction.options.getString('playfab_username');
    const targetId       = interaction.options.getString('playfab_id');
    const modLookup      = targetUser || targetUsername || targetId;

    // ── Non-mod trying to look up someone else ────────────────────
    if (modLookup && !isMod(interaction.member)) {
      return interaction.editReply({
        embeds: [embeds.err("You don't have permission to look up other players.")],
      });
    }

    // ── Self-lookup ───────────────────────────────────────────────
    if (!modLookup) {
      const linked = await PF.getLinkedAccount(interaction.user.id);
      if (!linked) {
        return interaction.editReply({
          embeds: [embeds.err(
            "Your Discord account isn't linked to ZTD yet.\n" +
            "Run `/link` with your in-game username first."
          )],
        });
      }
      try {
        const profile = await getCached(linked.playFabId);
        return interaction.editReply({ embeds: [embeds.profileEmbed(profile, false)] });
      } catch (e) {
        console.error('[playerinfo self]', e);
        return interaction.editReply({ embeds: [embeds.err(`Couldn't load profile: ${e.message}`)] });
      }
    }

    // ── Mod lookup ────────────────────────────────────────────────
    let playFabId = null;

    if (targetUser) {
      const links = await PF.getAllLinks();
      const link  = links[targetUser.id];
      if (!link) {
        return interaction.editReply({
          embeds: [embeds.err(
            `<@${targetUser.id}> hasn't linked their ZTD account yet.\n` +
            `Try searching by PlayFab username or ID instead.`
          )],
        });
      }
      playFabId = link.playFabId;
    } else {
      const resolved = await PF.resolveId(targetId || targetUsername);
      if (!resolved.ok) {
        return interaction.editReply({ embeds: [embeds.err(resolved.msg)] });
      }
      playFabId = resolved.playFabId;
    }

    try {
      const profile = await getCached(playFabId);
      const embed   = embeds.reportEmbed(profile, interaction.user.tag);

      // Post to staff channel
      if (STAFF_CHANNEL) {
        const ch = client.channels.cache.get(STAFF_CHANNEL);
        if (ch) {
          ch.send({ embeds: [embed] }).catch(e =>
            console.error('[Bot] Failed to post to staff channel:', e.message)
          );
        }
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error('[playerinfo mod]', e);
      return interaction.editReply({ embeds: [embeds.err(`Couldn't load profile: ${e.message}`)] });
    }
  }
});

client.on('error', e => console.error('[Discord error]', e));
process.on('unhandledRejection', e => console.error('[Unhandled]', e));

client.login(token);
