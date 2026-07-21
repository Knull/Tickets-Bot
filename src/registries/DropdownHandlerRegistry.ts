import { 
  StringSelectMenuInteraction
} from 'discord.js';
import { showBanTypeDropdown } from '../dropdowns/appealDropdown.js';
import { showAppealReasonModal, showBanAppealModal } from '../modals/appealReasonModal.js';
import { showAppealAltModal } from '../modals/appealAltModal.js';
import { handleConfigPermissions } from '../commands/ticketConfigPermissions.js';

// Handlers for string select menus
export const StringSelectHandlers: { [key: string]: (interaction: StringSelectMenuInteraction) => Promise<void> } = {
  'appeal_initial': async (interaction: StringSelectMenuInteraction) => {
    const selected = interaction.values[0];
    if (selected === 'appeal_ban') {
      await showBanTypeDropdown(interaction);
    } else if (selected === 'appeal_strike' || selected === 'appeal_mute') {
      await showAppealReasonModal(interaction, selected as 'appeal_mute' | 'appeal_strike');
    } else {
      await interaction.update({ content: "Invalid selection.", components: [] });
    }
  },
  'ban_type': async (interaction: StringSelectMenuInteraction) => {
    const selected = interaction.values[0];
    if (selected === 'banned_alt') {
      await showAppealAltModal(interaction);
    } else if (selected === 'screenshare_appeal' || selected === 'strike_ban') {
      await showBanAppealModal(interaction, selected as 'screenshare_appeal' | 'strike_ban');
    } else {
      await interaction.update({ content: "Invalid selection.", components: [] });
    }
  },
  'config_permissions_': handleConfigPermissions,

};
