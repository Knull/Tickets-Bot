import { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, ModalSubmitInteraction } from 'discord.js';

export async function showUniversalTicketModal(interaction: { showModal(modal: ModalBuilder): Promise<unknown> }, ticketType: string): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`universal_ticket_modal_${ticketType.toLowerCase()}`)
    .setTitle(`${ticketType} Ticket`);
  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Ticket Title')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);
  const descInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Describe your issue')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(3_500)
    .setRequired(true);
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
  );
  await interaction.showModal(modal);
}

export function handleUniversalTicketModal(interaction: ModalSubmitInteraction) {
  const ticketType = interaction.customId.replace('universal_ticket_modal_', '');
  const title = interaction.fields.getTextInputValue('title');
  const description = interaction.fields.getTextInputValue('description');
  return { ticketType, title, description };
}
