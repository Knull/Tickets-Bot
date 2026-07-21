import { ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { RoleSelectCache } from '../utils/roleSelectCache.js';
import config from '../config/config.js';

export async function handleTicketConfigPermissions(interaction: ChatInputCommandInteraction): Promise<void> {
  const ticketType = interaction.options.getString('tickettype', true);
  if (!interaction.guild) {
    await interaction.editReply({ content: 'Guild not found' });
    return;
  }
  const roles = await interaction.guild.roles.fetch();
  
  const emojiPool = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇",
    "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚",
    "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩"
  ];
  
  const options = config.configurableRoleIds.map(roleId => {
    const role = roles.get(roleId);
    if (!role) return null;
    let label = role.name;
    if (label.length > 25) {
      label = label.substring(0, 22) + '...';
    }
    const memberCount = role.members.size;
    const randomEmoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];
    
    return {
      label,
      value: role.id,
      description: `${memberCount} members`,
      emoji: { name: randomEmoji }
    };
  }).filter(o => o !== null) as { label: string; value: string; description: string; emoji?: { name: string; id?: string } }[];

  if (options.length === 0) {
    await interaction.editReply({
      content: 'None of the configurable roles exist in this guild. Check `CONFIGURABLE_ROLE_IDS`.',
    });
    return;
  }
  
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`config_permissions_${ticketType}`)
    .setPlaceholder(`Select roles for ${ticketType} tickets`)
    .addOptions(options)
    .setMinValues(0)
    .setMaxValues(Math.min(options.length, 25));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const embed = {
    title: "Permissions Config",
    description: `- Ticket Type: \`${ticketType}\`\n> Use the dropdown below to adjust permissions.`,
  };

  await interaction.editReply({ embeds: [embed], components: [row]});
}
export async function handleConfigPermissions(interaction: StringSelectMenuInteraction): Promise<void> {
  const ticketType = interaction.customId.replace('config_permissions_', '');
  const selectedRoleIds = interaction.values;
  const cacheKey = `${interaction.user.id}_${ticketType}`;
  RoleSelectCache.set(cacheKey, selectedRoleIds);

  const rolesMap = await interaction.guild?.roles.fetch();
  const rolesArray = rolesMap ? Array.from(rolesMap.values()) : [];
  const selectedRoles = rolesArray.filter(role => selectedRoleIds.includes(role.id));
  const roleNames = selectedRoles.map(role => role.name).join(', ') || 'None';

  const updatedEmbed = new EmbedBuilder()
    .setTitle("Permissions Config")
    .setDescription(
      `- Ticket Type: \`${ticketType}\`\n> Use the dropdown below to adjust permissions.\n\n\`\`\`Roles Selected:\n${roleNames}\n\`\`\``
    );

  const confirmButton = new ButtonBuilder()
    .setCustomId(`confirm_permissions_${ticketType}`)
    .setLabel('Confirm')
    .setStyle(ButtonStyle.Success);

  const cancelButton = new ButtonBuilder()
    .setCustomId(`cancel_permissions_${ticketType}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger);

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

  await interaction.update({ embeds: [updatedEmbed], components: [buttonRow] });
}
