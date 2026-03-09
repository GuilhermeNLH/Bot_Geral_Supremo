"""
bot.py – entry point for the Discord / Trello bot.

Usage
-----
    python bot.py

Environment variables (see .env.example)
-----------------------------------------
    DISCORD_TOKEN       – Discord bot token
    TRELLO_API_KEY      – Trello API key
    TRELLO_TOKEN        – Trello user token
    TRELLO_BOARD_ID     – Target Trello board ID
    DISCORD_GUILD_ID    – (optional) guild ID for fast slash-command sync
"""

import asyncio
import logging

import discord
from discord.ext import commands

import config
from cogs.trello_commands import TrelloCommands
from utils.trello_client import TrelloClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


class BotGeral(commands.Bot):
    def __init__(self) -> None:
        intents = discord.Intents.default()
        super().__init__(command_prefix="!", intents=intents)
        self._guild_id = config.DISCORD_GUILD_ID

    async def setup_hook(self) -> None:
        trello = TrelloClient(
            api_key=config.TRELLO_API_KEY,
            token=config.TRELLO_TOKEN,
            board_id=config.TRELLO_BOARD_ID,
        )
        self.tree.add_command(TrelloCommands(trello))

        if self._guild_id:
            guild = discord.Object(id=self._guild_id)
            self.tree.copy_global_to(guild=guild)
            synced = await self.tree.sync(guild=guild)
            logger.info("Synced %d command(s) to guild %s", len(synced), self._guild_id)
        else:
            synced = await self.tree.sync()
            logger.info("Synced %d global command(s)", len(synced))

    async def on_ready(self) -> None:
        logger.info("Logged in as %s (ID: %s)", self.user, self.user.id if self.user else "?")
        await self.change_presence(
            activity=discord.Activity(
                type=discord.ActivityType.watching,
                name="o quadro Trello 📋",
            )
        )


async def main() -> None:
    async with BotGeral() as bot:
        await bot.start(config.DISCORD_TOKEN)


if __name__ == "__main__":
    asyncio.run(main())
