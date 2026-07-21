import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import type { TextChannel } from 'discord.js';
import config from '../config/config.js';

const execFileAsync = promisify(execFile);

export async function exportTranscript(channel: TextChannel): Promise<string> {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sortedMessages = [...messages.values()].sort(
    (left, right) => left.createdTimestamp - right.createdTimestamp,
  );
  const firstMessageId = sortedMessages[0]?.id;
  const lastMessageId = sortedMessages.at(-1)?.id;
  if (!firstMessageId || !lastMessageId) {
    throw new Error('Cannot export an empty ticket channel.');
  }

  const outputFile = `transcripts/transcript_${channel.id}_${Date.now()}.html`;
  const { stderr } = await execFileAsync(
    config.pythonExecutable,
    [
      'src/transcripts/script.py',
      '--channel_id', channel.id,
      '--start', firstMessageId,
      '--end', lastMessageId,
      '--output_file', outputFile,
    ],
    {
      env: { ...process.env, DISCORD_TOKEN: config.token },
      timeout: 120_000,
      maxBuffer: 1_048_576,
    },
  );

  if (stderr.trim()) {
    console.warn('Transcript exporter wrote to stderr:', stderr.trim());
  }
  await access(outputFile);
  return outputFile;
}
