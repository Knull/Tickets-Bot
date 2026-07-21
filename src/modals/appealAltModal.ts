// File: src/modals/appealAltModal.ts
import { 
  ModalBuilder, 
  TextInputBuilder, 
  ActionRowBuilder, 
  TextInputStyle, 
  StringSelectMenuInteraction, 
  EmbedBuilder, 
  ModalSubmitInteraction,
} from 'discord.js';
import prisma from '../utils/database.js';
import { handlePlayerInfo } from '../handlers/ticketHandlers.js';
import { createTicket } from '../handlers/ticketCreationDispatcher.js';
import { TicketCreationBlockedError } from '../utils/ticketCreationGuard.js';

interface PikaProfile {
  lastSeen?: string | number;
  ranks?: unknown;
  clan?: { name?: string };
  rank?: unknown;
  friends?: Array<{ username?: string }>;
}

class PlayerNotFoundError extends Error {}

async function fetchPikaProfile(ign: string): Promise<PikaProfile> {
  const response = await fetch(
    `https://stats.pika-network.net/api/profile/${encodeURIComponent(ign)}`,
    { signal: AbortSignal.timeout(8_000) },
  );
  if (response.status === 404) throw new PlayerNotFoundError();
  if (!response.ok) throw new Error(`Pika API returned HTTP ${response.status}.`);

  const profile = await response.json();
  if (!profile || typeof profile !== 'object') throw new PlayerNotFoundError();
  return profile as PikaProfile;
}

function validDate(value: string | number | undefined): Date | null {
  if (value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function showAppealAltModal(interaction: StringSelectMenuInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('appeal_alt_modal')
    .setTitle('Alt Verification');
  const ignInput = new TextInputBuilder()
    .setCustomId('ign')
    .setLabel('What is your In-Game Name?')
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(16)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(ignInput)
  );

  await interaction.showModal(modal);
}

// Handle the alt appeal modal submission.
export async function handleAppealAltModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  
  const ign = interaction.fields.getTextInputValue('ign').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(ign)) {
    await interaction.editReply({ content: 'Enter a valid 3–16 character Minecraft username.' });
    return;
  }
  try {
    const profile = await fetchPikaProfile(ign);
    const friends = Array.isArray(profile.friends)
      ? profile.friends.flatMap(friend =>
          typeof friend.username === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(friend.username)
            ? [friend.username]
            : []
        )
      : [];
    
    // Upsert player's profile data
    await prisma.playerProfile.upsert({
      where: { discordUserId: interaction.user.id },
      update: {
        ign,
        lastSeen: validDate(profile.lastSeen),
        ranks: profile.ranks ?? {},
        clanName: profile.clan ? profile.clan.name : 'No Clan',
        rankInfo: profile.rank ?? {},
        friends,
      },
      create: {
        discordUserId: interaction.user.id,
        ign,
        lastSeen: validDate(profile.lastSeen),
        ranks: profile.ranks ?? {},
        clanName: profile.clan ? profile.clan.name : 'No Clan',
        rankInfo: profile.rank ?? {},
        friends,
      }
    });
    
    const configEntry = await prisma.ticketConfig.findUnique({ where: { ticketType: "Alt Appeal" } });
    const instructions = configEntry && configEntry.useCustomInstructions && configEntry.instructions
      ? configEntry.instructions
      : "Please provide your appeal details to verify your identity.";
    
    // Use "Alt Appeal" as the ticket type
    const ticketChannel = await createTicket(interaction, "Alt Appeal", { title: "Alt Appeal Ticket", description: instructions }, false);
    
    // Send player info embed
    await handlePlayerInfo(
      { channel: ticketChannel, user: interaction.user, member: interaction.member, guild: interaction.guild }
    );
    
    await interaction.editReply({ content: `Your alt appeal ticket has been created: <#${ticketChannel.id}>` });
  } catch (error) {
    console.error('Error in alt appeal:', error);
    if (error instanceof TicketCreationBlockedError) throw error;
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setDescription(error instanceof PlayerNotFoundError
        ? `> The player \`${ign}\` does not exist on Pika-Bedwars servers.\n- Please enter a valid IGN.`
        : '> Player verification is temporarily unavailable. Please try again later.');
    await interaction.editReply({ embeds: [embed] });
  }
}
