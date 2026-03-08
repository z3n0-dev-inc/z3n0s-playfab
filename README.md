# ZTD Discord Bot

## Two things to fill in before starting

Open `.env` and add:

**1. `MOD_ROLE_ID`**
Discord → Server Settings → Roles → right-click your Moderator role → Copy Role ID

**2. `DISCORD_WEBHOOK_URL`** (for staff reports from in-game)
Go to your staff channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL

Everything else (token, PlayFab keys, channel ID) is already filled in.

---

## Setup on Chromebook

```bash
# Install Node if needed
sudo apt update && sudo apt install -y nodejs npm

# Install dependencies
npm install

# Register slash commands with Discord (run once)
node deploy-commands.js

# Start the bot
node bot.js
```

To keep it running after closing the terminal:
```bash
npm install -g pm2
pm2 start bot.js --name ztd-bot
pm2 save
```

---

## Commands

`/link username:YourName` — Links your Discord to your ZTD account

`/playerinfo` — Shows your own stats (must link first)

`/playerinfo discord_member:@someone` — [Mods] Look up by Discord mention

`/playerinfo playfab_username:name` — [Mods] Look up by ZTD username

`/playerinfo playfab_id:XXXXXXXXXXXXXXXX` — [Mods] Look up by PlayFab ID

When a mod uses `/playerinfo` to look up another player, the result is also posted to the staff channel automatically.
