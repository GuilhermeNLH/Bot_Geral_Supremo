"""
config.py – loads environment variables required by the bot.
"""

import os
from dotenv import load_dotenv

load_dotenv()

DISCORD_TOKEN: str = os.environ["DISCORD_TOKEN"]
TRELLO_API_KEY: str = os.environ["TRELLO_API_KEY"]
TRELLO_TOKEN: str = os.environ["TRELLO_TOKEN"]
TRELLO_BOARD_ID: str = os.environ["TRELLO_BOARD_ID"]

# Optional: sync slash-commands only to a specific guild (faster during development)
DISCORD_GUILD_ID: int | None = (
    int(os.environ["DISCORD_GUILD_ID"]) if os.environ.get("DISCORD_GUILD_ID") else None
)
