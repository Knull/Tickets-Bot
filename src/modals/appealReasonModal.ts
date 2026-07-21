import { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, ModalSubmitInteraction } from 'discord.js';
import { createTicket } from '../handlers/ticketCreationDispatcher.js';
/**
 * Shows the modal for appeal reasons for mute or strike appeals.
 */
export async function showAppealReasonModal(interaction: { showModal(modal: ModalBuilder): Promise<unknown> }, appealType: 'appeal_mute' | 'appeal_strike'): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`appeal_reason_modal_${appealType}`)
    .setTitle(appealType === 'appeal_mute' ? 'Mute Appeal' : 'Strike Appeal');

  const label = appealType === 'appeal_mute'
    ? 'Why should you be unmuted?'
    : 'Why should we revert your strike?';
  
  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel(label)
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(3_500)
    .setRequired(true);
    
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  await interaction.showModal(modal);
}

/**
 * Shows the modal for ban appeals.
 */
export async function showBanAppealModal(interaction: { showModal(modal: ModalBuilder): Promise<unknown> }, banType: 'screenshare_appeal' | 'strike_ban'): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`appeal_ban_modal_${banType}`)
    .setTitle('Ban Appeal');
    
  const label = 'Why should you be unbanned?';
  
  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel(label)
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(3_500)
    .setRequired(true);
    
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  await interaction.showModal(modal);
}

/**
 * Handler for the Mute/Strike Appeal modal submission.
 */
export async function handleAppealReasonModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  // Extract the appeal type from the custom ID
  // Expected customId format: "appeal_reason_modal_appeal_strike" or "appeal_reason_modal_appeal_mute"
  const customId = interaction.customId;
  const appealType = customId.split('_').slice(-2).join('_'); // yields "appeal_strike" or "appeal_mute"
  const reason = interaction.fields.getTextInputValue('reason').trim();

  if (reason.split(/\s+/).length < 10) {
    await interaction.editReply({ content: 'Please provide at least 10 words.' });
    return;
  }

  // Determine the ticket type based on appeal type
  const ticketType = appealType === 'appeal_mute' ? 'Mute Appeal' : 'Strike Appeal';

  // Use the dispatcher to create the ticket.
  await createTicket(interaction, ticketType, { title: ticketType, description: reason }, true);
}

/**
 * Handler for the Ban Appeal modal submission
 */
export async function handleBanAppealModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  // Extract ban type from the custom ID.
  // Expected customId format: "appeal_ban_modal_<banType>"
  const customId = interaction.customId; // e.g. "appeal_ban_modal_screenshare_appeal"
  const banType = customId.replace('appeal_ban_modal_', '');
  
  const reason = interaction.fields.getTextInputValue('reason').trim();
  if (reason.split(/\s+/).length < 10) {
    await interaction.editReply({ content: 'Please provide at least 10 words.' });
    return;
  }

  // For ban appeals, I use "Ban Appeal" as the base ticket type.
  const ticketType = "Ban Appeal";
  await createTicket(interaction, ticketType, { title: ticketType, description: reason, banType }, true);
}
