// src/dropdowns/appealDropdown.ts
import {
  StringSelectMenuInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder
} from 'discord.js';

export async function showInitialAppealDropdown(
  interaction: any,
  useEditReply = false
): Promise<void> {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('appeal_initial')
    .setPlaceholder('Select the punishment type you want to appeal')
    .addOptions([
      {
        label: 'Appeal a Ban',
        description: 'Appeal a ban',
        value: 'appeal_ban',
        emoji: '🔨'
      },
      {
        label: 'Appeal a Strike',
        description: 'Appeal a strike',
        value: 'appeal_strike',
        emoji: '⚖️'
      },
      {
        label: 'Appeal a Mute',
        description: 'Appeal a mute',
        value: 'appeal_mute',
        emoji: '🔇'
      }
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('Appeal Ticket')
    .setDescription('Choose the punishment type you want to appeal.');

  if (useEditReply) {
    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  } else {
    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }
}

export async function showBanTypeDropdown(interaction: StringSelectMenuInteraction): Promise<void> {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ban_type')
    .setPlaceholder('Select the type of ban')
    .addOptions([
      {
        label: 'ScreenShare Ban Appeal',
        description: 'Appeal a screenshare ban',
        value: 'screenshare_appeal',
        emoji: '📹'
      },
      {
        label: 'Strike that led to a Ban',
        description: 'Appeal a strike that led to a ban',
        value: 'strike_ban',
        emoji: '⚖️'
      },
      {
        label: 'Banned for being an alt',
        description: 'Appeal for being banned as an alt',
        value: 'banned_alt',
        emoji: '🤖'
      }
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Choose Ban Type')
    .setDescription('Select the type of ban you wish to appeal.');
    
  await interaction.update({ embeds: [embed], components: [row] });
}
