"""
utils/trello_client.py – thin wrapper around the Trello REST API.

Supported operations
--------------------
* list_lists()          → list every list on the configured board
* list_cards(list_id)   → list cards inside a list
* create_card(...)      → create a new card
* update_card(...)      → update title/description/due date of an existing card
* move_card(...)        → move a card to a different list
* delete_card(card_id)  → delete a card
* get_list_by_name(...) → look up a list by its (case-insensitive) name
"""

from __future__ import annotations

from typing import Any

import requests

TRELLO_BASE = "https://api.trello.com/1"


class TrelloError(Exception):
    """Raised when the Trello API returns a non-2xx response."""


class TrelloClient:
    def __init__(self, api_key: str, token: str, board_id: str) -> None:
        self._key = api_key
        self._token = token
        self._board_id = board_id

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _auth(self) -> dict[str, str]:
        return {"key": self._key, "token": self._token}

    def _get(self, path: str, **params: Any) -> Any:
        resp = requests.get(
            f"{TRELLO_BASE}/{path.lstrip('/')}",
            params={**self._auth(), **params},
            timeout=10,
        )
        if not resp.ok:
            raise TrelloError(f"GET {path} → {resp.status_code}: {resp.text}")
        return resp.json()

    def _post(self, path: str, **data: Any) -> Any:
        resp = requests.post(
            f"{TRELLO_BASE}/{path.lstrip('/')}",
            params=self._auth(),
            json=data,
            timeout=10,
        )
        if not resp.ok:
            raise TrelloError(f"POST {path} → {resp.status_code}: {resp.text}")
        return resp.json()

    def _put(self, path: str, **data: Any) -> Any:
        resp = requests.put(
            f"{TRELLO_BASE}/{path.lstrip('/')}",
            params=self._auth(),
            json=data,
            timeout=10,
        )
        if not resp.ok:
            raise TrelloError(f"PUT {path} → {resp.status_code}: {resp.text}")
        return resp.json()

    def _delete(self, path: str) -> None:
        resp = requests.delete(
            f"{TRELLO_BASE}/{path.lstrip('/')}",
            params=self._auth(),
            timeout=10,
        )
        if not resp.ok:
            raise TrelloError(f"DELETE {path} → {resp.status_code}: {resp.text}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def list_lists(self) -> list[dict[str, Any]]:
        """Return all open lists on the board."""
        return self._get(f"boards/{self._board_id}/lists", filter="open")

    def list_cards(self, list_id: str) -> list[dict[str, Any]]:
        """Return all open cards in a list."""
        return self._get(f"lists/{list_id}/cards", filter="open")

    def create_card(
        self,
        list_id: str,
        name: str,
        desc: str = "",
        due: str | None = None,
    ) -> dict[str, Any]:
        """Create a card and return the created card object."""
        payload: dict[str, Any] = {"idList": list_id, "name": name, "desc": desc}
        if due:
            payload["due"] = due
        return self._post("cards", **payload)

    def update_card(
        self,
        card_id: str,
        name: str | None = None,
        desc: str | None = None,
        due: str | None = None,
    ) -> dict[str, Any]:
        """Update one or more fields of an existing card."""
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if desc is not None:
            payload["desc"] = desc
        if due is not None:
            payload["due"] = due
        return self._put(f"cards/{card_id}", **payload)

    def move_card(self, card_id: str, dest_list_id: str) -> dict[str, Any]:
        """Move a card to a different list (same board)."""
        return self._put(f"cards/{card_id}", idList=dest_list_id)

    def delete_card(self, card_id: str) -> None:
        """Permanently delete a card."""
        self._delete(f"cards/{card_id}")

    def get_list_by_name(self, name: str) -> dict[str, Any] | None:
        """Return the first list whose name matches *name* (case-insensitive)."""
        name_lower = name.strip().lower()
        for lst in self.list_lists():
            if lst["name"].strip().lower() == name_lower:
                return lst
        return None
