import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { handleClaimCommand } from '../handlers/ticketHandlers.js';

const data = new SlashCommandBuilder()
  .setName('claim')
  .setDescription('Claim the ticket with a provided reason (only available for channel-based tickets)')
  .addStringOption(option =>
    option
      .setName('reason')
      .setDescription('The reason for claiming the ticket')
      .setRequired(true)
  );

async function execute(interaction: ChatInputCommandInteraction) {
  if (interaction.channel?.isThread()) {
    await interaction.reply({ 
      content: 'Claim is only available for channel-based tickets.',
      ephemeral: true 
    });
    return;
  }

  const reason = interaction.options.getString('reason', true);

  try {
    await handleClaimCommand(interaction, reason);
  } catch (error) {
    console.error('Error executing claim command:', error);
    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply({ content: 'An error occurred while claiming the ticket.', ephemeral: true });
    } else {
      await interaction.followUp({ content: 'An error occurred while claiming the ticket.', ephemeral: true });
    }
  }
}

export default { data, execute };
