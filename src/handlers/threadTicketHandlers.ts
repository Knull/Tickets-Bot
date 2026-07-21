// src/handlers/threadTicketHandlers.ts
import {
  TextChannel,
  ThreadChannel,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ChatInputCommandInteraction
} from 'discord.js';
import config from '../config/config.js';
import prisma from '../utils/database.js';
import { shouldPingRoles } from '../utils/ticketModeSettings.js';
import { reserveTicketNumber } from '../utils/ticketNumber.js';
import { memberHasRole } from '../utils/memberRoles.js';
import { ACTIVE_TICKET_STATUSES } from '../utils/ticketPolicy.js';

export async function createTicketThread(
  interaction: any,
  ticketType: string,
  data: { title: string; description: string; banType?: string },
  shouldDefer: boolean = true
): Promise<ThreadChannel> {
  const { guild, user } = interaction;
  if (!guild) {
    if (shouldDefer && !interaction.deferred) {
      await interaction.reply({ content: 'Guild not found.', ephemeral: true });
    }
    throw new Error('Guild not found');
  }
  if (shouldDefer && !interaction.deferred) {
    await interaction.deferReply({ ephemeral: true });
  }
  const ticketCounter = await reserveTicketNumber();
  const username = user.username.split(/[\s\W_]+/)[0] || user.username;

  const isSpecial = memberHasRole(interaction.member, config.boosterRoleId);
  let threadName: string;
  if (isSpecial) {
    threadName = `🔥Priority Support・${username}`;
  } else {
    threadName = `🟢${username}・${ticketType}`;
  }

  let effectiveTicketType = ticketType;
  if (ticketType === 'Ban Appeal') {
    if (data.banType === 'screenshare_appeal') {
      effectiveTicketType = 'Ban Appeal: Screenshare';
    } else if (data.banType === 'strike_ban') {
      effectiveTicketType = 'Ban Appeal: Strike';
    }
  }

  const configEntry = await prisma.ticketConfig.findUnique({ where: { ticketType: effectiveTicketType } });
  if (!configEntry || !Array.isArray(configEntry.permissions)) {
    throw new Error(`No permission configuration found for ticket type ${effectiveTicketType}`);
  }
  const allowedRoleIds = configEntry.permissions as string[];

  const baseChannel = await guild.channels.fetch(config.ticketsChannelId);
  if (!baseChannel || !baseChannel.isTextBased()) {
    throw new Error('Base channel not found or invalid.');
  }
  const textChannel = baseChannel as TextChannel;

  const thread = await textChannel.threads.create({
    name: threadName,
    autoArchiveDuration: 1440, // 24 hours
    type: ChannelType.PrivateThread,
    reason: 'Ticket creation (private thread)',
  });
  let outsideMsgId: string | undefined;
  try {

  const rolePings = shouldPingRoles()
    ? allowedRoleIds.map(roleId => `||<@&${roleId}>||`).join(' ')
    : '';
  const welcomeMessage = `Hey <@${user.id}> 👋! ${rolePings}\n\`\`\`Please wait patiently for staff to reply. If no one responds, you may ping staff. Thanks!\`\`\``;
  await thread.send(welcomeMessage);

  let embed = new EmbedBuilder().setColor(0x0099FF);
  if (ticketType === 'Ban Appeal') {
    embed.setAuthor({ name: `${effectiveTicketType} Ticket`, iconURL: user.displayAvatarURL() });
    embed.setTitle(effectiveTicketType).setDescription(`\`\`\`${data.description}\`\`\``);
  } else if (ticketType === 'Store') {
    const storeInstr =
      configEntry.useCustomInstructions && configEntry.instructions
        ? configEntry.instructions
        : 'No store instructions configured.';
    embed.setAuthor({ name: `${ticketType} Ticket`, iconURL: user.displayAvatarURL() });
    embed.setTitle('Store Purchase').setDescription(`\`\`\`${storeInstr}\`\`\``);
  } else if (ticketType === 'Alt Appeal') {
    const altInstr =
      configEntry.useCustomInstructions && configEntry.instructions
        ? configEntry.instructions
        : 'No alt appeal instructions configured.';
    embed.setAuthor({ name: `${ticketType} Ticket`, iconURL: user.displayAvatarURL() });
    let description = data.description;
    if (description.trim().endsWith(altInstr.trim())) {
      embed.setTitle(data.title).setDescription(`\`\`\`${description}\`\`\``);
    } else {
      embed.setTitle(data.title).setDescription(`\`\`\`${description}\n\n${altInstr}\`\`\``);
    }
  } else if (ticketType === 'Partnership') {
    embed.setAuthor({ name: `${ticketType} Ticket`, iconURL: user.displayAvatarURL() });
    embed.setTitle(data.title).setDescription(`\`\`\`${data.description}\`\`\``);
  } else {
    embed.setAuthor({ name: `${ticketType} Ticket`, iconURL: user.displayAvatarURL() });
    embed.setTitle(data.title).setDescription(`\`\`\`${data.description}\`\`\``);
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('close_thread')
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
  );
  const ticketMsg = await thread.send({ embeds: [embed], components: [row] });

  if (ticketType === 'Partnership') {
    const partInfo =
      configEntry.useCustomInstructions && configEntry.instructions
        ? configEntry.instructions
        : 'No partnership instructions configured.';
    const partnershipEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setAuthor({
        name: 'Pinned Message',
        iconURL: 'https://cdn.discordapp.com/emojis/1348557777785716756.webp?size=44'
      })
      .setTitle('Partnership Requirements')
      .setDescription(partInfo);
    const sentMsg = await thread.send({ embeds: [partnershipEmbed] });
    await sentMsg.pin().catch(e => console.error('Error pinning partnership embed:', e));
  }

  const announcementChannel = await guild.channels.fetch(config.ticketsChannelId2);
  if (announcementChannel && announcementChannel.isTextBased()) {
    const announceChannel = announcementChannel as TextChannel;
    let announcementContent: string;
    if (isSpecial) {
      announcementContent =
        `▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
        `# PRIORITY TICKET 🔥\n` +
        `▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
        `<@${user.id}> has created a \`${ticketType}\` Ticket\n` +
        `Status: 🟢 Open\n` +
        `Channel Link: ${thread.url}`;
    } else {
      announcementContent =
        `<@${user.id}> has created a \`${ticketType}\` Ticket\n` +
        `Status: 🟢 Open\n` +
        `Channel Link: ${thread.url}`;
    }

    const accessButton = new ButtonBuilder()
      .setLabel('Access Ticket')
      .setStyle(ButtonStyle.Link)
      .setURL(thread.url);

    const announcementRow = new ActionRowBuilder<ButtonBuilder>().addComponents(accessButton);
    const announcementMsg = await announceChannel.send({ content: announcementContent, components: [announcementRow] });
    outsideMsgId = announcementMsg.id;
  }

  await prisma.ticket.create({
    data: {
      ticketNumber: ticketCounter,
      ticketType: effectiveTicketType,
      status: 'open',
      channelId: thread.id,
      userId: user.id,
      ticketMessageId: ticketMsg.id,
      reason: data.description,
      outsideMessageId: outsideMsgId,
    },
  });

  if (shouldDefer) {
    await interaction.editReply({
      content: `Your ticket has been opened. Head over to <#${thread.id}> to continue.`,
    }).catch(() => {});
  }
  return thread;
  } catch (error) {
    if (outsideMsgId) {
      const announcementChannel = await guild.channels.fetch(config.ticketsChannelId2).catch(() => null);
      if (announcementChannel?.isTextBased()) {
        await announcementChannel.messages.delete(outsideMsgId).catch(() => undefined);
      }
    }
    await thread.delete('Rolling back failed ticket creation.').catch(rollbackError => {
      console.error(`Failed to clean up ticket thread ${thread.id}:`, rollbackError);
    });
    throw error;
  }
}
// defer all updates
export async function handleCloseThread(interaction: ButtonInteraction): Promise<void> {
  let closedTicket: { id: number; previousStatus: string } | undefined;
  try {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    if (!channel || !channel.isThread()) {
      await interaction.followUp({ content: 'Ticket thread not found or invalid.', ephemeral: true });
      return;
    }
    const thread = channel as ThreadChannel;
    const ticket = await prisma.ticket.findFirst({ where: { channelId: thread.id } });
    if (!ticket) {
      await interaction.followUp({ content: 'Ticket record not found.', ephemeral: true });
      return;
    }
    const close = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: { in: [...ACTIVE_TICKET_STATUSES] } },
      data: { status: 'closed', transcriptUrl: thread.url },
    });
    if (close.count === 0) {
      await interaction.followUp({ content: 'This ticket has already been processed.', ephemeral: true });
      return;
    }
    closedTicket = { id: ticket.id, previousStatus: ticket.status };

    await thread.setLocked(true, 'Ticket closed.');

    if (thread.name.startsWith('🟢')) {
      const newName = '🔴' + thread.name.slice(2);
      await thread.setName(newName);
    }

    await thread.members.remove(interaction.user.id).catch(err => {
      console.error("Error removing ticket closer from thread:", err);
    });

    const closeEmbed = new EmbedBuilder()
      .setColor(0xffff00)
      .setDescription(`> 🔒 Ticket closed by <@${interaction.user.id}>`);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('reopen_thread')
        .setLabel('Reopen')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false)
    );
    await thread.send({ embeds: [closeEmbed], components: [row] });

    if (ticket.outsideMessageId) {
      const baseChannel = await interaction.guild?.channels.fetch(config.ticketsChannelId2);
      if (baseChannel && baseChannel.isTextBased()) {
        const textChannel = baseChannel as TextChannel;
        try {
          const outsideMsg = await textChannel.messages.fetch(ticket.outsideMessageId);
          const newContent = outsideMsg.content.replace(/Status:\s*[^\n]+/, "Status: 🔴 Closed");
          await outsideMsg.edit({ content: newContent });
        } catch (err) {
          console.error("Error updating outside message:", err);
        }
      }
    }

    let ticketCreator: any = null;
    try {
      ticketCreator = await interaction.guild?.members.fetch(ticket.userId);
    } catch (err) {
      console.error("Error fetching ticket creator:", err);
    }
    const nowTs = Math.floor(Date.now() / 1000);
    const transcriptUrl = thread.url;
    const transcriptChannelId =
      ticket?.ticketType === 'General'
        ? config.transcriptChannel1
        : config.transcriptChannel2;
    const logChannel = await interaction.guild?.channels.fetch(transcriptChannelId) as TextChannel;

    const logEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${ticket.ticketType} Ticket`,
        iconURL: interaction.guild?.iconURL() || ''
      })
      .setTitle(`${ticket.ticketNumber} | ${ticketCreator ? ticketCreator.user.username : ticket.userId}`)
      .setDescription(
        `> Ticket Claimed ➤ <t:${nowTs}:F>\n` +
        `> Claimed By ➤ <@${interaction.user.id}>\n` +
        `> Available ➤ ${transcriptUrl}`
      )
      .setTimestamp();


    const advancedButton = new ButtonBuilder()
      .setCustomId(`advanced_ticketLog_${ticket.id}`)
      .setLabel('Advanced')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚙️');

    const accessTicketButton = new ButtonBuilder()
      .setLabel('Access Ticket')
      .setStyle(ButtonStyle.Link)
      .setURL(transcriptUrl);

    const logRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      advancedButton,
      accessTicketButton
    );

    let logLink: string | undefined = undefined;
    if (logChannel) {
      const sent = await logChannel.send({ embeds: [logEmbed], components: [logRow] });
      logLink = `https://discord.com/channels/${interaction.guildId}/${logChannel.id}/${sent.id}`;
    }

    if (logLink) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { logMessageUrl: logLink } });
    }

    if (ticketCreator) {
      try {
        await ticketCreator.send({ embeds: [logEmbed], components: [logRow] });
      } catch (dmError) {
        console.error("Error sending DM to ticket creator:", dmError);
      }
    }
    closedTicket = undefined;
    await interaction.followUp({ content: 'Ticket has been closed (thread locked).', ephemeral: true });
  } catch (error) {
    console.error('Error in handleCloseThread:', error);
    if (closedTicket) {
      await prisma.ticket.updateMany({
        where: { id: closedTicket.id, status: 'closed' },
        data: { status: closedTicket.previousStatus },
      }).catch(rollbackError => console.error('Failed to restore ticket status:', rollbackError));
    }
    await interaction.followUp({ content: 'Failed to close ticket.', ephemeral: true });
  }
}
export async function handleReopenThread(interaction: ButtonInteraction): Promise<void> {
  let reopenedTicketId: number | undefined;
  try {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    if (!channel || !channel.isThread()) {
      await interaction.followUp({ content: 'Ticket thread not found or invalid.', ephemeral: true });
      return;
    }
    const thread = channel as ThreadChannel;
    const ticket = await prisma.ticket.findFirst({ where: { channelId: thread.id } });
    if (!ticket) {
      await interaction.followUp({ content: 'Ticket record not found.', ephemeral: true });
      return;
    }
    const reopen = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: 'closed' },
      data: { status: 'reopened', lastMessageAt: new Date() },
    });
    if (reopen.count === 0) {
      await interaction.followUp({ content: 'This ticket is not closed or has already been reopened.', ephemeral: true });
      return;
    }
    reopenedTicketId = ticket.id;

    await thread.setLocked(false, 'Ticket reopened.');
    try {
      const storedMsg = await thread.messages.fetch(ticket.ticketMessageId!);
      const updatedComponents = storedMsg.components.map(row => {
        const newRow = structuredClone(row.toJSON()) as any;
        if (!Array.isArray(newRow.components)) return newRow;
        newRow.components = newRow.components.map((component: any) => {
          if (component.custom_id === 'close_thread') {
            component.disabled = false;
          }
          return component;
        });
        return newRow;
      });
      await storedMsg.edit({ components: updatedComponents });
    } catch (err) {
      console.error('Error updating stored ticket message:', err);
    }
    try {
      const currentComponents = interaction.message.components.map(row => {
        const newRow = structuredClone(row.toJSON()) as any;
        if (!Array.isArray(newRow.components)) return newRow;
        newRow.components = newRow.components.map((component: any) => {
          if (component.custom_id === 'reopen_thread') {
            component.disabled = true;
          }
          return component;
        });
        return newRow;
      });
      await interaction.message.edit({ components: currentComponents });
    } catch (err) {
      console.error('Error disabling reopen button:', err);
    }
    if (thread.name.startsWith('🔴')) {
      const newName = '🟢' + thread.name.slice(2);
      await thread.setName(newName);
    }
    if (ticket.outsideMessageId) {
      const baseChannel = await interaction.guild?.channels.fetch(config.ticketsChannelId2);
      if (baseChannel && baseChannel.isTextBased()) {
        const textChannel = baseChannel as TextChannel;
        try {
          const outsideMsg = await textChannel.messages.fetch(ticket.outsideMessageId);
          const newContent = outsideMsg.content.replace(/Status:\s*[^\n]+/, "Status: 🟢 Open");
          await outsideMsg.edit({ content: newContent });
        } catch (err) {
          console.error("Error updating outside message on reopen:", err);
        }
      }
    }

    const reopenEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setDescription(`> Ticket Reopened by <@${interaction.user.id}>`);
    const reopenMessage = `<@${ticket.userId}>, your ticket has been reopened by <@${interaction.user.id}>.\n**Ticket Reopened**`;
    await thread.send({ content: reopenMessage, embeds: [reopenEmbed] });
    const isPriority = thread.name.includes('🔥');
    const announcementChannel = await interaction.guild?.channels.fetch(config.ticketsChannelId2);
    if (announcementChannel && announcementChannel.isTextBased()) {
      const announceChannel = announcementChannel as TextChannel;
      let announcementContent: string;
      if (isPriority) {
        announcementContent =
          `▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
          `# PRIORITY TICKET 🔥\n` +
          `▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
          `<@${ticket.userId}> has reopened a \`${ticket.ticketType}\` Ticket\n` +
          `Status: 🟢 Open\n` +
          `Channel Link: ${thread.url}`;
      } else {
        announcementContent =
          `▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`  +
          `<@${ticket.userId}> has reopened a \`${ticket.ticketType}\` Ticket\n` +
          `Status: 🟢 Open\n` +
          `Channel Link: ${thread.url}`;
      }
      const accessButton = new ButtonBuilder()
        .setLabel('Access Ticket')
        .setStyle(ButtonStyle.Link)
        .setURL(thread.url);
      const announcementRow = new ActionRowBuilder<ButtonBuilder>().addComponents(accessButton);
      await announceChannel.send({ content: announcementContent, components: [announcementRow] });
    }
    reopenedTicketId = undefined;
    await interaction.followUp({ content: 'Ticket has been reopened.', ephemeral: true });
  } catch (error) {
    console.error('Error in handleReopenThread:', error);
    if (reopenedTicketId !== undefined) {
      await prisma.ticket.updateMany({
        where: { id: reopenedTicketId, status: 'reopened' },
        data: { status: 'closed' },
      }).catch(rollbackError => console.error('Failed to restore ticket status:', rollbackError));
    }
    await interaction.followUp({ content: 'Failed to reopen ticket.', ephemeral: true });
  }
}
export async function handleCloseThreadCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  let closedTicket: { id: number; previousStatus: string } | undefined;
  try {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    if (!channel || !channel.isThread()) {
      await interaction.followUp({ content: 'Ticket thread not found or invalid.', ephemeral: true });
      return;
    }
    const thread = channel as ThreadChannel;
    const ticket = await prisma.ticket.findFirst({ where: { channelId: thread.id } });
    if (!ticket) {
      await interaction.followUp({ content: 'Ticket record not found.', ephemeral: true });
      return;
    }
    const close = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: { in: [...ACTIVE_TICKET_STATUSES] } },
      data: { status: 'closed', transcriptUrl: thread.url },
    });
    if (close.count === 0) {
      await interaction.followUp({ content: 'This ticket has already been processed.', ephemeral: true });
      return;
    }
    closedTicket = { id: ticket.id, previousStatus: ticket.status };

    await thread.setLocked(true, 'Ticket closed.');
    if (thread.name.startsWith('🟢')) {
      const newName = '🔴' + thread.name.slice(2);
      await thread.setName(newName);
    }
    {
      const usersToRemove: string[] = [];
      if (ticket.userId) {
        usersToRemove.push(ticket.userId);
      }
      if (ticket.added_user && Array.isArray(ticket.added_user)) {
        const addedUsers = ticket.added_user.filter((user: unknown): user is string => typeof user === 'string');
        usersToRemove.push(...addedUsers);
      }
      await Promise.all(
        usersToRemove.map(userId =>
          thread.members.remove(userId).catch(err => {
            console.error(`Error removing user ${userId} from thread:`, err);
          })
        )
      );
    }
    const closeEmbed = new EmbedBuilder()
      .setColor(0xffff00)
      .setDescription(`> 🔒 Ticket closed by <@${interaction.user.id}>`);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('reopen_thread')
        .setLabel('Reopen')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false)
    );
    await thread.send({ embeds: [closeEmbed], components: [row] });
    if (ticket.outsideMessageId) {
      const baseChannel = await interaction.guild?.channels.fetch(config.ticketsChannelId2);
      if (baseChannel && baseChannel.isTextBased()) {
        const textChannel = baseChannel as TextChannel;
        try {
          const outsideMsg = await textChannel.messages.fetch(ticket.outsideMessageId);
          const newContent = outsideMsg.content.replace(/Status:\s*[^\n]+/, "Status: 🔴 Closed");
          await outsideMsg.edit({ content: newContent });
        } catch (err) {
          console.error("Error updating outside message:", err);
        }
      }
    }
    let ticketCreator: any = null;
    try {
      ticketCreator = await interaction.guild?.members.fetch(ticket.userId);
    } catch (err) {
      console.error("Error fetching ticket creator:", err);
    }
    const nowTs = Math.floor(Date.now() / 1000);
    const transcriptUrl = thread.url;
    const transcriptChannelId = ticket?.ticketType === 'General' ? config.transcriptChannel1 : config.transcriptChannel2;
    const logChannel = await interaction.guild?.channels.fetch(transcriptChannelId) as TextChannel;
    const logEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${ticket.ticketType} Ticket`,
        iconURL: interaction.guild?.iconURL() || ''
      })
      .setTitle(`${ticket.ticketNumber} | ${ticketCreator ? ticketCreator.user.username : ticket.userId}`)
      .setDescription(
        `> Ticket Claimed ➤ <t:${nowTs}:F>\n` +
        `> Claimed By ➤ <@${interaction.user.id}>\n` +
        `> Available ➤ ${transcriptUrl}`
      )
      .setTimestamp();

    const advancedButton = new ButtonBuilder()
      .setCustomId(`advanced_ticketLog_${ticket.id}`)
      .setLabel('Advanced')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚙️');

    const accessTicketButton = new ButtonBuilder()
      .setLabel('Access Ticket')
      .setStyle(ButtonStyle.Link)
      .setURL(transcriptUrl);

    const logRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      advancedButton,
      accessTicketButton
    );

    let logLink: string | undefined = undefined;
    if (logChannel) {
      const sent = await logChannel.send({ embeds: [logEmbed], components: [logRow] });
      logLink = `https://discord.com/channels/${interaction.guildId}/${logChannel.id}/${sent.id}`;
    }
    if (logLink) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { logMessageUrl: logLink } });
    }
    if (ticketCreator) {
      try {
        await ticketCreator.send({ embeds: [logEmbed], components: [logRow] });
      } catch (dmError) {
        console.error("Error sending DM to ticket creator:", dmError);
      }
    }
    closedTicket = undefined;
    await interaction.followUp({ content: 'Ticket has been closed (thread locked).', ephemeral: true });
  } catch (error) {
    console.error('Error in handleCloseThreadCommand:', error);
    if (closedTicket) {
      await prisma.ticket.updateMany({
        where: { id: closedTicket.id, status: 'closed' },
        data: { status: closedTicket.previousStatus },
      }).catch(rollbackError => console.error('Failed to restore ticket status:', rollbackError));
    }
    await interaction.followUp({ content: 'Failed to close ticket.', ephemeral: true });
  }
}
