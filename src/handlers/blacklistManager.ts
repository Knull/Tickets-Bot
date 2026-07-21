import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import prisma from '../utils/database.js';

export function startBlacklistManager(): ScheduledTask {
  return cron.schedule('*/5 * * * *', async () => {
    try {
      await prisma.ticketBlacklist.deleteMany({
        where: { expiresAt: { not: null, lte: new Date() } },
      });
    } catch (error) {
      console.error('Blacklist expiry sweep failed:', error);
    }
  }, { name: 'blacklist-expiry', noOverlap: true });
}
