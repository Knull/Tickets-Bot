import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import prisma from '../utils/database.js';
import config from '../config/config.js';
import { parseDuration } from '../utils/ticketPolicy.js';
import { memberHasRole } from '../utils/memberRoles.js';

const data = new SlashCommandBuilder()
  .setName('ticket_blacklist')
  .setDescription('Prevent a user from opening tickets')
  .addUserOption(opt =>
    opt.setName('user').setDescription('User to blacklist').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('duration').setDescription('Duration (e.g. 1d, 2h). Optional')
  );

async function execute(interaction: ChatInputCommandInteraction) {
  if (!memberHasRole(interaction.member, config.adminRoleId)) {
    await interaction.reply({ content: `Only <@&${config.adminRoleId}> can use this command.`, ephemeral: true });
    return;
  }

  const target = interaction.options.getUser('user', true);
  const durationStr = interaction.options.getString('duration');
  let expiresAt: Date | null = null;
  if (durationStr) {
    const ms = parseDuration(durationStr);
    if (ms === null) {
      await interaction.reply({
        content: 'Invalid duration. Use a positive value followed by s, m, h, d, or w (for example, `2d`).',
        ephemeral: true,
      });
      return;
    }
    expiresAt = new Date(Date.now() + ms);
  }

  await prisma.ticketBlacklist.upsert({
    where: { userId: target.id },
    update: { expiresAt },
    create: { userId: target.id, expiresAt }
  });

  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setDescription(`> Blacklisted <@${target.id}> from opening any tickets`);
  await interaction.reply({ embeds: [embed] });
}

export default { data, execute };
