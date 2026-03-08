// embeds.js
const { EmbedBuilder } = require('discord.js');

// ── Colours ───────────────────────────────────────────────────────
const C = {
  red:    0xed4245,
  green:  0x57f287,
  yellow: 0xfee75c,
  grey:   0x36393f,
  white:  0xffffff,
  blurple:0x5865f2,
};

// ── Profile embed (player info) ───────────────────────────────────
// Layout: a short description block, then a few clean fields.
// Deliberately NOT using emoji on every single field name.
function profileEmbed(p, isModerator = false) {
  const isBanned = (p.activeBans || []).length > 0;
  const role     = p.isOwner ? 'Owner' : p.isMod ? 'Moderator' : 'Player';

  // Build a clean stat line for the description
  const joinedTs  = p.created   ? `<t:${ts(p.created)}:D>`   : 'unknown';
  const seenTs    = p.lastLogin ? `<t:${ts(p.lastLogin)}:R>` : 'never';

  const desc = [
    `**${p.displayName}**  ·  \`${p.playFabId}\``,
    `${roleTag(role)}  joined ${joinedTs}  ·  last seen ${seenTs}`,
  ].join('\n');

  const e = new EmbedBuilder()
    .setColor(isBanned ? C.red : C.grey)
    .setDescription(desc)
    .addFields(
      {
        name: 'Stats',
        value: [
          `Wave **${p.bestWave}**  ·  Kills **${p.totalKills}**  ·  XP **${p.accountXP}**  ·  Coins **${p.coins}**`,
        ].join('\n'),
        inline: false,
      },
    );

  // Towers — only if they have any
  if (p.ownedTowers && p.ownedTowers.length > 0) {
    const list  = p.ownedTowers.slice(0, 20).join(', ');
    const extra = p.ownedTowers.length > 20 ? ` (+${p.ownedTowers.length - 20} more)` : '';
    e.addFields({ name: `Towers  (${p.ownedTowers.length})`, value: list + extra, inline: false });
  }

  // Special items (cosmetics, panels etc)
  const specialItems = (p.inventory || []).filter(i =>
    i.includes('panel') || i.includes('cosmetic') || i.includes('owner') || i.includes('mod')
  );
  if (specialItems.length) {
    e.addFields({ name: 'Special items', value: specialItems.join(', '), inline: false });
  }

  // Bans — only show if moderator looking up
  if (isModerator) {
    if (isBanned) {
      const banLines = p.activeBans.map(b => {
        const exp = b.Expires ? `expires <t:${ts(b.Expires)}:R>` : '**permanent**';
        return `${b.Reason || 'no reason'}  ·  ${exp}`;
      });
      e.addFields({ name: 'Active ban', value: banLines.join('\n'), inline: false });
    }

    if (p.warnings && p.warnings.length) {
      const warnLines = p.warnings.slice(0, 5).map(w =>
        `${w.reason}  ·  <t:${ts(w.date)}:D>`
      );
      if (p.warnings.length > 5) warnLines.push(`+${p.warnings.length - 5} more`);
      e.addFields({ name: `Warnings  (${p.warnings.length})`, value: warnLines.join('\n'), inline: false });
    }
  }

  e.setFooter({ text: 'ZTD' }).setTimestamp();
  return e;
}

// ── Staff report embed (sent to channel by mod) ───────────────────
function reportEmbed(p, staffTag) {
  return profileEmbed(p, true)
    .setColor(p.activeBans.length ? C.red : C.blurple)
    .setFooter({ text: `reported by ${staffTag}  ·  ZTD` });
}

// ── Link success ──────────────────────────────────────────────────
function linkEmbed(displayName, playFabId) {
  return new EmbedBuilder()
    .setColor(C.green)
    .setDescription(`Linked to **${displayName}**\n\`${playFabId}\`\n\nUse \`/playerinfo\` to view your stats.`);
}

// ── Error ─────────────────────────────────────────────────────────
function err(msg) {
  return new EmbedBuilder().setColor(C.red).setDescription(msg);
}

// ── Helpers ───────────────────────────────────────────────────────
function ts(dateStr) {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

function roleTag(role) {
  if (role === 'Owner')     return '`owner`';
  if (role === 'Moderator') return '`mod`';
  return '`player`';
}

module.exports = { profileEmbed, reportEmbed, linkEmbed, err };
