# do not change this one bit unless you know what you're doing
import discord
import chat_exporter
import argparse
import asyncio
import os

async def export_chat_range(token, channel_id, output_file, start_msg_id, end_msg_id, tz_info="UTC", military_time=False):
    intents = discord.Intents.default()
    intents.members = True
    intents.messages = True
    client = discord.Client(intents=intents)
    
    @client.event
    async def on_ready():
        try:
            channel = await client.fetch_channel(channel_id)
        except Exception as err:
            print("Error fetching channel:", err)
            await client.close()
            return
        
        try:
            start_message, end_message = await asyncio.gather(
                channel.fetch_message(int(start_msg_id)),
                channel.fetch_message(int(end_msg_id))
            )
        except Exception as err:
            print("Error fetching boundary messages:", err)
            await client.close()
            return

        messages = []
        try:
            async for msg in channel.history(
                after=start_message.created_at,
                before=end_message.created_at,
                oldest_first=True,
                limit=None
            ):
                messages.append(msg)
        except Exception as err:
            print("Error fetching messages:", err)
            await client.close()
            return

        all_messages = [start_message] + messages + [end_message]
        all_messages.sort(key=lambda m: m.created_at)
        all_messages = list(reversed(all_messages))
        
        try:
            transcript = await chat_exporter.raw_export(
                channel,
                messages=all_messages,
                tz_info=tz_info,
                military_time=military_time,
                bot=client,
                fancy_times=True
            )
        except Exception as err:
            print("Error generating transcript:", err)
            await client.close()
            return
        
        if transcript is None:
            print("Transcript generation returned None.")
        else:
            os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
            try:
                with open(output_file, "w", encoding="utf-8") as file:
                    file.write(transcript)
                print("Transcript saved to", os.path.abspath(output_file))
            except Exception as err:
                print("Error writing transcript to file:", err)
        await client.close()
    
    await client.start(token)

def main():
    parser = argparse.ArgumentParser(description="Export a Discord channel transcript for a specific message range")
    parser.add_argument(
        "--token",
        default=os.environ.get("DISCORD_TOKEN"),
        help="Discord bot token (defaults to DISCORD_TOKEN)",
    )
    parser.add_argument("--channel_id", type=int, required=True, help="Discord channel ID")
    parser.add_argument("--start", required=True, help="Start message ID (inclusive)")
    parser.add_argument("--end", required=True, help="End message ID (inclusive)")
    parser.add_argument("--output_file", required=True, help="Output file path")
    parser.add_argument("--tz_info", type=str, default="UTC", help="Timezone info")
    parser.add_argument("--military_time", action="store_true", help="Use 24-hour time format")
    args = parser.parse_args()
    if not args.token:
        parser.error("DISCORD_TOKEN or --token is required")

    asyncio.run(
        export_chat_range(args.token, args.channel_id, args.output_file,
                          args.start, args.end, args.tz_info, args.military_time)
    )

if __name__ == "__main__":
    main()
