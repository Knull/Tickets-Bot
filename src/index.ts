import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import type { CommandModule, ExtendedClient } from './types/ExtendedClient.js';
import config from './config/config.js';
import prisma from './utils/database.js';
import { setupTicketSystem } from './handlers/ticketHandlers.js';
import { startAutoCloseManager } from './handlers/autoCloseManager.js';
import { startBlacklistManager } from './handlers/blacklistManager.js';
import { registerInteractions } from './interactions/interactionCreate.js';
import { registerCommands } from './commands/commandHandler.js';
import { populateTicketConfigs } from './utils/populateTicketConfigs.js';
import { initializeTicketMode } from './utils/ticketModeSettings.js';
import { AUTO_CLOSEABLE_TICKET_STATUSES } from './utils/ticketPolicy.js';
import type { ScheduledTask } from 'node-cron';

export const client: ExtendedClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
}) as ExtendedClient;

client.commands = new Collection<string, CommandModule>();
const scheduledTasks: ScheduledTask[] = [];

async function initialize(): Promise<void> {
  await prisma.$connect();
  await prisma.ticket.findFirst({ select: { id: true } });
  await initializeTicketMode();
  await populateTicketConfigs();
  await registerCommands(client);
  await setupTicketSystem(client);
  scheduledTasks.push(startAutoCloseManager(client), startBlacklistManager());
  console.info(`Ready as ${client.user?.tag}.`);
}

client.once(Events.ClientReady, () => {
  void initialize().catch(error => {
    console.error('Bot initialization failed:', error);
    void shutdown(1);
  });
});

client.on(Events.InteractionCreate, interaction => {
  void registerInteractions(client, interaction);
});

client.on(Events.MessageCreate, message => {
  if (message.author.bot) return;

  void prisma.ticket.updateMany({
    where: {
      channelId: message.channel.id,
      userId: message.author.id,
      status: { in: [...AUTO_CLOSEABLE_TICKET_STATUSES] },
    },
    data: { lastMessageAt: new Date() },
  }).catch(error => {
    console.error('Failed to update ticket activity:', error);
  });
});

let shuttingDown = false;
async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  client.destroy();
  await Promise.all(scheduledTasks.splice(0).map(task => task.destroy())).catch(error => {
    console.error('Failed to stop scheduled tasks cleanly:', error);
  });
  await prisma.$disconnect().catch(error => {
    console.error('Failed to disconnect Prisma cleanly:', error);
  });
  process.exitCode = exitCode;
}

process.once('SIGINT', () => void shutdown(0));
process.once('SIGTERM', () => void shutdown(0));
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
  void shutdown(1);
});
process.once('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  void shutdown(1);
});

void client.login(config.token).catch(error => {
  console.error('Discord login failed:', error);
  void shutdown(1);
});
