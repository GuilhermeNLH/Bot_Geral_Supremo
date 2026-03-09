"""
tests/test_table_format.py – unit tests for the table-format helper.
"""

from cogs.trello_commands import _parse_table_format


def test_simple_pipe_row():
    raw = "Responsável: João | Prioridade: Alta | Prazo: 2024-12-31"
    result = _parse_table_format(raw)
    assert "**Responsável:** João" in result
    assert "**Prioridade:** Alta" in result
    assert "**Prazo:** 2024-12-31" in result


def test_single_key_value():
    raw = "Status: Em andamento"
    result = _parse_table_format(raw)
    assert result == "**Status:** Em andamento"


def test_freeform_text_unchanged():
    raw = "Just a plain description with no special formatting"
    result = _parse_table_format(raw)
    assert result == raw


def test_empty_string():
    assert _parse_table_format("") == ""


def test_cell_without_colon_passes_through():
    raw = "Nota importante | Status: Ok"
    result = _parse_table_format(raw)
    assert "Nota importante" in result
    assert "**Status:** Ok" in result


def test_extra_whitespace_trimmed():
    raw = "  Campo  :   valor   |  Outro  :  dado  "
    result = _parse_table_format(raw)
    assert "**Campo:** valor" in result
    assert "**Outro:** dado" in result
