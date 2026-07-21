import { MessageFlags } from 'discord.js';
import type { Client, Interaction } from 'discord.js';
import type { ExtendedClient } from '../types/ExtendedClient.js';
import { TicketCreationBlockedError } from '../utils/ticketCreationGuard.js';

export async function registerInteractions(client: Client, interaction: Interaction): Promise<void> {
  try {
    await dispatchInteraction(client as ExtendedClient, interaction);
  } catch (error) {
    console.error(`Interaction ${interaction.id} failed:`, error);
    if (!interaction.isRepliable()) return;

    const content = error instanceof TicketCreationBlockedError
      ? error.userMessage
      : 'There was an error handling that interaction. Please try again.';

    try {
      if (interaction.deferred) {
        await interaction.editReply({ content, embeds: [], components: [] });
      } else if (interaction.replied) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    } catch (replyError) {
      console.error(`Could not report interaction ${interaction.id} failure:`, replyError);
    }
  }
}

async function dispatchInteraction(client: ExtendedClient, interaction: Interaction): Promise<void> {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      await command.autocomplete(interaction);
    }
    return;
  }

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) throw new Error(`No command registered for ${interaction.commandName}.`);
    await command.execute(interaction);
    return;
  }

  if (interaction.isButton()) {
    const { ButtonHandlerRegistry } = await import('../registries/ButtonHandlerRegistry.js');
    const entry = Object.entries(ButtonHandlerRegistry).find(([prefix]) =>
      interaction.customId.startsWith(prefix)
    );
    if (!entry) throw new Error(`Unhandled button interaction: ${interaction.customId}`);
    await entry[1](interaction, client);
    return;
  }

  if (interaction.isModalSubmit()) {
    const { modalRegistry } = await import('../registries/ModalHandlerRegistry.js');
    const entry = Object.entries(modalRegistry).find(([prefix]) =>
      interaction.customId.startsWith(prefix)
    );
    if (!entry) throw new Error(`Unhandled modal interaction: ${interaction.customId}`);
    await entry[1](interaction);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const { StringSelectHandlers } = await import('../registries/DropdownHandlerRegistry.js');
    const entry = Object.entries(StringSelectHandlers).find(([prefix]) =>
      interaction.customId.startsWith(prefix)
    );
    if (!entry) throw new Error(`Unhandled select interaction: ${interaction.customId}`);
    await entry[1](interaction);
  }
}
