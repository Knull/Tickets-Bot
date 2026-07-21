import prisma from './database.js';

export async function reserveTicketNumber(): Promise<number> {
  const settings = await prisma.ticketSettings.upsert({
    where: { id: 1 },
    update: { ticketCounter: { increment: 1 } },
    create: { id: 1, ticketCounter: 2 },
    select: { ticketCounter: true },
  });

  return settings.ticketCounter - 1;
}
