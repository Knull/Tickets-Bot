import prisma from './database.js';

export enum TicketMode {
  CHANNEL_BASED = 'channel',
  THREAD_BASED = 'thread',
}

let currentTicketMode = TicketMode.CHANNEL_BASED;
let pingRolesOnThread = false;

function parseMode(value: string): TicketMode {
  return value === TicketMode.THREAD_BASED ? TicketMode.THREAD_BASED : TicketMode.CHANNEL_BASED;
}

export async function initializeTicketMode(): Promise<void> {
  const settings = await prisma.ticketSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ticketCounter: 1 },
    select: { mode: true, pingRoles: true },
  });
  currentTicketMode = parseMode(settings.mode);
  pingRolesOnThread = settings.pingRoles;
}

export async function setTicketMode(mode: TicketMode, pingRoles: boolean): Promise<void> {
  await prisma.ticketSettings.upsert({
    where: { id: 1 },
    update: { mode, pingRoles },
    create: { id: 1, ticketCounter: 1, mode, pingRoles },
  });
  currentTicketMode = mode;
  pingRolesOnThread = pingRoles;
}

export function getTicketMode(): TicketMode {
  return currentTicketMode;
}

export function shouldPingRoles(): boolean {
  return pingRolesOnThread;
}

