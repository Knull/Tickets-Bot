import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../utils/database.js';
import config from '../config/config.js';
import { memberHasRole } from '../utils/memberRoles.js';

const data = new SlashCommandBuilder()
  .setName('user-tickets')
  .setDescription('View tickets created by a user')
  .addUserOption(opt =>
    opt.setName('user').setDescription('Target user').setRequired(true)
  );

async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user', true);
  if (!memberHasRole(interaction.member, config.staffRoleId)) {
    await interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const tickets = await prisma.ticket.findMany({
    where: { userId: target.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  if (tickets.length === 0) {
    await interaction.editReply({ content: 'No tickets found for this user.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00ae86)
    .setAuthor({ name: `Tickets for ${target.tag}`, iconURL: target.displayAvatarURL() });

  for (const t of tickets) {
    const created = Math.floor(new Date(t.createdAt).getTime() / 1000);
    const logLink = t.logMessageUrl ? `[View Log](${t.logMessageUrl})` : 'No log';
    embed.addFields({
      name: `#${t.ticketNumber} | ${t.ticketType}`,
      value: `Status: \`${t.status}\`\nCreated: <t:${created}:F>\n${logLink}`
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
