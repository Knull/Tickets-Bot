import prisma from './database.js';
import { ACTIVE_TICKET_STATUSES, MAX_OPEN_TICKETS_PER_USER } from './ticketPolicy.js';

const userCreationLocks = new Map<string, Promise<void>>();

export class TicketCreationBlockedError extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage);
    this.name = 'TicketCreationBlockedError';
  }
}

export async function getTicketCreationBlockReason(userId: string, now = new Date()): Promise<string | null> {
  const [blacklist, activeTicketCount] = await Promise.all([
    prisma.ticketBlacklist.findUnique({ where: { userId } }),
    prisma.ticket.count({
      where: { userId, status: { in: [...ACTIVE_TICKET_STATUSES] } },
    }),
  ]);

  if (blacklist) {
    if (blacklist.expiresAt && blacklist.expiresAt <= now) {
      await prisma.ticketBlacklist.deleteMany({ where: { id: blacklist.id } });
    } else {
      return 'You are blacklisted from opening tickets.';
    }
  }

  if (activeTicketCount >= MAX_OPEN_TICKETS_PER_USER) {
    return `You already have ${MAX_OPEN_TICKETS_PER_USER} active tickets. Please continue in an existing ticket.`;
  }

  return null;
}

export async function withTicketCreationGuard<T>(userId: string, create: () => Promise<T>): Promise<T> {
  const previous = userCreationLocks.get(userId) ?? Promise.resolve();
  let release = (): void => undefined;
  const current = new Promise<void>(resolve => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  userCreationLocks.set(userId, tail);

  await previous;
  try {
    const blockReason = await getTicketCreationBlockReason(userId);
    if (blockReason) throw new TicketCreationBlockedError(blockReason);
    return await create();
  } finally {
    release();
    if (userCreationLocks.get(userId) === tail) {
      userCreationLocks.delete(userId);
    }
  }
}
