import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
  ThreadChannel,
} from 'discord.js';
import type { Client } from 'discord.js';
import type { Ticket } from '../generated/prisma/client.js';
import prisma from '../utils/database.js';
import { getCategoryId } from '../utils/discordUtils.js';
import {
  AUTO_CLOSEABLE_TICKET_STATUSES,
  getAutoCloseCutoffs,
} from '../utils/ticketPolicy.js';

export function startAutoCloseManager(client: Client): ScheduledTask {
  return cron.schedule('* * * * *', async () => {
    const cutoffs = getAutoCloseCutoffs(new Date());
    try {
      const tickets = await prisma.ticket.findMany({
        where: {
          status: { in: [...AUTO_CLOSEABLE_TICKET_STATUSES] },
          OR: [
            { lastMessageAt: null, createdAt: { lte: cutoffs.initial } },
            { lastMessageAt: { lte: cutoffs.active } },
          ],
        },
      });

      for (let index = 0; index < tickets.length; index += 5) {
        await Promise.all(
          tickets.slice(index, index + 5).map(ticket => processInactiveTicket(client, ticket)),
        );
      }
    } catch (error) {
      console.error('Auto-close sweep failed:', error);
    }
  }, { name: 'ticket-auto-close', noOverlap: true });
}

async function processInactiveTicket(
  client: Client,
  ticket: Ticket,
): Promise<void> {
  let lockedForClosing = false;
  try {
    const channel = await client.channels.fetch(ticket.channelId);
    if (!(channel instanceof TextChannel) && !(channel instanceof ThreadChannel)) return;

    // Use the database status as a distributed lock so multiple bot instances
    // cannot announce and close the same ticket simultaneously.
    const lock = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: { in: [...AUTO_CLOSEABLE_TICKET_STATUSES] } },
      data: { status: 'closed' },
    });
    if (lock.count === 0) return;
    lockedForClosing = true;

    const reason = ticket.lastMessageAt
      ? '24 hours without a message from the ticket creator'
      : '15 minutes without an initial message from the ticket creator';
    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    if (channel instanceof TextChannel) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId('delete_ticket_auto')
          .setLabel('Delete')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏳'),
      );
    }
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(channel instanceof ThreadChannel ? 'reopen_thread' : 'reopen_ticket')
        .setLabel('Reopen')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔓'),
    );

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xffff00)
          .setDescription(`> This ticket was closed automatically after ${reason}.`),
      ],
      components: [actionRow],
    });
    await closeTicketAuto(ticket, channel);
  } catch (error) {
    console.error(`Failed to auto-close ticket ${ticket.id}:`, error);
    if (lockedForClosing) {
      await prisma.ticket.updateMany({
        where: { id: ticket.id, status: 'closed' },
        data: { status: ticket.status },
      }).catch(rollbackError => {
        console.error(`Failed to restore ticket ${ticket.id} after auto-close error:`, rollbackError);
      });
    }
  }
}

async function closeTicketAuto(
  ticket: Ticket,
  channel: TextChannel | ThreadChannel,
): Promise<void> {
  if (channel instanceof ThreadChannel) {
    await channel.setLocked(true, 'Ticket auto-closed for inactivity.');
    if (channel.name.startsWith('🟢')) {
      await channel.setName(`🔴${channel.name.slice(2)}`);
    }
  } else {
    await channel.permissionOverwrites.delete(ticket.userId).catch(() => undefined);
    await channel.setParent(getCategoryId(ticket.ticketType, true), { lockPermissions: false });
  }

}
