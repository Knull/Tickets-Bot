import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { handleCloseCommand } from '../handlers/ticketHandlers.js';
import { handleCloseThreadCommand } from '../handlers/threadTicketHandlers.js';

const data = new SlashCommandBuilder()
  .setName('close')
  .setDescription('Close the ticket (works for both channel-based and thread-based tickets)');

async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Existing tickets remain closable after an administrator changes the
    // creation mode. Route by the current channel, not the global setting.
    if (interaction.channel?.isThread()) {
      await handleCloseThreadCommand(interaction);
    } else {
      await handleCloseCommand(interaction);
    }
  } catch (error) {
    console.error('Error executing close command:', error);
    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply({ content: 'An error occurred while closing the ticket.', ephemeral: true });
    } else {
      await interaction.followUp({ content: 'An error occurred while closing the ticket.', ephemeral: true });
    }
  }
}

export default { data, execute };
