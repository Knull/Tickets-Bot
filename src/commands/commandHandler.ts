import { REST, Routes } from 'discord.js';
import config from '../config/config.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CommandModule, ExtendedClient } from '../types/ExtendedClient.js';

const currentFile = fileURLToPath(import.meta.url);
const commandsPath = path.join(path.dirname(currentFile), '../slash_commands');
const runtimeExtension = path.extname(currentFile);

export async function registerCommands(client: ExtendedClient): Promise<void> {
  const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => path.extname(file) === runtimeExtension)
    .sort();
  const commands = [];

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const commandModule = await import(pathToFileURL(filePath).href) as {
      default?: CommandModule;
    } & Partial<CommandModule>;
    const command = commandModule.default ?? commandModule as CommandModule;
    if (!command.data || typeof command.execute !== 'function') {
      throw new Error(`Invalid command module: ${file}`);
    }
    commands.push(command.data.toJSON());
    client.commands.set(command.data.name, command);
  }

  const rest = new REST({ version: '10' }).setToken(config.token);
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands },
  );
  console.info(`Registered ${commands.length} guild commands.`);
}
