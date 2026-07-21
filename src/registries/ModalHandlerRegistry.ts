import { 
  ModalSubmitInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
} from 'discord.js';
import { handleAppealAltModal } from '../modals/appealAltModal.js';
import { handleUniversalTicketModal } from '../modals/universalTicketModal.js';
import { handleAppealReasonModal, handleBanAppealModal } from '../modals/appealReasonModal.js';
import { handlePartnershipModal } from '../modals/partnershipModal.js'; 
import { instructionsCache } from '../utils/instructionsCache.js';
import { handleClaimTicketModal } from '../modals/claimTicketModal.js';
import { handleDeleteTicketModal } from '../modals/deleteTicketModal.js';
import { createTicket } from '../handlers/ticketCreationDispatcher.js';

export const modalRegistry: { [key: string]: (interaction: ModalSubmitInteraction) => Promise<void> } = {
  // Handles alt appeal modal submissions (custom ID should be "appeal_alt_modal")
  'appeal_alt_modal': async (interaction: ModalSubmitInteraction) => {
    await handleAppealAltModal(interaction);
  },
  // Handles universal ticket modals (custom IDs like "universal_ticket_modal_general")
  'universal_ticket_modal': async (interaction: ModalSubmitInteraction) => {
  try {
    await interaction.deferReply({ flags: 64 });
  } catch (e) {
    console.error("Error deferring modal interaction:", e);
  }
  const { ticketType, title, description } = handleUniversalTicketModal(interaction);
  await createTicket(interaction, capitalize(ticketType), { title, description });
},

  // Handles mute/strike appeal modals (custom IDs like "appeal_reason_modal_appeal_mute" or "..._appeal_strike")
  'appeal_reason_modal': async (interaction: ModalSubmitInteraction) => {
    await handleAppealReasonModal(interaction);
  },
  // Handles ban appeal modals (custom IDs like "appeal_ban_modal_screenshare_appeal" or "..._strike_ban")
  'appeal_ban_modal': async (interaction: ModalSubmitInteraction) => {
    await handleBanAppealModal(interaction);
  },
  // **Add this new entry for partnership tickets**
  'partnership_modal': async (interaction: ModalSubmitInteraction) => {
    await handlePartnershipModal(interaction);
  },
  'config_instructions_': async (interaction: ModalSubmitInteraction) => {
    // Expect customId in the format "config_instructions_{ticketType}"
    const ticketType = interaction.customId.replace('config_instructions_', '');
    const newInstructions = interaction.fields.getTextInputValue('instructions');
    const previewTitle = `${ticketType} Ticket Preview`;

    instructionsCache.set(`${interaction.user.id}_${ticketType}`, { instructions: newInstructions, previewTitle });

    const previewEmbed = new EmbedBuilder()
      .setColor(ticketType === 'Partnership' ? 0xff0000 : 0x0099FF)
      .setTitle(previewTitle)
      .setDescription(`\`\`\`\n${newInstructions}\n\`\`\``);

    const confirmButton = new ButtonBuilder()
      .setCustomId(`confirm_instructions_${ticketType}`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success);
    const cancelButton = new ButtonBuilder()
      .setCustomId(`cancel_instructions_${ticketType}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    await interaction.reply({
      content: 'Here is a preview of your updated instructions:',
      embeds: [previewEmbed],
      components: [row],
      ephemeral: true
    });
  },
  'claim_ticket': handleClaimTicketModal,
  'delete_ticket_manual': handleDeleteTicketModal
};

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
