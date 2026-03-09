"""
cogs/trello_commands.py – Discord slash commands for Trello integration.

Commands
--------
/listar_listas
    Lists every open list on the configured Trello board.

/listar_cards  lista:
    Lists open cards inside a specific list (identified by name).

/criar_card  lista: titulo: [descricao:] [prazo:]
    Creates a new card in the given list.
    The *descricao* field supports a simple table format:
        Campo1: valor1 | Campo2: valor2 | Campo3: valor3
    which is converted to a nicely formatted description.

/atualizar_card  card_id: [titulo:] [descricao:] [prazo:]
    Updates one or more fields of an existing card.

/mover_card  card_id: lista_destino:
    Moves a card to a different list.

/deletar_card  card_id:
    Permanently deletes a card (asks for confirmation first).
"""

from __future__ import annotations

import textwrap
from typing import TYPE_CHECKING

import discord
from discord import app_commands

from utils.trello_client import TrelloClient, TrelloError

if TYPE_CHECKING:
    pass

# ---------------------------------------------------------------------------
# Helper: parse a "table row" string into a formatted description
# ---------------------------------------------------------------------------

_TABLE_SEPARATOR = "|"


def _parse_table_format(raw: str) -> str:
    """Convert a pipe-separated key:value string into a Markdown description.

    Example input:
        "Responsável: João | Prioridade: Alta | Prazo: 2024-12-31"
    Example output:
        "**Responsável:** João\n**Prioridade:** Alta\n**Prazo:** 2024-12-31"

    If the string does not contain key:value pairs the raw text is returned
    unchanged so regular freeform descriptions still work.
    """
    if _TABLE_SEPARATOR not in raw and ":" not in raw:
        return raw

    lines: list[str] = []
    cells = raw.split(_TABLE_SEPARATOR)
    for cell in cells:
        cell = cell.strip()
        if not cell:
            continue
        if ":" in cell:
            key, _, value = cell.partition(":")
            lines.append(f"**{key.strip()}:** {value.strip()}")
        else:
            lines.append(cell)
    return "\n".join(lines) if lines else raw


# ---------------------------------------------------------------------------
# Cog
# ---------------------------------------------------------------------------


class TrelloCommands(app_commands.Group):
    """Slash-command group for managing Trello boards."""

    def __init__(self, trello: TrelloClient) -> None:
        super().__init__(name="trello", description="Gerencie seu quadro Trello pelo Discord")
        self._trello = trello

    # ------------------------------------------------------------------
    # /trello listar_listas
    # ------------------------------------------------------------------

    @app_commands.command(name="listar_listas", description="Lista todas as listas do quadro Trello")
    async def listar_listas(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        try:
            lists = self._trello.list_lists()
        except TrelloError as exc:
            await interaction.followup.send(f"❌ Erro ao buscar listas: {exc}", ephemeral=True)
            return

        if not lists:
            await interaction.followup.send("Nenhuma lista encontrada no quadro.", ephemeral=True)
            return

        embed = discord.Embed(
            title="📋 Listas do Quadro Trello",
            color=discord.Color.blue(),
        )
        for lst in lists:
            embed.add_field(name=lst["name"], value=f"`ID: {lst['id']}`", inline=False)

        await interaction.followup.send(embed=embed, ephemeral=True)

    # ------------------------------------------------------------------
    # /trello listar_cards
    # ------------------------------------------------------------------

    @app_commands.command(name="listar_cards", description="Lista os cards de uma lista específica")
    @app_commands.describe(lista="Nome da lista cujos cards deseja ver")
    async def listar_cards(self, interaction: discord.Interaction, lista: str) -> None:
        await interaction.response.defer(ephemeral=True)
        try:
            lst = self._trello.get_list_by_name(lista)
            if lst is None:
                await interaction.followup.send(
                    f"❌ Lista **{lista}** não encontrada. Use `/trello listar_listas` para ver as listas disponíveis.",
                    ephemeral=True,
                )
                return
            cards = self._trello.list_cards(lst["id"])
        except TrelloError as exc:
            await interaction.followup.send(f"❌ Erro ao buscar cards: {exc}", ephemeral=True)
            return

        if not cards:
            await interaction.followup.send(
                f"Nenhum card encontrado na lista **{lista}**.", ephemeral=True
            )
            return

        embed = discord.Embed(
            title=f"🃏 Cards em **{lst['name']}**",
            color=discord.Color.green(),
        )
        for card in cards[:25]:  # Discord embeds support up to 25 fields
            desc = textwrap.shorten(card.get("desc", "") or "—", width=100, placeholder="…")
            value = f"{desc}\n🔗 [Abrir no Trello]({card['url']})\n`ID: {card['id']}`"
            embed.add_field(name=card["name"], value=value, inline=False)

        if len(cards) > 25:
            embed.set_footer(text=f"Mostrando 25 de {len(cards)} cards.")

        await interaction.followup.send(embed=embed, ephemeral=True)

    # ------------------------------------------------------------------
    # /trello criar_card
    # ------------------------------------------------------------------

    @app_commands.command(name="criar_card", description="Cria um novo card em uma lista do Trello")
    @app_commands.describe(
        lista="Nome da lista onde o card será criado",
        titulo="Título do card",
        descricao=(
            "Descrição do card. "
            "Use o formato 'Campo: valor | Campo2: valor2' para criar uma tabela estruturada."
        ),
        prazo="Prazo do card (formato ISO 8601, ex.: 2024-12-31T23:59:00)",
    )
    async def criar_card(
        self,
        interaction: discord.Interaction,
        lista: str,
        titulo: str,
        descricao: str = "",
        prazo: str = "",
    ) -> None:
        await interaction.response.defer(ephemeral=False)
        try:
            lst = self._trello.get_list_by_name(lista)
            if lst is None:
                await interaction.followup.send(
                    f"❌ Lista **{lista}** não encontrada. Use `/trello listar_listas` para ver as listas disponíveis."
                )
                return

            formatted_desc = _parse_table_format(descricao) if descricao else ""
            card = self._trello.create_card(
                list_id=lst["id"],
                name=titulo,
                desc=formatted_desc,
                due=prazo or None,
            )
        except TrelloError as exc:
            await interaction.followup.send(f"❌ Erro ao criar card: {exc}")
            return

        embed = discord.Embed(
            title="✅ Card criado com sucesso!",
            color=discord.Color.green(),
        )
        embed.add_field(name="Título", value=card["name"], inline=True)
        embed.add_field(name="Lista", value=lst["name"], inline=True)
        if card.get("due"):
            embed.add_field(name="Prazo", value=card["due"], inline=True)
        if formatted_desc:
            embed.add_field(
                name="Descrição",
                value=textwrap.shorten(formatted_desc, width=300, placeholder="…"),
                inline=False,
            )
        embed.add_field(name="Link", value=f"[Abrir no Trello]({card['url']})", inline=False)
        embed.set_footer(text=f"ID: {card['id']}")

        await interaction.followup.send(embed=embed)

    # ------------------------------------------------------------------
    # /trello atualizar_card
    # ------------------------------------------------------------------

    @app_commands.command(name="atualizar_card", description="Atualiza título, descrição ou prazo de um card")
    @app_commands.describe(
        card_id="ID do card a ser atualizado",
        titulo="Novo título (deixe em branco para não alterar)",
        descricao="Nova descrição — suporta o formato 'Campo: valor | Campo2: valor2'",
        prazo="Novo prazo (ISO 8601, ex.: 2024-12-31T23:59:00)",
    )
    async def atualizar_card(
        self,
        interaction: discord.Interaction,
        card_id: str,
        titulo: str = "",
        descricao: str = "",
        prazo: str = "",
    ) -> None:
        await interaction.response.defer(ephemeral=False)
        if not titulo and not descricao and not prazo:
            await interaction.followup.send(
                "⚠️ Informe ao menos um campo para atualizar (título, descrição ou prazo)."
            )
            return
        try:
            formatted_desc = _parse_table_format(descricao) if descricao else None
            card = self._trello.update_card(
                card_id=card_id,
                name=titulo or None,
                desc=formatted_desc,
                due=prazo or None,
            )
        except TrelloError as exc:
            await interaction.followup.send(f"❌ Erro ao atualizar card: {exc}")
            return

        embed = discord.Embed(
            title="✅ Card atualizado com sucesso!",
            color=discord.Color.orange(),
        )
        embed.add_field(name="Título", value=card["name"], inline=True)
        if card.get("due"):
            embed.add_field(name="Prazo", value=card["due"], inline=True)
        embed.add_field(name="Link", value=f"[Abrir no Trello]({card['url']})", inline=False)
        embed.set_footer(text=f"ID: {card['id']}")

        await interaction.followup.send(embed=embed)

    # ------------------------------------------------------------------
    # /trello mover_card
    # ------------------------------------------------------------------

    @app_commands.command(name="mover_card", description="Move um card para outra lista")
    @app_commands.describe(
        card_id="ID do card a ser movido",
        lista_destino="Nome da lista de destino",
    )
    async def mover_card(
        self,
        interaction: discord.Interaction,
        card_id: str,
        lista_destino: str,
    ) -> None:
        await interaction.response.defer(ephemeral=False)
        try:
            dest = self._trello.get_list_by_name(lista_destino)
            if dest is None:
                await interaction.followup.send(
                    f"❌ Lista de destino **{lista_destino}** não encontrada. Use `/trello listar_listas` para ver as listas disponíveis."
                )
                return
            card = self._trello.move_card(card_id=card_id, dest_list_id=dest["id"])
        except TrelloError as exc:
            await interaction.followup.send(f"❌ Erro ao mover card: {exc}")
            return

        embed = discord.Embed(
            title="✅ Card movido com sucesso!",
            color=discord.Color.blurple(),
        )
        embed.add_field(name="Título", value=card["name"], inline=True)
        embed.add_field(name="Nova lista", value=dest["name"], inline=True)
        embed.add_field(name="Link", value=f"[Abrir no Trello]({card['url']})", inline=False)
        embed.set_footer(text=f"ID: {card['id']}")

        await interaction.followup.send(embed=embed)

    # ------------------------------------------------------------------
    # /trello deletar_card
    # ------------------------------------------------------------------

    @app_commands.command(name="deletar_card", description="Deleta permanentemente um card do Trello")
    @app_commands.describe(card_id="ID do card a ser deletado")
    async def deletar_card(
        self,
        interaction: discord.Interaction,
        card_id: str,
    ) -> None:
        # Show a confirmation button before actually deleting
        view = _ConfirmDeleteView(trello=self._trello, card_id=card_id)
        await interaction.response.send_message(
            f"⚠️ Tem certeza que deseja deletar permanentemente o card `{card_id}`?",
            view=view,
            ephemeral=True,
        )


# ---------------------------------------------------------------------------
# Confirmation view for delete
# ---------------------------------------------------------------------------


class _ConfirmDeleteView(discord.ui.View):
    def __init__(self, trello: TrelloClient, card_id: str) -> None:
        super().__init__(timeout=30)
        self._trello = trello
        self._card_id = card_id

    @discord.ui.button(label="Confirmar", style=discord.ButtonStyle.danger, emoji="🗑️")
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        try:
            self._trello.delete_card(self._card_id)
        except TrelloError as exc:
            await interaction.response.edit_message(
                content=f"❌ Erro ao deletar card: {exc}", view=None
            )
            return
        await interaction.response.edit_message(
            content=f"✅ Card `{self._card_id}` deletado com sucesso.", view=None
        )
        self.stop()

    @discord.ui.button(label="Cancelar", style=discord.ButtonStyle.secondary, emoji="✖️")
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
        await interaction.response.edit_message(content="❎ Operação cancelada.", view=None)
        self.stop()
