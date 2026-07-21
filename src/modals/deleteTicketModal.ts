import { ModalSubmitInteraction } from 'discord.js';
import { handleDeleteTicketManual } from '../handlers/ticketHandlers.js';
export async function handleDeleteTicketModal(interaction: ModalSubmitInteraction): Promise<void> {
  const reason = interaction.fields.getTextInputValue('reason');
  await handleDeleteTicketManual(interaction, reason);
}
