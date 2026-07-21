// File: src/modals/partnershipModal.ts
import {
  ModalBuilder,
  TextInputBuilder,
  ActionRowBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  EmbedBuilder,
  MessageFlags 
} from 'discord.js';
import { createTicket } from '../handlers/ticketCreationDispatcher.js';
import prisma from '../utils/database.js';
import { TicketCreationBlockedError } from '../utils/ticketCreationGuard.js';

export async function showPartnershipModal(interaction: { showModal(modal: ModalBuilder): Promise<unknown> }): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('partnership_modal')
    .setTitle('Partnership Application');

  const serverNameInput = new TextInputBuilder()
    .setCustomId('server_name')
    .setLabel('Name of your server')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const inviteInput = new TextInputBuilder()
    .setCustomId('invite_link')
    .setLabel('Invite Link')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(200)
    .setRequired(true);

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Reason for partnership')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(3_000)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(serverNameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(inviteInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
  );

  await interaction.showModal(modal);
}

export async function handlePartnershipModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  
  const serverName = interaction.fields.getTextInputValue('server_name').trim();
  const inviteLink = interaction.fields.getTextInputValue('invite_link').trim();
  const reason = interaction.fields.getTextInputValue('reason').trim();
  
  let invite;
  try {
    invite = await interaction.client.fetchInvite(inviteLink);
  } catch (error) {
    console.error("Error fetching invite:", error);
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setDescription(`> The invite link provided is invalid. Please try again.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }
  
  if (!invite.guild || !invite.channel) {
    console.error("Fetched invite does not include expected properties.");
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setDescription(`> The invite link provided is missing required data. Please try again with a proper guild invite.`);
    await interaction.editReply({ embeds: [errorEmbed] });
    return;
  }
  
  const memberCount = invite.memberCount || 0;
  if (memberCount === 0) {
    console.warn("Member count is 0; this may be because the bot is not in the target guild.");
  }
  let eligibilityText = '';
  if (memberCount < 500) {
    eligibilityText = 'Small server partnership';
  } else if (memberCount >= 500 && memberCount < 1000) {
    eligibilityText = 'Eligible for Ping4Ping partnership (smaller server pricing)';
  } else {
    eligibilityText = 'Eligible for standard partnership options';
  }

  const ticketData = {
    title: 'Partnership Ticket',
    description: `Server: ${serverName}\nApproximate members: ${memberCount || 'Unknown'}\n\nReason: ${reason}`,
  };
  
  let ticketChannel;
  try {
    // Use the dispatcher to create the ticket channel or thread.
    ticketChannel = await createTicket(interaction, 'Partnership', ticketData, false);
  } catch (error) {
    console.error('Failed to create partnership ticket:', error);
    const errEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setDescription(error instanceof TicketCreationBlockedError
        ? `> ${error.userMessage}`
        : '> There was an error creating your partnership ticket. Please try again later.');
    try {
      await interaction.editReply({ embeds: [errEmbed] });
    } catch (err) {
      console.error("Error sending ticket creation failure reply:", err);
    }
    return;
  }

  await prisma.ticket.updateMany({
    where: { channelId: ticketChannel.id },
    data: { inviteLink },
  });
  
  try {
    await ticketChannel.send(`Server Invite: ${inviteLink}`);
  } catch (error) {
    console.error(`Error sending invite link message: ${error}`);
  }
  
  if (memberCount !== 0) {
    const eligibilityEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setDescription(`> You are Eligible for:\n- ${eligibilityText}`);
    try {
      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [eligibilityEmbed] });
    } catch (error) {
      console.error(`Error sending eligibility embed: ${error}`);
    }
  }
  
  try {
    await interaction.editReply({
      content: `Your partnership ticket has been created: <#${ticketChannel.id}>`
    });
  } catch (error) {
    console.error(`Error sending confirmation reply: ${error}`);
  }
}
