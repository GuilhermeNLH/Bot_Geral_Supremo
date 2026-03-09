/**
 * src/trelloClient.js
 *
 * Thin wrapper around the Trello REST API.
 *
 * Supported operations:
 *   listLists()                    → all open lists on the configured board
 *   listCards(listId)              → all open cards inside a list
 *   createCard(listId, name, desc, due)  → create a card
 *   updateCard(cardId, fields)     → update title / desc / due
 *   moveCard(cardId, destListId)   → move to a different list
 *   deleteCard(cardId)             → permanently delete a card
 *   getListByName(name)            → find a list by name (case-insensitive)
 */

const axios = require('axios');

const TRELLO_BASE = 'https://api.trello.com/1';

class TrelloError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TrelloError';
  }
}

class TrelloClient {
  /**
   * @param {string} apiKey
   * @param {string} token
   * @param {string} boardId
   */
  constructor(apiKey, token, boardId) {
    this._apiKey = apiKey;
    this._token = token;
    this._boardId = boardId;
  }

  /** @returns {{ key: string, token: string }} */
  _auth() {
    return { key: this._apiKey, token: this._token };
  }

  /**
   * @param {string} path
   * @param {object} [params]
   */
  async _get(path, params = {}) {
    try {
      const resp = await axios.get(`${TRELLO_BASE}/${path}`, {
        params: { ...this._auth(), ...params },
        timeout: 10000,
      });
      return resp.data;
    } catch (err) {
      const status = err.response?.status ?? 'unknown';
      const text = err.response?.data ?? err.message;
      throw new TrelloError(`GET ${path} → ${status}: ${JSON.stringify(text)}`);
    }
  }

  async _post(path, data = {}) {
    try {
      const resp = await axios.post(`${TRELLO_BASE}/${path}`, data, {
        params: this._auth(),
        timeout: 10000,
      });
      return resp.data;
    } catch (err) {
      const status = err.response?.status ?? 'unknown';
      const text = err.response?.data ?? err.message;
      throw new TrelloError(`POST ${path} → ${status}: ${JSON.stringify(text)}`);
    }
  }

  async _put(path, data = {}) {
    try {
      const resp = await axios.put(`${TRELLO_BASE}/${path}`, data, {
        params: this._auth(),
        timeout: 10000,
      });
      return resp.data;
    } catch (err) {
      const status = err.response?.status ?? 'unknown';
      const text = err.response?.data ?? err.message;
      throw new TrelloError(`PUT ${path} → ${status}: ${JSON.stringify(text)}`);
    }
  }

  async _delete(path) {
    try {
      await axios.delete(`${TRELLO_BASE}/${path}`, {
        params: this._auth(),
        timeout: 10000,
      });
    } catch (err) {
      const status = err.response?.status ?? 'unknown';
      const text = err.response?.data ?? err.message;
      throw new TrelloError(`DELETE ${path} → ${status}: ${JSON.stringify(text)}`);
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Return all open lists on the board. */
  async listLists() {
    return this._get(`boards/${this._boardId}/lists`, { filter: 'open' });
  }

  /** Return all open cards in a list. */
  async listCards(listId) {
    return this._get(`lists/${listId}/cards`, { filter: 'open' });
  }

  /**
   * Create a card.
   * @param {string} listId
   * @param {string} name
   * @param {string} [desc]
   * @param {string|null} [due]  ISO 8601 date string or null
   */
  async createCard(listId, name, desc = '', due = null) {
    const payload = { idList: listId, name, desc };
    if (due) payload.due = due;
    return this._post('cards', payload);
  }

  /**
   * Update one or more fields of an existing card.
   * @param {string} cardId
   * @param {{ name?: string, desc?: string, due?: string }} fields
   */
  async updateCard(cardId, fields) {
    const payload = {};
    if (fields.name !== undefined) payload.name = fields.name;
    if (fields.desc !== undefined) payload.desc = fields.desc;
    if (fields.due !== undefined) payload.due = fields.due;
    return this._put(`cards/${cardId}`, payload);
  }

  /**
   * Move a card to a different list (same board).
   * @param {string} cardId
   * @param {string} destListId
   */
  async moveCard(cardId, destListId) {
    return this._put(`cards/${cardId}`, { idList: destListId });
  }

  /**
   * Permanently delete a card.
   * @param {string} cardId
   */
  async deleteCard(cardId) {
    return this._delete(`cards/${cardId}`);
  }

  /**
   * Find a list by name (case-insensitive).
   * @param {string} name
   * @returns {Promise<object|null>}
   */
  async getListByName(name) {
    const lists = await this.listLists();
    const lower = name.trim().toLowerCase();
    return lists.find((l) => l.name.trim().toLowerCase() === lower) ?? null;
  }
}

module.exports = { TrelloClient, TrelloError };
