"""
tests/test_trello_client.py – unit tests for TrelloClient.
All HTTP calls are mocked so no real Trello credentials are needed.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
import requests

from utils.trello_client import TrelloClient, TrelloError

FAKE_KEY = "key123"
FAKE_TOKEN = "tok456"
FAKE_BOARD = "board789"


@pytest.fixture
def client() -> TrelloClient:
    return TrelloClient(api_key=FAKE_KEY, token=FAKE_TOKEN, board_id=FAKE_BOARD)


def _ok(json_data):
    """Return a mock response with status 200 and the given JSON payload."""
    resp = MagicMock(spec=requests.Response)
    resp.ok = True
    resp.json.return_value = json_data
    return resp


def _err(status: int = 400, text: str = "Bad Request"):
    """Return a mock response that represents an error."""
    resp = MagicMock(spec=requests.Response)
    resp.ok = False
    resp.status_code = status
    resp.text = text
    return resp


# ---------------------------------------------------------------------------
# list_lists
# ---------------------------------------------------------------------------


def test_list_lists_returns_list(client):
    lists = [{"id": "l1", "name": "To Do"}, {"id": "l2", "name": "Done"}]
    with patch("utils.trello_client.requests.get", return_value=_ok(lists)) as mock_get:
        result = client.list_lists()

    assert result == lists
    mock_get.assert_called_once()
    call_params = mock_get.call_args.kwargs["params"]
    assert call_params["key"] == FAKE_KEY
    assert call_params["token"] == FAKE_TOKEN


def test_list_lists_raises_on_error(client):
    with patch("utils.trello_client.requests.get", return_value=_err(401, "Unauthorized")):
        with pytest.raises(TrelloError, match="401"):
            client.list_lists()


# ---------------------------------------------------------------------------
# list_cards
# ---------------------------------------------------------------------------


def test_list_cards_returns_cards(client):
    cards = [{"id": "c1", "name": "Fix bug", "desc": "", "url": "http://t.co/c1"}]
    with patch("utils.trello_client.requests.get", return_value=_ok(cards)):
        result = client.list_cards("l1")

    assert len(result) == 1
    assert result[0]["name"] == "Fix bug"


# ---------------------------------------------------------------------------
# create_card
# ---------------------------------------------------------------------------


def test_create_card_posts_correct_payload(client):
    card = {"id": "c2", "name": "My Card", "desc": "desc", "url": "http://t.co/c2", "due": None}
    with patch("utils.trello_client.requests.post", return_value=_ok(card)) as mock_post:
        result = client.create_card("l1", "My Card", desc="desc")

    assert result["id"] == "c2"
    body = mock_post.call_args.kwargs["json"]
    assert body["name"] == "My Card"
    assert body["idList"] == "l1"
    assert body["desc"] == "desc"
    assert "due" not in body  # no due date provided


def test_create_card_includes_due_when_provided(client):
    card = {"id": "c3", "name": "Task", "desc": "", "url": "http://t.co/c3", "due": "2024-12-31"}
    with patch("utils.trello_client.requests.post", return_value=_ok(card)) as mock_post:
        client.create_card("l1", "Task", due="2024-12-31")

    body = mock_post.call_args.kwargs["json"]
    assert body["due"] == "2024-12-31"


def test_create_card_raises_on_error(client):
    with patch("utils.trello_client.requests.post", return_value=_err(404, "List not found")):
        with pytest.raises(TrelloError, match="404"):
            client.create_card("bad_list", "Title")


# ---------------------------------------------------------------------------
# update_card
# ---------------------------------------------------------------------------


def test_update_card_sends_only_provided_fields(client):
    updated = {"id": "c1", "name": "New name", "url": "http://t.co/c1", "due": None}
    with patch("utils.trello_client.requests.put", return_value=_ok(updated)) as mock_put:
        client.update_card("c1", name="New name")

    body = mock_put.call_args.kwargs["json"]
    assert body == {"name": "New name"}


def test_update_card_raises_on_error(client):
    with patch("utils.trello_client.requests.put", return_value=_err(404)):
        with pytest.raises(TrelloError):
            client.update_card("missing", name="X")


# ---------------------------------------------------------------------------
# move_card
# ---------------------------------------------------------------------------


def test_move_card_sends_correct_list_id(client):
    moved = {"id": "c1", "name": "Card", "url": "http://t.co/c1", "idList": "l2"}
    with patch("utils.trello_client.requests.put", return_value=_ok(moved)) as mock_put:
        client.move_card("c1", "l2")

    body = mock_put.call_args.kwargs["json"]
    assert body == {"idList": "l2"}


# ---------------------------------------------------------------------------
# delete_card
# ---------------------------------------------------------------------------


def test_delete_card_calls_delete(client):
    ok_resp = MagicMock(spec=requests.Response)
    ok_resp.ok = True
    with patch("utils.trello_client.requests.delete", return_value=ok_resp) as mock_del:
        client.delete_card("c1")

    mock_del.assert_called_once()
    assert "/cards/c1" in mock_del.call_args.args[0]


def test_delete_card_raises_on_error(client):
    with patch("utils.trello_client.requests.delete", return_value=_err(404)):
        with pytest.raises(TrelloError):
            client.delete_card("bad")


# ---------------------------------------------------------------------------
# get_list_by_name
# ---------------------------------------------------------------------------


def test_get_list_by_name_found_case_insensitive(client):
    lists = [
        {"id": "l1", "name": "To Do"},
        {"id": "l2", "name": "In Progress"},
    ]
    with patch("utils.trello_client.requests.get", return_value=_ok(lists)):
        result = client.get_list_by_name("in progress")

    assert result is not None
    assert result["id"] == "l2"


def test_get_list_by_name_not_found(client):
    lists = [{"id": "l1", "name": "To Do"}]
    with patch("utils.trello_client.requests.get", return_value=_ok(lists)):
        result = client.get_list_by_name("Nonexistent")

    assert result is None
