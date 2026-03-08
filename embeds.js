// embeds.js
const { EmbedBuilder } = require('discord.js');

const C = { red: 0xed4245, green: 0x57f287, yellow: 0xfee75c, grey: 0x2b2d31, blurple: 0x5865f2 };

function ts(dateStr) { return Math.floor(new Date(dateStr).getTime() / 1000); }
function roleTag(p) {
  if (p.isOwner) return '`owner`';
  if (p.isMod)   return '`mod`';
  return '`player`';
}

function profileEmbed(p, isMod = false) {
  const isBanned   = (p.activeBans || []).length > 0;
  const joinedTs   = p.created   ? `<t:${ts(p.created)}:D>`   : 'unknown';
  const seenTs     = p.lastLogin ? `<t:${ts(p.lastLogin)}:R>` : 'never';

  const e = new EmbedBuilder()
    .setColor(isBanned ? C.red : C.grey)
    .setDescription(`**${p.displayName}**  ·  \`${p.playFabId}\`\n${roleTag(p)}  joined ${joinedTs}  ·  last seen ${seenTs}`)
    .addFields({ name: 'Stats', value: `Wave **${p.bestWave}**  ·  Kills **${p.totalKills}**  ·  XP **${p.accountXP}**  ·  Coins **${p.coins}**`, inline: false });

  if (p.ownedTowers?.length) {
    const list = p.ownedTowers.slice(0, 20).join(', ');
    e.addFields({ name: `Towers (${p.ownedTowers.length})`, value: list + (p.ownedTowers.length > 20 ? ` +${p.ownedTowers.length - 20} more` : ''), inline: false });
  }

  const special = (p.inventory || []).filter(i => i.includes('panel') || i.includes('cosmetic'));
  if (special.length) e.addFields({ name: 'Special items', value: special.join(', '), inline: false });

  if (isMod) {
    if (isBanned) {
      const banLines = p.activeBans.map(b => {
        const exp = b.Expires ? `expires <t:${ts(b.Expires)}:R>` : '**permanent**';
        return `${b.Reason || 'no reason'}  ·  ${exp}`;
      });
      e.addFields({ name: 'Active ban', value: banLines.join('\n'), inline: false });
    }
    if (p.warnings?.length) {
      const warnLines = p.warnings.slice(0, 5).map(w => `${w.reason}  ·  <t:${ts(w.date)}:D>`);
      if (p.warnings.length > 5) warnLines.push(`+${p.warnings.length - 5} more`);
      e.addFields({ name: `Warnings (${p.warnings.length})`, value: warnLines.join('\n'), inline: false });
    }
  }

  e.setFooter({ text: 'ZTD' }).setTimestamp();
  return e;
}

function reportEmbed(p, staffTag) {
  return profileEmbed(p, true)
    .setColor((p.activeBans?.length) ? C.red : C.blurple)
    .setFooter({ text: `reported by ${staffTag}  ·  ZTD` });
}

function linkEmbed(displayName, playFabId) {
  return new EmbedBuilder()
    .setColor(C.green)
    .setDescription(`Linked to **${displayName}**\n\`${playFabId}\`\n\nUse \`/playerinfo\` to view your stats.`);
}

function err(msg) {
  return new EmbedBuilder().setColor(C.red).setDescription(msg);
}

module.exports = { profileEmbed, reportEmbed, linkEmbed, err };
