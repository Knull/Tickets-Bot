import { ButtonInteraction, Client, MessageFlags, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } from 'discord.js';
import prisma from '../utils/database.js';
import { showPartnershipModal } from '../modals/partnershipModal.js';
import { handleCreateGeneralTicket } from '../handlers/createTicketHandlers.js';
import { showInitialAppealDropdown } from '../dropdowns/appealDropdown.js';
import { instructionsCache } from '../utils/instructionsCache.js';
import { confirmTicketConfigPermissions, cancelTicketConfigPermissions } from '../handlers/ticketPermissionHandlers.js'
import { handleCloseTicket, handleReopenTicket, handleDeleteTicketAuto, handleAdvancedTicketLog } from '../handlers/ticketHandlers.js';
import config from '../config/config.js';
import { createTicket } from '../handlers/ticketCreationDispatcher.js';
import {
  handleTicketToggleButton,
  handleTicketToggleConfirm,
  handleTicketToggleCancel,
} from '../slash_commands/ticketToggleCommand.js';
import { handleCloseThread, handleReopenThread } from '../handlers/threadTicketHandlers.js';
import { getTicketCreationBlockReason } from '../utils/ticketCreationGuard.js';
import { memberHasRole } from '../utils/memberRoles.js';

async function checkTicketLimit(interaction: ButtonInteraction): Promise<boolean> {
  try {
    const blockReason = await getTicketCreationBlockReason(interaction.user.id);
    if (blockReason) {
      if (interaction.deferred) {
        await interaction.editReply({ content: blockReason, embeds: [], components: [] });
      } else if (interaction.replied) {
        await interaction.followUp({ content: blockReason, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: blockReason, flags: MessageFlags.Ephemeral });
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error checking ticket limit:', error);
    const content = 'Ticket availability could not be checked. Please try again shortly.';
    if (interaction.deferred) {
      await interaction.editReply({ content, embeds: [], components: [] }).catch(() => undefined);
    } else if (interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
    }
    return true;
  }
}

export const ButtonHandlerRegistry: Record<string, (interaction: ButtonInteraction, client: Client) => Promise<void>> = {
  'create_general': async (interaction, client) => {
  try {
    if (await checkTicketLimit(interaction)) return;
    // Otherwise, show the modal immediately.
    await handleCreateGeneralTicket(interaction, client);
  } catch (error) {
    console.error('Error checking ticket limit in create_general:', error);
    try {
      await interaction.reply({ 
        content: 'There was an error checking your ticket limit. Please try again later.',
        flags: 64
      });
    } catch (err) {
      console.error('Error sending error reply:', err);
    }
  }
},

'create_appeal': async (interaction, client) => {
    try {
      await interaction.deferReply({ flags: 64 });
    } catch (err) {
      console.error("Error deferring interaction in create_appeal handler:", err);
      return;
    }
    if (await checkTicketLimit(interaction)) return;
    try {
      await showInitialAppealDropdown(interaction, true);
    } catch (err) {
      console.error("Error showing appeal dropdown:", err);
    }
  },
  
  // Store ticket creation button
  'create_store': async (interaction, client) => {
    try {
      await interaction.deferReply({ flags: 64 });
    } catch (err) {
      console.error("Error deferring interaction in create_store handler:", err);
      return;
    }
    if (await checkTicketLimit(interaction)) return;
    try {
      const data = { 
        title: 'Store Purchase', 
        description: "Once you're done selecting a product, please describe your payment method and any questions you have."
      };
      const ticketChannel = await createTicket(interaction, 'Store', data, false);
      await interaction.followUp({ 
        content: `Your ticket has been opened. Head over to <#${ticketChannel.id}> to continue.`,
        flags: 64
      });
    } catch (e) {
      console.error('Error creating store ticket:', e);
      try {
        await interaction.followUp({ content: 'Failed to create store ticket. Please try again later.', flags: 64 });
      } catch (err) {
        console.error('Error editing store ticket reply:', err);
      }
    }
  },

  // Partnership ticket creation button
  'create_partnership': async (interaction, client) => {
  try {
    if (await checkTicketLimit(interaction)) return;
    // If under limit, immediately show the partnership modal.
    await showPartnershipModal(interaction);
  } catch (error) {
    console.error('Error in create_partnership button handler:', error);
    try {
      await interaction.reply({ 
        content: 'There was an error checking your ticket limit. Please try again later.',
        flags: 64
      });
    } catch (err) {
      console.error('Error replying to create_partnership error:', err);
    }
  }
},

  
  // Other handlers such as 'close_ticket', 'claim_ticket', etc.
  'close_ticket': async (interaction, client) => {
    await handleCloseTicket(interaction);
  },

  'delete_ticket_manual': async (interaction, client) => {
    if (!memberHasRole(interaction.member, config.staffRoleId)) {
      await interaction.reply({ content: 'You are not authorized to delete tickets.', ephemeral: true });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId('delete_ticket_manual')
      .setTitle('Delete Ticket Reason');
    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Please provide a reason:')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
    await interaction.showModal(modal);
  },
  'claim_ticket': async (interaction, client) => {
    if (!memberHasRole(interaction.member, config.staffRoleId)) {
      await interaction.reply({ content: 'You are not authorized to claim tickets.', ephemeral: true });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId('claim_ticket')
      .setTitle('Claim Ticket Reason');
    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Please provide a reason:')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
    await interaction.showModal(modal);
  },
  'delete_ticket_auto': async (interaction, client) => {
    await handleDeleteTicketAuto(interaction);
  },
  'confirm_instructions_': async (interaction: ButtonInteraction, client: Client) => {
    const ticketType = interaction.customId.replace('confirm_instructions_', '');
    const cacheKey = `${interaction.user.id}_${ticketType}`;
    const cached = instructionsCache.get(cacheKey);
    
    if (!cached) {
      // Fallback: if cache not found, attempt to extract from embed.
      const embed = interaction.message.embeds[0];
      if (!embed) {
        await interaction.update({
          content: 'This instructions preview expired. Please run the configuration command again.',
          embeds: [],
          components: [],
        });
        return;
      }
      const newPreviewTitle = embed.title || `${ticketType} Ticket Preview`;
      const newInstructions = embed.description ? embed.description.replace(/```/g, '').trim() : '';
      instructionsCache.set(cacheKey, { instructions: newInstructions, previewTitle: newPreviewTitle });
    }

    const { instructions, previewTitle } = instructionsCache.get(cacheKey)!;

    try {
      await prisma.ticketConfig.upsert({
        where: { ticketType },
        update: { instructions, previewTitle, useCustomInstructions: true },
        create: { 
          ticketType, 
          instructions, 
          previewTitle, 
          useCustomInstructions: true,
          allowCustomInstructions: true 
        },
      });
      // Remove the cache entry upon successful update.
      instructionsCache.delete(cacheKey);
      await interaction.update({
        content: `Custom instructions for ${ticketType} tickets have been updated.`,
        embeds: [],
        components: []
      });
    } catch (error) {
      console.error('Error updating custom instructions:', error);
      await interaction.update({
        content: 'There was an error updating the custom instructions.',
        embeds: [],
        components: []
      });
    }
  },

  // Cancel custom instructions update handler.
  'cancel_instructions_': async (interaction: ButtonInteraction, client: Client) => {
    const ticketType = interaction.customId.replace('cancel_instructions_', '');
    const cacheKey = `${interaction.user.id}_${ticketType}`;
    instructionsCache.delete(cacheKey);
    await interaction.update({
      content: `Operation cancelled. Custom instructions for ${ticketType} tickets were not updated.`,
      embeds: [],
      components: []
    });
  },
  'confirm_permissions_': confirmTicketConfigPermissions,
  'cancel_permissions_': cancelTicketConfigPermissions,
  'advanced_ticketLog': async (interaction, client) => {
    await handleAdvancedTicketLog(interaction);
  },
  'reopen_ticket' : handleReopenTicket,

  'ticket_toggle_ping_yes': async (interaction, client) => {
    await handleTicketToggleButton(interaction);
  },
  'ticket_toggle_ping_no': async (interaction, client) => {
    await handleTicketToggleButton(interaction);
  },
  'ticket_toggle_confirm_yes': async (interaction, client) => {
    await handleTicketToggleConfirm(interaction);
  },
  'ticket_toggle_confirm_no': async (interaction, client) => {
    await handleTicketToggleConfirm(interaction);
  },
  'ticket_toggle_cancel': async (interaction, client) => {
    await handleTicketToggleCancel(interaction);
  },
  'close_thread': handleCloseThread,
  'reopen_thread': handleReopenThread
  
};
