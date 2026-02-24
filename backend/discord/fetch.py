import discord
from dotenv import load_dotenv
import os

load_dotenv()

intents = discord.Intents.default()
intents.members = True
client = discord.Client(intents=intents)

server = client.get_guild("")

def fetch_discord_data()
    data = [server.member_count, server.approximate_presence_count]
    return data

client.run(os.getenv(DISCORD_BOT_TOKEN))