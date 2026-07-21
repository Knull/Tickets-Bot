import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  Collection,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

export interface CommandModule {
  data: {
    readonly name: string;
    toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface ExtendedClient extends Client {
  commands: Collection<string, CommandModule>;
}
