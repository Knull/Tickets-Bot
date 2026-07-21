# Tickets Bot

A Discord.js ticket bot for the PikaNetwork Ranked Bedwars community. It supports channel- and private-thread-based tickets, configurable permissions and instructions, appeals, partnership validation, blacklists, inactivity handling, and HTML transcript exports backed by PostgreSQL and Prisma.

## Requirements

- Node.js 24.17 or newer
- npm 11 or newer
- PostgreSQL
- Python 3.10 or newer for transcript exports
- A Discord bot with access to the configured guild and channels

## Security notice

Older revisions of this repository contained a Discord token and a database environment file. Removing them from the current tree does not invalidate credentials already present in Git history. Rotate both credentials before deploying this version.

Never commit `.env`, generated clients, `dist`, `node_modules`, or transcript files. They are ignored by Git.

## Setup

1. Create local configuration:

   ```bash
   cp .env.example .env
   ```

   Set `DISCORD_TOKEN` to a newly rotated token and set `DATABASE_URL`. Existing server IDs remain the defaults in `src/config/config.ts`; every ID can also be overridden through environment variables.

2. Install Node and Python dependencies:

   ```bash
   npm ci
   python -m venv .venv
   . .venv/bin/activate
   python -m pip install -r requirements.txt
   ```

   On Windows, activate the environment with `.venv\Scripts\activate` and set `PYTHON_EXECUTABLE=python` if needed.

3. Apply the database migrations.

   For a new database:

   ```bash
   npm run prisma:generate
   npx prisma migrate deploy
   ```

   For a database that already existed before these migrations were added, back it up, mark only the historical baseline as applied, then deploy the reliability migration:

   ```bash
   npx prisma migrate resolve --applied 20260721000000_baseline
   npx prisma migrate deploy
   ```

4. Build and start:

   ```bash
   npm run build
   npm start
   ```

For development, use `npm run dev`.

## Verification

Run the same checks as CI:

```bash
npm run check
npm run build
npm run audit:production
python -m compileall -q src/transcripts
```

## Configuration

The two required environment variables are:

- `DISCORD_TOKEN`
- `DATABASE_URL`

Optional overrides are documented in `.env.example`. `CONFIGURABLE_ROLE_IDS` accepts a comma-separated list of Discord role IDs. Ticket mode and the thread role-ping preference are persisted in `TicketSettings`, so they survive restarts.

## Transcript exporter

The bot runs `src/transcripts/script.py` through an argument-safe child process and supplies the token through the child environment. To run it manually:

```bash
export DISCORD_TOKEN=your-rotated-token
python src/transcripts/script.py \
  --channel_id 1234567890 \
  --start 111111111111111111 \
  --end 222222222222222222 \
  --output_file transcript.html
```

## Maintenance

GitHub Actions builds, type-checks, tests, validates the Prisma schema, checks production dependencies, and compiles the Python exporter on every pull request. Dependabot checks npm, Python, and GitHub Actions dependencies weekly.
