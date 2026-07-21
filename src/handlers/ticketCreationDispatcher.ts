// src/handlers/ticketCreationDispatcher.ts
import { getTicketMode, TicketMode } from '../utils/ticketModeSettings.js';
import { createTicketChannel } from './ticketHandlers.js';
import { createTicketThread } from './threadTicketHandlers.js';
import { withTicketCreationGuard } from '../utils/ticketCreationGuard.js';

/**
 * Creates a ticket using the current mode.
 * If the mode is THREAD_BASED, it routes to createTicketThread;
 * otherwise, it calls createTicketChannel.
 *
 * @param interaction - The interaction object triggering ticket creation.
 * @param ticketType - The type of ticket ().
 * @param data - Object with title, description (and optional banType).
 * @param shouldDefer - Whether to defer the reply.
 * @returns The created ticket channel or thread.
 */
export async function createTicket(
  interaction: any,
  ticketType: string,
  data: { title: string; description: string; banType?: string },
  shouldDefer: boolean = true
) {
  const userId = interaction.user?.id;
  if (!userId) throw new Error('Ticket creation requires an authenticated Discord user.');

  return withTicketCreationGuard(userId, async () => {
    if (getTicketMode() === TicketMode.THREAD_BASED) {
      return createTicketThread(interaction, ticketType, data, shouldDefer);
    }
    return createTicketChannel(interaction, ticketType, data, shouldDefer);
  });
}
