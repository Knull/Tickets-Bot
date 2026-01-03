# Tickets Bot

A  Discord bot that manages tickets for the PikaNetwork Ranked Bedwars community. The bot uses Discord.js v14 with a Prisma-backed PostgreSQL database to provide a customizable ticket workflow for appeals, general support, store issues and partnership requests.

## Features
- Slash commands and interaction handlers for creating and managing tickets
- PostgreSQL data models for tickets, configurations, player profiles and blacklists
- Scheduled jobs to auto-close inactive tickets and expire blacklist entries
- Configuration command (`/ticket-config`) to define instructions or permission presets per ticket type
- Support for both channel-based and thread-based ticket modes
- Transcript export script (`src/transcripts/script.py`) powered by [chat_exporter](https://github.com/Tyrrrz/DiscordChatExporter)

## Prerequisites
- Node.js (18+ recommended)
- PostgreSQL database with a `DATABASE_URL` environment variable
- Discord bot token and relevant guild/channel IDs

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure the bot in `src/config/config.ts` and set `DATABASE_URL` in your environment or `.env`.
3. Generate the Prisma client and apply the schema:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```
4. Build the TypeScript sources and start the bot:
   ```bash
   npm run build
   npm start
   ```

For development you can run `ts-node` or `nodemon` on `src/index.ts`.

## Transcript script
Export a portion of a ticket channel to HTML using:
```bash
python src/transcripts/script.py --token TOKEN --channel_id 1234567890 \
    --start 111111111111111111 --end 222222222222222222 --output_file transcript.html
```
