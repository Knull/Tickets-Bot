import { ModalSubmitInteraction } from 'discord.js';
import { handleClaimTicket } from '../handlers/ticketHandlers.js';
export async function handleClaimTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  const reason = interaction.fields.getTextInputValue('reason');
  await handleClaimTicket(interaction, reason);
}
