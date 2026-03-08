// playfab.js — PlayFab Server/Admin API helper
require('dotenv').config();
const fetch = require('node-fetch');

const TITLE_ID   = process.env.PLAYFAB_TITLE_ID;
const SECRET_KEY = process.env.PLAYFAB_SECRET_KEY;
const BASE       = `https://${TITLE_ID}.playfabapi.com`;

async function pfServer(endpoint, body) {
  try {
    const res  = await fetch(BASE + endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-SecretKey': SECRET_KEY },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    if (json.code !== 200) console.error(`[PlayFab] ${endpoint} → ${json.errorMessage || json.code}`);
    return { ok: json.code === 200, data: json.data, msg: json.errorMessage || '' };
  } catch (e) {
    console.error(`[PlayFab] ${endpoint} failed:`, e.message);
    return { ok: false, data: null, msg: e.message };
  }
}

// Resolve username OR 16-char PlayFab ID
async function resolveId(nameOrId) {
  if (!nameOrId) return { ok: false, msg: 'No player specified' };
  const v = nameOrId.trim();
  if (/^[0-9A-Fa-f]{16}$/.test(v)) return { ok: true, playFabId: v };
  const r = await pfServer('/Server/GetUserAccountInfo', { Username: v });
  if (r.ok && r.data?.UserInfo?.PlayFabId)
    return { ok: true, playFabId: r.data.UserInfo.PlayFabId };
  return { ok: false, msg: `Player "${v}" not found. Username is case-sensitive.` };
}

// Look up by username (for /link command)
async function getAccountByUsername(username) {
  const r = await pfServer('/Server/GetUserAccountInfo', { Username: username.trim() });
  if (!r.ok) return { ok: false, msg: r.msg || 'Username not found in ZTD' };
  const info = r.data?.UserInfo;
  if (!info?.PlayFabId) return { ok: false, msg: 'Username not found' };
  return {
    ok:          true,
    playFabId:   info.PlayFabId,
    displayName: info.TitleInfo?.DisplayName || info.Username || username,
    username:    info.Username || username,
  };
}

// Full player profile for /playerinfo
async function getPlayerProfile(pfId) {
  const [profileRes, statsRes, banRes, invRes, dataRes] = await Promise.all([
    pfServer('/Server/GetUserAccountInfo',  { PlayFabId: pfId }),
    pfServer('/Server/GetPlayerStatistics', { PlayFabId: pfId }),
    pfServer('/Server/GetUserBans',         { PlayFabId: pfId }),
    pfServer('/Server/GetUserInventory',    { PlayFabId: pfId }),
    pfServer('/Server/GetUserData', { PlayFabId: pfId, Keys: ['Warnings','OwnedTowers','Coins','BestWave','TotalKills','AccountXP','IsOwner','IsMod'] }),
  ]);

  const profile    = profileRes.data?.UserInfo || {};
  const stats      = {};
  (statsRes.data?.Statistics || []).forEach(s => { stats[s.StatisticName] = s.Value; });
  const now        = Date.now();
  const allBans    = banRes.data?.BanData || [];
  const activeBans = allBans.filter(b => b.Active && (!b.Expires || new Date(b.Expires).getTime() > now));
  const inventory  = (invRes.data?.Inventory || []).map(i => i.ItemId);
  const ud         = dataRes.data?.Data || {};
  const safeJson   = (val, fb) => { try { return JSON.parse(val || JSON.stringify(fb)); } catch { return fb; } };

  return {
    playFabId:   pfId,
    displayName: profile.TitleInfo?.DisplayName || profile.Username || pfId,
    username:    profile.Username || pfId,
    created:     profile.TitleInfo?.Created  || null,
    lastLogin:   profile.TitleInfo?.LastLogin || null,
    stats,
    coins:       ud.Coins?.Value      || '0',
    bestWave:    ud.BestWave?.Value   || '0',
    totalKills:  ud.TotalKills?.Value || '0',
    accountXP:   ud.AccountXP?.Value  || '0',
    ownedTowers: safeJson(ud.OwnedTowers?.Value, []),
    inventory,
    activeBans,
    allBans,
    warnings:    safeJson(ud.Warnings?.Value, []),
    isOwner: ud.IsOwner?.Value === 'true' || inventory.includes('owner_panel'),
    isMod:   ud.IsMod?.Value   === 'true' || inventory.includes('mod_panel'),
  };
}

// Discord ↔ PlayFab link storage (stored in PlayFab Title Internal Data)
async function _readLinks() {
  const r = await pfServer('/Server/GetTitleInternalData', { Keys: ['DiscordLinks'] });
  try { return JSON.parse(r.data?.Data?.DiscordLinks?.Value || '{}'); } catch { return {}; }
}

async function _writeLinks(map) {
  const r = await pfServer('/Admin/SetTitleInternalData', { TitleData: { DiscordLinks: JSON.stringify(map) } });
  return r.ok;
}

async function linkAccount(discordId, playFabId, displayName) {
  const map = await _readLinks();
  map[discordId] = { playFabId, displayName, linkedAt: new Date().toISOString() };
  return _writeLinks(map);
}

async function getLinkedAccount(discordId) {
  const map = await _readLinks();
  return map[discordId] || null;
}

async function getAllLinks() {
  return _readLinks();
}

module.exports = { pfServer, resolveId, getAccountByUsername, getPlayerProfile, linkAccount, getLinkedAccount, getAllLinks };
