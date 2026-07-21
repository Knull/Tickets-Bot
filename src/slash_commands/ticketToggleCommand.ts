import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ButtonInteraction,
  } from 'discord.js';
  import { setTicketMode, TicketMode } from '../utils/ticketModeSettings.js';
  import config from '../config/config.js';
  import { memberHasAnyRole } from '../utils/memberRoles.js';

  const allowedRoleIds = [config.adminRoleId, config.managerRoleId, config.ownerRoleId] as const;

  function isAuthorized(interaction: ChatInputCommandInteraction | ButtonInteraction): boolean {
    return memberHasAnyRole(interaction.member, allowedRoleIds);
  }
  
  const data = new SlashCommandBuilder()
    .setName('ticket-toggle')
    .setDescription('Toggle ticketing system mode between channel based and thread based.')
    .addStringOption(opt =>
      opt
        .setName('mode')
        .setDescription('Choose ticketing mode: thread based or channel based')
        .setRequired(true)
        .addChoices(
          { name: 'thread based', value: 'thread' },
          { name: 'channel based', value: 'channel' }
        )
    );
  
  async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isAuthorized(interaction)) {
      await interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const modeOption = interaction.options.getString('mode', true);
  
    if (modeOption === 'channel') {
      await setTicketMode(TicketMode.CHANNEL_BASED, false);
      await interaction.editReply({ content: 'Ticketing mode has been set to **channel based**.' });
    } else if (modeOption === 'thread') {
      const queryEmbed = new EmbedBuilder()
        .setTitle('Query 1')
        .setDescription(
          'Should the bot ping the roles associated with the channel?\n\n' +
            'Example: If @testrole is in the channel permissions config, should they be pinged when a ticket is created?'
        );
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_toggle_ping_yes')
          .setLabel('Yes')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ticket_toggle_ping_no')
          .setLabel('No')
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({
        content: 'Please select whether to ping roles when a ticket is created:',
        embeds: [queryEmbed],
        components: [row],
      });
    }
  }
  
  async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    await interaction.respond([]);
  }
  
  /**
   * Handles the initial button click for the ping query
   */
  export async function handleTicketToggleButton(interaction: ButtonInteraction): Promise<void> {
    if (!isAuthorized(interaction)) {
      await interaction.reply({ content: 'You are not authorized to perform this action.', ephemeral: true });
      return;
    }
  
    const customId = interaction.customId; // 'ticket_toggle_ping_yes' or 'ticket_toggle_ping_no'
    const pingRoles = customId === 'ticket_toggle_ping_yes';
  
    const confirmEmbed = new EmbedBuilder()
      .setTitle('Confirm Ticket Toggle')
      .setDescription(`Set ticketing mode to **thread based** with role ping ${pingRoles ? 'enabled' : 'disabled'}?`);
    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_toggle_confirm_${pingRoles ? 'yes' : 'no'}`)
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_toggle_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
    await interaction.update({
      content: 'Please confirm your selection:',
      embeds: [confirmEmbed],
      components: [confirmRow],
    });
  }
  
  /**
   * Handles the confirmation button interaction.
   */
  export async function handleTicketToggleConfirm(interaction: ButtonInteraction): Promise<void> {
    if (!isAuthorized(interaction)) {
      await interaction.reply({ content: 'You are not authorized.', ephemeral: true });
      return;
    }
    const customId = interaction.customId; // 'ticket_toggle_confirm_yes' or 'ticket_toggle_confirm_no'
    const pingRoles = customId.includes('yes');
    await setTicketMode(TicketMode.THREAD_BASED, pingRoles);
    await interaction.update({
      content: `Ticketing mode has been set to **thread based** with role ping ${pingRoles ? 'enabled' : 'disabled'}.`,
      embeds: [],
      components: [],
    });
  }
  
  /**
   * Handles cancellation of the ticket toggle operation.
   */
  export async function handleTicketToggleCancel(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({ content: 'Ticket toggle operation cancelled.', embeds: [], components: [] });
  }

  export default { data, execute, autocomplete };
