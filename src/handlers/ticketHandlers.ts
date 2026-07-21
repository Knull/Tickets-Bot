import {
  Client,
  ModalSubmitInteraction,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  OverwriteResolvable,
  ButtonInteraction,
  PermissionsBitField,
  ThreadChannel,
  ChatInputCommandInteraction
} from 'discord.js';
import config from '../config/config.js';
import prisma from '../utils/database.js';
import { getCategoryId } from '../utils/discordUtils.js';
import { unlink } from 'node:fs/promises';
import { reserveTicketNumber } from '../utils/ticketNumber.js';
import { memberHasRole } from '../utils/memberRoles.js';
import { exportTranscript } from '../utils/transcript.js';
import { ACTIVE_TICKET_STATUSES } from '../utils/ticketPolicy.js';

type SerializableComponent = { toJSON(): unknown };

function updateButtonStates(
  rows: readonly SerializableComponent[],
  disabledFor: (customId: string) => boolean | undefined,
): any[] {
  return rows.map(row => {
    const json = structuredClone(row.toJSON()) as {
      components?: Array<{ custom_id?: string; disabled?: boolean }>;
    };
    if (!Array.isArray(json.components)) return json;

    for (const component of json.components) {
      if (!component.custom_id) continue;
      const disabled = disabledFor(component.custom_id);
      if (disabled !== undefined) component.disabled = disabled;
    }
    return json;
  });
}

export async function setupTicketSystem(client: Client): Promise<void> {
  try {
    const channelFetched = await client.channels.fetch(config.ticketsChannelId);
    if (!channelFetched || !channelFetched.isTextBased()) {
      console.error('Failed to fetch the tickets channel.');
      return;
    }

    const ticketsChannel = channelFetched as TextChannel;
    const messages = await ticketsChannel.messages.fetch({ limit: 10 });
    const setupMessageExists = messages.some(
      msg =>
        msg.author.id === client.user?.id &&
        msg.embeds.length > 0 &&
        msg.embeds[0]?.title === 'Need Assistance?'
    );

    if (!setupMessageExists) {
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Need Assistance?')
        .setDescription(
          '- **<:general:1298227239069945888> General ➤** Need help? Get assistance here.\n' +
            '- **⚖️ Appeal ➤** Appeal a ban or mute here.\n' +
            '- **🛒 Store ➤** Get assistance with store-related purchases.\n' +
            '- **<a:partnership:1298227428866527285> Partnership ➤** Apply to be a server partner here.'
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('create_general')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('<:general:1298227239069945888>'),
        new ButtonBuilder()
          .setCustomId('create_appeal')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚖️'),
        new ButtonBuilder()
          .setCustomId('create_store')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🛒'),
        new ButtonBuilder()
          .setCustomId('create_partnership')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('<a:partnership:1298227428866527285>')
      );

      await ticketsChannel.send({ embeds: [embed], components: [row] });
      console.log('Ticket system setup message sent.');
    } else {
      console.log('Ticket system setup message already exists.');
    }
  } catch (error) {
    console.error('Error in ticketing system setup:', error);
  }
}
export async function createTicketChannel(interaction: any, ticketType: string, data: { title: string; description: string; banType?: string }, shouldDefer: boolean = true): Promise<TextChannel> {
  const { guild, user } = interaction
  if (!guild) {
    if (shouldDefer && !interaction.deferred) {
      await interaction.reply({ content: 'Guild not found', ephemeral: true }).catch(() => {})
    }
    throw new Error('Guild not found')
  }
  if (shouldDefer && !interaction.deferred) {
    await interaction.deferReply({ ephemeral: true })
  }
  const ticketCounter = await reserveTicketNumber()
  const prefix = '┃'
  const username = user.username.split(/[\s\W_]+/)[0] || user.username
  let ticketChannelName: string
  if (memberHasRole(interaction.member, config.boosterRoleId) || memberHasRole(interaction.member, config.staffRoleId)) {
    ticketChannelName = `💞︱priority・${username}`
  } else {
    ticketChannelName = `${ticketCounter}${prefix}${username}`
  }
  let effectiveTicketType = ticketType
  if (ticketType === 'Ban Appeal') {
    if (data.banType === 'screenshare_appeal') {
      effectiveTicketType = 'Ban Appeal: Screenshare'
    } else if (data.banType === 'strike_ban') {
      effectiveTicketType = 'Ban Appeal: Strike'
    }
  }
  const configEntry = await prisma.ticketConfig.findUnique({ where: { ticketType: effectiveTicketType } })
  if (!configEntry || !Array.isArray(configEntry.permissions)) {
    throw new Error(`No permission configuration found for ticket type ${effectiveTicketType}`)
  }
  const allowedRoleIds = configEntry.permissions as string[]
  let permissionOverwrites: OverwriteResolvable[] = [
    {
      id: guild.id,
      deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
    },
    ...allowedRoleIds.map(roleId => ({
      id: roleId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
    }))
  ]
  permissionOverwrites.push({
    id: user.id,
    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
  })
  const parentCategoryId = getCategoryId(effectiveTicketType)
  if (!parentCategoryId) {
    throw new Error(`Parent category not set for ${effectiveTicketType}`)
  }
  const channelCreated = await guild.channels.create({
    name: ticketChannelName,
    type: ChannelType.GuildText,
    parent: parentCategoryId,
    permissionOverwrites,
    topic: `[${ticketType}] Ticket for ${user.username}`
  })
  const ticketChannel = channelCreated as TextChannel
  try {
  const welcomeMessage = `Hey <@${user.id}> 👋!\n\`\`\`Please wait patiently for staff to reply. If no one responds, you may ping staff. Thanks!\`\`\``
  await ticketChannel.send(welcomeMessage)
  let embed = new EmbedBuilder().setColor(0x0099FF)
  if (ticketType === 'Ban Appeal') {
    embed.setAuthor({ name: `${effectiveTicketType} Ticket`, iconURL: user.displayAvatarURL() })
    embed.setTitle(effectiveTicketType).setDescription(`\`\`\`${data.description}\`\`\``)
  } else {
    embed.setAuthor({ name: `${ticketType} Ticket`, iconURL: user.displayAvatarURL() })
    if (ticketType === 'Store') {
      const storeInstr = configEntry.useCustomInstructions && configEntry.instructions ? configEntry.instructions : 'No store instructions configured.'
      embed.setTitle('Store Purchase').setDescription(`\`\`\`${storeInstr}\`\`\``)
    } else if (ticketType === 'Alt Appeal') {
      embed.setTitle(data.title).setDescription(`\`\`\`${data.description}\n\`\`\``)
    } else if (ticketType === 'Partnership') {
      embed.setTitle(data.title).setDescription(`\`\`\`${data.description}\`\`\``)
    } else {
      embed.setTitle(data.title).setDescription(`\`\`\`${data.description}\`\`\``)
    }
  }
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('<a:check:1256329093679681608>')
  )
  const ticketMsg = await ticketChannel.send({ embeds: [embed], components: [row] })
  if (ticketType === 'Partnership') {
    const partInfo = configEntry.useCustomInstructions && configEntry.instructions ? configEntry.instructions : 'No partnership instructions configured.'
    const partnershipEmbed = new EmbedBuilder().setColor(0xff0000).setAuthor({ name: 'Pinned Message', iconURL: 'https://cdn.discordapp.com/emojis/1348557777785716756.webp?size=44' }).setTitle('Partnership Requirements').setDescription(partInfo)
    const sentMsg = await ticketChannel.send({ embeds: [partnershipEmbed] })
    await sentMsg.pin().catch(e => console.error('Error pinning partnership embed:', e))
  }
  let finalReason: string
  if (ticketType === 'Store') {
    finalReason = configEntry.useCustomInstructions && configEntry.instructions ? configEntry.instructions : 'No store instructions configured.'
  } else if (ticketType === 'Partnership') {
    finalReason = data.description
  } else if (ticketType === 'Alt Appeal') {
    const altInstr = configEntry.useCustomInstructions && configEntry.instructions ? configEntry.instructions : 'No alt appeal instructions configured.'
    if (data.description.trim().endsWith(altInstr.trim())) {
      finalReason = data.description
    } else {
      finalReason = `${data.description}\n\n${altInstr}`
    }
  } else {
    finalReason = data.description
  }
  await prisma.ticket.create({
    data: {
      ticketNumber: ticketCounter,
      ticketType: effectiveTicketType,
      status: 'open',
      channelId: ticketChannel.id,
      userId: user.id,
      ticketMessageId: ticketMsg.id,
      reason: ticketType === 'Partnership' ? data.description : finalReason
    }
  })
  if (shouldDefer) {
    await interaction.editReply({ content: `Your ticket has been opened. Head over to <#${ticketChannel.id}> to continue.` }).catch(() => {})
  }
  return ticketChannel
  } catch (error) {
    await ticketChannel.delete('Rolling back failed ticket creation.').catch(rollbackError => {
      console.error(`Failed to clean up ticket channel ${ticketChannel.id}:`, rollbackError)
    })
    throw error
  }
}


export async function handleCloseTicket(interaction: ButtonInteraction): Promise<void> {
  let closedTicket: { id: number; previousStatus: string } | undefined;
  try {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.followUp({ content: 'Channel not found or invalid.', ephemeral: true });
      return;
    }
    const ticket = await prisma.ticket.findFirst({ where: { channelId: channel.id } });
    if (!ticket) {
      await interaction.followUp({ content: 'Ticket not found in the database.', ephemeral: true });
      return;
    }
    const configEntry = await prisma.ticketConfig.findUnique({ where: { ticketType: ticket.ticketType } });
    if (!configEntry || !Array.isArray(configEntry.permissions)) {
      await interaction.followUp({ content: 'No permission configuration found for this ticket type.', ephemeral: true });
      return;
    }
    const allowedRoleIds = configEntry.permissions as string[];
    const guild = channel.guild;
    const newOverwrites: OverwriteResolvable[] = [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      },
      ...allowedRoleIds.map(roleId => ({
        id: roleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }))
    ];
    const archivedCategoryId = getCategoryId(ticket.ticketType, true);
    if (!archivedCategoryId) {
      await interaction.followUp({ content: 'Archived category not set for this ticket type.', ephemeral: true });
      return;
    }
    const close = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: { in: [...ACTIVE_TICKET_STATUSES] } },
      data: { status: 'closed' },
    });
    if (close.count === 0) {
      await interaction.followUp({ content: 'This ticket has already been processed.', ephemeral: true });
      return;
    }
    closedTicket = { id: ticket.id, previousStatus: ticket.status };

    if (ticket.ticketMessageId) {
      const originalMsg = await channel.messages.fetch(ticket.ticketMessageId).catch(() => null);
      if (originalMsg) {
        const disabledComponents = updateButtonStates(originalMsg.components, () => true);
        await originalMsg.edit({ components: disabledComponents });
      }
    }
    await channel.edit({ permissionOverwrites: newOverwrites });
    await channel.setParent(archivedCategoryId, { lockPermissions: false });
    const closeEmbed = new EmbedBuilder()
      .setColor(0xffff00)
      .setDescription(`> 🔒 Ticket closed by <@${interaction.user.id}>`);
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('delete_ticket_manual')
        .setLabel('Delete')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌'),
      new ButtonBuilder()
        .setCustomId('reopen_ticket')
        .setLabel('Reopen')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔓')
    );
    await channel.send({ embeds: [closeEmbed], components: [buttonRow] });
    closedTicket = undefined;
    await interaction.followUp({ content: 'Ticket has been closed and archived.', ephemeral: true });
  } catch (error) {
    console.error('Error closing ticket:', error);
    if (closedTicket) {
      await prisma.ticket.updateMany({
        where: { id: closedTicket.id, status: 'closed' },
        data: { status: closedTicket.previousStatus },
      }).catch(rollbackError => console.error('Failed to restore ticket status:', rollbackError));
    }
    await interaction.followUp({ content: 'Failed to close ticket.', ephemeral: true });
  }
}

export async function handlePlayerInfo(interaction: any): Promise<void> {
  const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channel.id } });
  if (!ticket) {
    if (typeof interaction.reply === 'function') {
      await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
    } else {
      await interaction.channel.send({ content: 'Ticket not found.' });
    }
    return;
  }

  const profile = await prisma.playerProfile.findFirst({ where: { discordUserId: ticket.userId } });
  if (!profile) {
    if (typeof interaction.reply === 'function') {
      await interaction.reply({ content: 'Player profile not found.', ephemeral: true });
    } else {
      await interaction.channel.send({ content: 'Player profile not found.' });
    }
    return;
  }

  const lastSeenTs = profile.lastSeen
    ? Math.floor(new Date(profile.lastSeen).getTime() / 1000)
    : null;
  const accountCreatedTs = Math.floor(interaction.user.createdAt.getTime() / 1000);
  const joinDateTs =
    interaction.member && interaction.member.joinedAt
      ? Math.floor(interaction.member.joinedAt.getTime() / 1000)
      : null;

  const embed = new EmbedBuilder().setColor(0x0099FF).setDescription(
    `# [🎯 Player Information | ${profile.ign}](https://stats.pika-network.net/player/${encodeURIComponent(profile.ign)})\n` +
      (lastSeenTs
        ? `- <a:last_seen:1347936608254427229> **Last Seen:** <t:${lastSeenTs}:R>\n`
        : '') +
      `> 🎯 **Rank Details:** Level: \` ${(profile.rankInfo as any)?.level || 'N/A'} \` <:divider:1289576524550504458> experience: \` ${
        (profile.rankInfo as any)?.experience || 'N/A'
      } \` <:divider:1289576524550504458> percentage: \` ${
        (profile.rankInfo as any)?.percentage || 'N/A'
      } \`\n` +
      (joinDateTs ? `- 🕒 **Join Date:** <t:${joinDateTs}:F>\n` : '') +
      `> 📆 **Account Created:** <t:${accountCreatedTs}:R>\n` +
      `- **Clan Name:** ${profile.clanName || 'N/A'}`
  );

  const friends = Array.isArray(profile.friends)
    ? profile.friends.filter((friend): friend is string => typeof friend === 'string').slice(0, 40)
    : [];
  if (friends.length > 5) {
    const mid = Math.ceil(friends.length / 2);
    const friendList1 = friends
      .slice(0, mid)
      .map((friend, i) => `${i + 1}. ${friend}`)
      .join('\n');
    const friendList2 = friends
      .slice(mid)
      .map((friend, i) => `${i + 1 + mid}. ${friend}`)
      .join('\n');
    embed.addFields(
      { name: 'Friend List (1)', value: '```arm\n' + friendList1 + '\n```', inline: true },
      { name: 'Friend List (2)', value: '```markdown\n' + friendList2 + '\n```', inline: true }
    );
  } else if (friends.length > 0) {
    const friendList = friends.map((friend, i) => `${i + 1}. ${friend}`).join('\n');
    embed.addFields({
      name: 'Friend List',
      value: '```arm\n' + friendList + '\n```',
      inline: false
    });
  } else {
    embed.addFields({ name: 'Friend List', value: 'None', inline: false });
  }

  let headURL = `https://mc-heads.net/avatar/${encodeURIComponent(profile.ign)}/overlay`;
  try {
    const response = await fetch(headURL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      headURL = `https://mc-heads.net/avatar/dewier/overlay`;
    }
  } catch {
    headURL = `https://mc-heads.net/avatar/dewier/overlay`;
  }
  embed.setThumbnail(headURL);

  try {
    const msg = await interaction.channel.send({ embeds: [embed] });
    await msg.pin();
  } catch (error) {
    console.error('Failed to pin message:', error);
  }
}

export async function handleAddCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!memberHasRole(interaction.member, config.staffRoleId)) {
    await interaction.reply({
      content: 'You are not authorized to add users or roles.',
      ephemeral: true
    });
    return;
  }
  await interaction.deferReply({ ephemeral: false });
  const option = interaction.options.get('mentionable', true);
  const mentionable = option.user ?? option.role;
  const isUser = Boolean(option.user);
  const channel = interaction.channel;
  if (!channel) {
    await interaction.editReply({ content: 'Channel not found.' });
    return;
  }
  if (!mentionable) {
    await interaction.editReply({ content: 'Please specify a valid user or role to add.' });
    return;
  }

  if ('isThread' in channel && channel.isThread()) {
    const thread = channel as ThreadChannel;
    if (isUser) {
      await thread.members.add(mentionable.id);
    } else {
      const parent = thread.parent;
      if (parent && parent.isTextBased()) {
        await parent.permissionOverwrites.edit(mentionable.id, {
          ViewChannel: true,
          SendMessages: true
        });
        await thread.send(`${mentionable}`);
      } else {
        await interaction.editReply({ content: 'Unable to add role in thread channel.' });
        return;
      }
    }
  } else {
    const textChannel = channel as TextChannel;
    await textChannel.permissionOverwrites.edit(mentionable.id, {
      ViewChannel: true,
      SendMessages: true
    });
  }

  const ticket = await prisma.ticket.findFirst({ where: { channelId: channel.id } });
  if (ticket) {
    if (isUser) {
      let currentUsers: string[] = Array.isArray(ticket.added_user)
        ? (ticket.added_user as string[])
        : [];
      if (!currentUsers.includes(mentionable.id)) {
        currentUsers.push(mentionable.id);
      }
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { added_user: currentUsers }
      });
    } else {
      let currentRoles: string[] = Array.isArray(ticket.added_roles)
        ? (ticket.added_roles as string[])
        : [];
      if (!currentRoles.includes(mentionable.id)) {
        currentRoles.push(mentionable.id);
      }
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { added_roles: currentRoles }
      });
    }
  }

  const ping = isUser
    ? `<@${mentionable.id}>`
    : `<@&${mentionable.id}>`;

  const embed = new EmbedBuilder()
    .setColor(0x2e96e6)
    .setDescription(`> Granted ${ping} access to <#${channel.id}>.`);
  await interaction.editReply({ content: ping, embeds: [embed] });
}

export async function handleRemoveCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!memberHasRole(interaction.member, config.staffRoleId)) {
    await interaction.reply({
      content: 'You are not authorized to remove users or roles.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({ ephemeral: false });
  const option = interaction.options.get('mentionable', true);
  const mentionable = option.user ?? option.role;
  const isUser = Boolean(option.user);
  const channel = interaction.channel;
  if (!channel) {
    await interaction.editReply({ content: 'Channel not found.' });
    return;
  }
  if (!mentionable) {
    await interaction.editReply({ content: 'Please specify a valid user or role to remove.' });
    return;
  }

  if ('isThread' in channel && channel.isThread()) {
    const thread = channel as ThreadChannel;
    if (isUser) {
      await thread.members.remove(mentionable.id);
    } else {
      const parent = thread.parent;
      if (parent && parent.isTextBased()) {
        await parent.permissionOverwrites.delete(mentionable.id);
      } else {
        await interaction.editReply({ content: 'Unable to remove role in thread channel.' });
        return;
      }
    }
  } else {
    const textChannel = channel as TextChannel;
    await textChannel.permissionOverwrites.delete(mentionable.id);
  }

  // Update ticket record.
  const ticket = await prisma.ticket.findFirst({ where: { channelId: channel.id } });
  if (ticket) {
    if (isUser) {
      let currentUsers: string[] = Array.isArray(ticket.added_user)
        ? (ticket.added_user as string[])
        : [];
      currentUsers = currentUsers.filter(id => id !== mentionable.id);
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { added_user: currentUsers }
      });
    } else {
      let currentRoles: string[] = Array.isArray(ticket.added_roles)
        ? (ticket.added_roles as string[])
        : [];
      currentRoles = currentRoles.filter(id => id !== mentionable.id);
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { added_roles: currentRoles }
      });
    }
  }
  const ping = isUser
    ? `<@${mentionable.id}>`
    : `<@&${mentionable.id}>`;

  const embed = new EmbedBuilder()
    .setColor(0xe62e2e)
    .setDescription(`> Removed ${ping}'s access from <#${channel.id}>.`);
  await interaction.editReply({ embeds: [embed] });
}



export async function handleClaimTicket(interaction: ModalSubmitInteraction, reason: string): Promise<void> {
  let transcriptFile: string | undefined;
  let claimedTicket: { id: number; previousStatus: string } | undefined;
  try {
    if (!memberHasRole(interaction.member, config.staffRoleId)) {
      await interaction.reply({ content: 'You are not authorized to claim tickets.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    
    const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channel?.id } });
    if (!ticket) {
      await interaction.deleteReply();
      return;
    }
    if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
      await interaction.editReply({ content: 'This action is only available in channel-based tickets.' });
      return;
    }
    const claim = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: { in: [...ACTIVE_TICKET_STATUSES] } },
      data: { status: 'claimed' },
    });
    if (claim.count === 0) {
      await interaction.editReply({ content: 'This ticket has already been processed.' });
      return;
    }
    claimedTicket = { id: ticket.id, previousStatus: ticket.status };

    const ticketChannel = interaction.channel as TextChannel;
    const ticketCreator = await interaction.guild?.members.fetch(ticket.userId).catch(() => null);
    const nowTs = Math.floor(Date.now() / 1000);
    
    transcriptFile = await exportTranscript(ticketChannel);
    
    const logChannelId = (ticket.ticketType === 'General') ? config.transcriptChannel1 : config.transcriptChannel2;
    const logChannel = await interaction.guild?.channels.fetch(logChannelId);
    if (!(logChannel instanceof TextChannel)) throw new Error('Transcript log channel is unavailable.');
    
    const transcriptAttachment = { attachment: transcriptFile, name: `transcript_${ticketChannel.id}.html` };
    const logEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${ticket.ticketType} Ticket`,
        iconURL: interaction.guild?.iconURL() || ''
      })
      .setTitle(`${ticket.ticketNumber} | ${ticketCreator ? ticketCreator.user.username : ticket.userId}`)
      .setDescription(
        `> Ticket Claimed ➤ <t:${nowTs}:F>\n` +
        `> Claimed By ➤ <@${interaction.user.id}>\n` +
        `> Reason ➤ \`${reason}\``
      )
      .setTimestamp();
    
    const advancedButton = new ButtonBuilder()
      .setCustomId(`advanced_ticketLog_${ticket.id}`)
      .setLabel('Advanced')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚙️');
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(advancedButton);
    let logLink: string | undefined = undefined;
    if (logChannel) {
      const sent = await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [row.toJSON()] });
      logLink = `https://discord.com/channels/${interaction.guildId}/${logChannel.id}/${sent.id}`;
    }
    if (logLink) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { logMessageUrl: logLink } });
    }
    if (ticketCreator) {
      try {
        const dmChannel = ticketCreator.dmChannel || await ticketCreator.createDM();
        await dmChannel.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [row.toJSON()] });
      } catch (err) {
        console.error('Failed to DM ticket creator, ignoring error:', err);
      }
    }
    
    await interaction.deleteReply();
    await ticketChannel.delete();
    claimedTicket = undefined;
    
  } catch (error) {
    console.error('Error in handleClaimTicket:', error);
    if (claimedTicket) {
      await prisma.ticket.updateMany({
        where: { id: claimedTicket.id, status: 'claimed' },
        data: { status: claimedTicket.previousStatus },
      }).catch(rollbackError => console.error('Failed to restore ticket status:', rollbackError));
    }
    try {
      await interaction.editReply({ content: 'Failed to claim the ticket. Please try again.' });
    } catch { /* ignore cleanup errors */ }
  } finally {
    if (transcriptFile) {
      await unlink(transcriptFile).catch(error => console.error('Error deleting transcript file:', error));
    }
  }
}

export async function handleReopenTicket(interaction: ButtonInteraction): Promise<void> {
  let reopenedTicketId: number | undefined;
  try {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.followUp({ content: 'Channel not found or invalid.', ephemeral: true });
      return;
    }
    const ticket = await prisma.ticket.findFirst({ where: { channelId: channel.id } });
    if (!ticket) {
      await interaction.followUp({ content: 'Ticket not found in the database.', ephemeral: true });
      return;
    }
    const normalCategoryId = getCategoryId(ticket.ticketType, false);
    if (!normalCategoryId) {
      await interaction.followUp({ content: 'Normal category not set for this ticket type.', ephemeral: true });
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

    await channel.setParent(normalCategoryId, { lockPermissions: false });
    await channel.permissionOverwrites.edit(ticket.userId, {
      ViewChannel: true,
      SendMessages: true
    });
    if (ticket.ticketMessageId) {
      const storedMessage = await channel.messages.fetch(ticket.ticketMessageId).catch(() => null);
      if (storedMessage) {
        const updatedRows = updateButtonStates(storedMessage.components, customId =>
          customId === 'close_ticket' || customId === 'claim_ticket' ? false : undefined
        );
        await storedMessage.edit({ components: updatedRows });
      }
    }
    
    // -------------------------------
    if (interaction.message) {
      const updatedRows = updateButtonStates(interaction.message.components, customId =>
        ['reopen_ticket', 'delete_ticket_manual', 'delete_ticket_auto'].includes(customId)
          ? true
          : undefined
      );
      await interaction.message.edit({ components: updatedRows });
    }
    await channel.send({
      content: `<@${ticket.userId}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(0x00ff00)
          .setDescription(`> Ticket was reopened by <@${interaction.user.id}>`)
      ]
    });
    reopenedTicketId = undefined;
    await interaction.followUp({ content: 'Ticket has been reopened.', ephemeral: true });
  } catch (error) {
    console.error('Error in handleReopenTicket:', error);
    if (reopenedTicketId !== undefined) {
      await prisma.ticket.updateMany({
        where: { id: reopenedTicketId, status: 'reopened' },
        data: { status: 'closed' },
      }).catch(rollbackError => console.error('Failed to restore ticket status:', rollbackError));
    }
    await interaction.followUp({ content: 'Failed to reopen ticket.', ephemeral: true });
  }
}
export async function handleDeleteTicketManual(interaction: ModalSubmitInteraction, reason: string): Promise<void> {
  let transcriptFile: string | undefined;
  let deletedTicket: { id: number; previousStatus: string } | undefined;
  try {
    if (!memberHasRole(interaction.member, config.staffRoleId)) {
      await interaction.reply({ content: 'You are not authorized to delete tickets.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    
    const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channel?.id } });
    if (!ticket) {
      await interaction.editReply({ content: 'Ticket not found in the database.' });
      return;
    }
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.editReply({ content: 'This action is only available in channel-based tickets.' });
      return;
    }
    const deletion = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: 'closed' },
      data: { status: 'deleted' },
    });
    if (deletion.count === 0) {
      await interaction.editReply({ content: 'This ticket is no longer available for deletion.' });
      return;
    }
    deletedTicket = { id: ticket.id, previousStatus: ticket.status };

    const ticketChannel = interaction.channel;
    const ticketCreator = await interaction.guild?.members.fetch(ticket.userId).catch(() => null);
    const nowTs = Math.floor(Date.now() / 1000);
    
    transcriptFile = await exportTranscript(ticketChannel);
    
    const logChannelId = (ticket.ticketType === 'General') ? config.transcriptChannel1 : config.transcriptChannel2;
    const logChannel = await interaction.guild?.channels.fetch(logChannelId);
    if (!(logChannel instanceof TextChannel)) throw new Error('Transcript log channel is unavailable.');
    
    const transcriptAttachment = { attachment: transcriptFile, name: `transcript_${ticketChannel.id}.html` };
    const logEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${ticket.ticketType} Ticket`,
        iconURL: interaction.guild?.iconURL() || ''
      })
      .setTitle(`${ticket.ticketNumber} | ${ticketCreator ? ticketCreator.user.username : ticket.userId}`)
      .setDescription(
        `> Ticket Deleted ➤ <t:${nowTs}:F>\n` +
        `> Deleted By ➤ <@${interaction.user.id}>\n` +
        `> Reason ➤ \`${reason}\``
      )
      .setTimestamp();
    
    const advancedButton = new ButtonBuilder()
      .setCustomId(`advanced_ticketLog_${ticket.id}`)
      .setLabel('Advanced')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚙️');
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(advancedButton);
    let logLink: string | undefined = undefined;
    if (logChannel) {
      const sent = await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [row.toJSON()] });
      logLink = `https://discord.com/channels/${interaction.guildId}/${logChannel.id}/${sent.id}`;
    }
    if (logLink) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { logMessageUrl: logLink } });
    }
    if (ticketCreator) {
      try {
        await ticketCreator.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [row.toJSON()] });
      } catch (err) {
        console.error('Failed to DM ticket creator:', err);
      }
    }
    
    await interaction.deleteReply();
    await ticketChannel.delete();
    deletedTicket = undefined;
    
  } catch (error) {
    console.error('Error in handleDeleteTicketManual:', error);
    if (deletedTicket) {
      await prisma.ticket.updateMany({
        where: { id: deletedTicket.id, status: 'deleted' },
        data: { status: deletedTicket.previousStatus },
      }).catch(rollbackError => console.error('Failed to restore ticket status:', rollbackError));
    }
    try {
      await interaction.editReply({ content: 'Failed to delete the ticket. Please try again.' });
    } catch { /* ignore cleanup errors */ }
  } finally {
    if (transcriptFile) {
      await unlink(transcriptFile).catch(error => console.error('Error deleting transcript file:', error));
    }
  }
}


export async function handleDeleteTicketAuto(interaction: ButtonInteraction): Promise<void> {
  let transcriptFile: string | undefined;
  let deletedTicket: { id: number; previousStatus: string } | undefined;
  try {
    if (!memberHasRole(interaction.member, config.staffRoleId)) {
      await interaction.reply({ content: 'You are not authorized to delete tickets.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    
    const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channel?.id } });
    if (!ticket) {
      await interaction.editReply({ content: 'Ticket not found in the database.' });
      return;
    }
    if (!(interaction.channel instanceof TextChannel)) {
      await interaction.editReply({ content: 'This action is only available in channel-based tickets.' });
      return;
    }
    const deletion = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: 'closed' },
      data: { status: 'deleted' },
    });
    if (deletion.count === 0) {
      await interaction.editReply({ content: 'This ticket is no longer available for deletion.' });
      return;
    }
    deletedTicket = { id: ticket.id, previousStatus: ticket.status };

    const ticketChannel = interaction.channel;
    const ticketCreator = await interaction.guild?.members.fetch(ticket.userId).catch(() => null);
    const nowTs = Math.floor(Date.now() / 1000);
    
    transcriptFile = await exportTranscript(ticketChannel);
    
    const logChannelId = (ticket.ticketType === 'General') ? config.transcriptChannel1 : config.transcriptChannel2;
    const logChannel = await interaction.guild?.channels.fetch(logChannelId);
    if (!(logChannel instanceof TextChannel)) throw new Error('Transcript log channel is unavailable.');
    
    const transcriptAttachment = { attachment: transcriptFile, name: `transcript_${ticketChannel.id}.html` };
    
    const autoCloseReason = !ticket.lastMessageAt 
      ? 'Ticket closed due to no initial message (15 minutes of inactivity).' 
      : 'Ticket closed due to inactivity (24 hours).';
    
    const logEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${ticket.ticketType} Ticket`,
        iconURL: interaction.guild?.iconURL() || ''
      })
      .setTitle(`${ticket.ticketNumber} | ${ticketCreator ? ticketCreator.user.username : ticket.userId}`)
      .setDescription(
        `> Ticket Deleted ➤ <t:${nowTs}:F>\n` +
        `> Deleted By ➤ <@${interaction.user.id}>\n` +
        `> Reason ➤ \`${autoCloseReason}\``
      )
      .setTimestamp();
    
    const advancedButton = new ButtonBuilder()
      .setCustomId(`advanced_ticketLog_${ticket.id}`)
      .setLabel('Advanced')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚙️');    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(advancedButton);
    let logLink: string | undefined = undefined;
    if (logChannel) {
      const sent = await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [row.toJSON()] });
      logLink = `https://discord.com/channels/${interaction.guildId}/${logChannel.id}/${sent.id}`;
    }
    if (logLink) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { logMessageUrl: logLink } });
    }
    
    if (ticketCreator) {
      try {
        await ticketCreator.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [row.toJSON()] });
      } catch (err) {
        console.error('Failed to DM ticket creator:', err);
      }
    }
    
    await interaction.deleteReply();
    await ticketChannel.delete();
    deletedTicket = undefined;
    
  } catch (error) { 
    console.error('Error in handleDeleteTicketAuto:', error);
    if (deletedTicket) {
      await prisma.ticket.updateMany({
        where: { id: deletedTicket.id, status: 'deleted' },
        data: { status: deletedTicket.previousStatus },
      }).catch(rollbackError => console.error('Failed to restore ticket status:', rollbackError));
    }
    try {
      await interaction.editReply({ content: 'Failed to delete the ticket. Please try again.' });
    } catch { /* ignore cleanup errors */ }
  } finally {
    if (transcriptFile) {
      await unlink(transcriptFile).catch(error => console.error('Error deleting transcript file:', error));
    }
  }
}
export async function handleAdvancedTicketLog(interaction: ButtonInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Expecting customId format "advanced_ticketLog_<ticketId>"
    const customId = interaction.customId; // e.g. "advanced_ticketLog_123"
    const parts = customId.split('_');
    const ticketIdStr = parts[parts.length - 1];
    const ticketId = Number.parseInt(ticketIdStr ?? '', 10);
    if (isNaN(ticketId)) {
      await interaction.editReply({ content: 'Invalid ticket ID.' });
      return;
    }
    
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      await interaction.editReply({ content: 'Ticket not found.' });
      return;
    }
    
    const guild = interaction.guild;
    const ticketCreator = await guild?.members.fetch(ticket.userId).catch(() => null);
    
    const statusEmoji = ticket.status === 'claimed'
      ? '<:claimed:1254484420556095591>'
      : '<:closed:1254484464713859192>';
    
    const createdUnix = Math.floor(new Date(ticket.createdAt).getTime() / 1000);
    
    const addedUsers: string[] = Array.isArray(ticket.added_user) ? ticket.added_user as string[] : [];
    const addedRoles: string[] = Array.isArray(ticket.added_roles) ? ticket.added_roles as string[] : [];
    
    const addedUsersField = addedUsers.length > 0
      ? addedUsers.map((id: string) => `- <@${id}>`).join('\n')
      : 'None';
    const addedRolesField = addedRoles.length > 0
      ? addedRoles.map((id: string) => `- <@&${id}>`).join('\n')
      : 'None';
    
    const iconURL = guild?.iconURL() || interaction.user.avatarURL() || undefined;
    
    const advancedEmbed = new EmbedBuilder()
      .setAuthor({ name: `Ticket#${ticket.id}`, iconURL })
      .setTitle(ticket.ticketType)
      .setDescription(
        `- <:type:1355577708284871027> Ticket Type: \`\` ${ticket.ticketType} \`\`\n` +
        `- 🆔 Ticket ID: \`\` ${ticket.id} \`\`\n` +
        `> <:creator:1289552031907844151> Created by: ${ticketCreator ? `<@${ticketCreator.user.id}>` : ticket.userId}\n` +
        `- <a:last_seen:1347936608254427229> Created:  <t:${createdUnix}:F> \n` +
        `- ${statusEmoji} \`\` ${ticket.status} \`\``
      )
      .addFields(
        { name: 'Added Users', value: addedUsersField, inline: true },
        { name: 'Added Roles', value: addedRolesField, inline: true }
      )
      .setColor(Math.floor(Math.random() * 0xffffff))
      .setFooter({ text: new Date().toLocaleString() })
      .setTimestamp();
      
    await interaction.editReply({ embeds: [advancedEmbed] });
    
  } catch (error) {
    console.error('Error in handleAdvancedTicketLog:', error);
    await interaction.editReply({ content: 'Failed to display advanced ticket information.' });
  }
}
export async function handleClaimCommand(interaction: ChatInputCommandInteraction, reason: string): Promise<void> {
  let transcriptFile: string | undefined;
  let claimedTicket: { id: number; previousStatus: string } | undefined;
  try {
    if (!memberHasRole(interaction.member, config.staffRoleId)) {
      await interaction.reply({ content: 'You are not authorized to claim tickets.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    
    const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channel?.id } });
    if (!ticket) {
      await interaction.deleteReply();
      return;
    }
    if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
      await interaction.editReply({ content: 'This action is only available in channel-based tickets.' });
      return;
    }
    const claim = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: { in: [...ACTIVE_TICKET_STATUSES] } },
      data: { status: 'claimed' },
    });
    if (claim.count === 0) {
      await interaction.editReply({ content: 'This ticket has already been processed.' });
      return;
    }
    claimedTicket = { id: ticket.id, previousStatus: ticket.status };

    const ticketChannel = interaction.channel as TextChannel;
    const ticketCreator = await interaction.guild?.members.fetch(ticket.userId).catch(() => null);
    const nowTs = Math.floor(Date.now() / 1000);
    transcriptFile = await exportTranscript(ticketChannel);
    
    const logChannelId = (ticket.ticketType === 'General') ? config.transcriptChannel1 : config.transcriptChannel2;
    const logChannel = await interaction.guild?.channels.fetch(logChannelId);
    if (!(logChannel instanceof TextChannel)) throw new Error('Transcript log channel is unavailable.');
    
    const transcriptAttachment = { attachment: transcriptFile, name: `transcript_${ticketChannel.id}.html` };
    const logEmbed = new EmbedBuilder()
      .setAuthor({
        name: `${ticket.ticketType} Ticket`,
        iconURL: interaction.guild?.iconURL() || ''
      })
      .setTitle(`${ticket.ticketNumber} | ${ticketCreator ? ticketCreator.user.username : ticket.userId}`)
      .setDescription(
        `> Ticket Claimed ➤ <t:${nowTs}:F>\n` +
        `> Claimed By ➤ <@${interaction.user.id}>\n` +
        `> Reason ➤ \`${reason}\``
      )
      .setTimestamp();
    
    const advancedButton = new ButtonBuilder()
      .setCustomId(`advanced_ticketLog_${ticket.id}`)
      .setLabel('Advanced')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚙️');
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(advancedButton);
    let logLink: string | undefined = undefined;
    if (logChannel) {
      const sent = await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [row.toJSON()] });
      logLink = `https://discord.com/channels/${interaction.guildId}/${logChannel.id}/${sent.id}`;
    }
    if (logLink) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { logMessageUrl: logLink } });
    }
    
    if (ticketCreator) {
      try {
        const dmChannel = ticketCreator.dmChannel || await ticketCreator.createDM();
        await dmChannel.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [row.toJSON()] });
      } catch (err) {
        console.error('Failed to DM ticket creator, ignoring error:', err);
      }
    }
    
    await interaction.deleteReply();
    await ticketChannel.delete();
    claimedTicket = undefined;
    
  } catch (error) {
    console.error('Error in handleClaimCommand:', error);
    if (claimedTicket) {
      await prisma.ticket.updateMany({
        where: { id: claimedTicket.id, status: 'claimed' },
        data: { status: claimedTicket.previousStatus },
      }).catch(rollbackError => console.error('Failed to restore ticket status:', rollbackError));
    }
    try {
      await interaction.editReply({ content: 'Failed to claim the ticket. Please try again.' });
    } catch { /* ignore cleanup errors */ }
  } finally {
    if (transcriptFile) {
      await unlink(transcriptFile).catch(error => console.error('Error deleting transcript file:', error));
    }
  }
}


export async function handleCloseCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  let closedTicket: { id: number; previousStatus: string } | undefined;
  try {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.followUp({ content: 'Channel not found or invalid.', ephemeral: true });
      return;
    }
    
    // Fetch ticket from DB.
    const ticket = await prisma.ticket.findFirst({ where: { channelId: channel.id } });
    if (!ticket) {
      await interaction.followUp({ content: 'Ticket not found in the database.', ephemeral: true });
      return;
    }
    const configEntry = await prisma.ticketConfig.findUnique({ where: { ticketType: ticket.ticketType } });
    if (!configEntry || !Array.isArray(configEntry.permissions)) {
      await interaction.followUp({ content: 'No permission configuration found for this ticket type.', ephemeral: true });
      return;
    }
    const allowedRoleIds = configEntry.permissions as string[];
    const guild = channel.guild;
    const newOverwrites: OverwriteResolvable[] = [
      {
        id: guild.id,
        deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      },
      ...allowedRoleIds.map(roleId => ({
        id: roleId,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
      }))
    ];
    const archivedCategoryId = getCategoryId(ticket.ticketType, true);
    if (!archivedCategoryId) {
      await interaction.followUp({ content: 'Archived category not set for this ticket type.', ephemeral: true });
      return;
    }
    const close = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: { in: [...ACTIVE_TICKET_STATUSES] } },
      data: { status: 'closed' },
    });
    if (close.count === 0) {
      await interaction.followUp({ content: 'This ticket has already been processed.', ephemeral: true });
      return;
    }
    closedTicket = { id: ticket.id, previousStatus: ticket.status };

    if (ticket.ticketMessageId) {
      const originalMsg = await channel.messages.fetch(ticket.ticketMessageId).catch(() => null);
      if (originalMsg) {
        const disabledComponents = updateButtonStates(originalMsg.components, () => true);
        await originalMsg.edit({ components: disabledComponents });
      }
    }
    await channel.edit({ permissionOverwrites: newOverwrites });
    await channel.setParent(archivedCategoryId, { lockPermissions: false });
    const closeEmbed = new EmbedBuilder()
      .setColor(0xffff00)
      .setDescription(`> 🔒 Ticket closed by <@${interaction.user.id}>`);
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('delete_ticket_manual')
        .setLabel('Delete')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌'),
      new ButtonBuilder()
        .setCustomId('reopen_ticket')
        .setLabel('Reopen')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔓')
    );
    await channel.send({ embeds: [closeEmbed], components: [buttonRow] });
    closedTicket = undefined;
    await interaction.followUp({ content: 'Ticket has been closed and archived.', ephemeral: true });
  } catch (error) {
    console.error('Error closing ticket:', error);
    if (closedTicket) {
      await prisma.ticket.updateMany({
        where: { id: closedTicket.id, status: 'closed' },
        data: { status: closedTicket.previousStatus },
      }).catch(rollbackError => console.error('Failed to restore ticket status:', rollbackError));
    }
    await interaction.followUp({ content: 'Failed to close ticket.', ephemeral: true });
  }
}
