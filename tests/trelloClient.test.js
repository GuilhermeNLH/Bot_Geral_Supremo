/**
 * tests/trelloClient.test.js
 *
 * Unit tests for TrelloClient. All HTTP calls are mocked via jest.mock.
 */

jest.mock('axios');

const axios = require('axios');
const { TrelloClient, TrelloError } = require('../src/trelloClient');

const FAKE_KEY = 'key123';
const FAKE_TOKEN = 'tok456';
const FAKE_BOARD = 'board789';

beforeEach(() => jest.clearAllMocks());

/** @returns {TrelloClient} */
function makeClient() {
  return new TrelloClient(FAKE_KEY, FAKE_TOKEN, FAKE_BOARD);
}

// ── listLists ─────────────────────────────────────────────────────────────────

describe('listLists', () => {
  test('returns list data on success', async () => {
    const lists = [{ id: 'l1', name: 'To Do' }, { id: 'l2', name: 'Done' }];
    axios.get.mockResolvedValue({ data: lists });

    const client = makeClient();
    const result = await client.listLists();

    expect(result).toEqual(lists);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining(`boards/${FAKE_BOARD}/lists`),
      expect.objectContaining({ params: expect.objectContaining({ key: FAKE_KEY, token: FAKE_TOKEN }) }),
    );
  });

  test('throws TrelloError on HTTP error', async () => {
    axios.get.mockRejectedValue({ response: { status: 401, data: 'Unauthorized' } });
    const client = makeClient();
    await expect(client.listLists()).rejects.toThrow(TrelloError);
  });
});

// ── listCards ─────────────────────────────────────────────────────────────────

describe('listCards', () => {
  test('returns cards on success', async () => {
    const cards = [{ id: 'c1', name: 'Fix bug', desc: '', url: 'http://t.co/c1' }];
    axios.get.mockResolvedValue({ data: cards });

    const client = makeClient();
    const result = await client.listCards('l1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Fix bug');
  });
});

// ── createCard ────────────────────────────────────────────────────────────────

describe('createCard', () => {
  test('posts correct payload without due date', async () => {
    const card = { id: 'c2', name: 'My Card', desc: 'desc', url: 'http://t.co/c2', due: null };
    axios.post.mockResolvedValue({ data: card });

    const client = makeClient();
    const result = await client.createCard('l1', 'My Card', 'desc');

    expect(result.id).toBe('c2');
    const body = axios.post.mock.calls[0][1];
    expect(body.name).toBe('My Card');
    expect(body.idList).toBe('l1');
    expect(body.desc).toBe('desc');
    expect(body.due).toBeUndefined();
  });

  test('includes due when provided', async () => {
    const card = { id: 'c3', name: 'Task', desc: '', url: 'http://t.co/c3', due: '2024-12-31' };
    axios.post.mockResolvedValue({ data: card });

    const client = makeClient();
    await client.createCard('l1', 'Task', '', '2024-12-31');

    const body = axios.post.mock.calls[0][1];
    expect(body.due).toBe('2024-12-31');
  });

  test('throws TrelloError on failure', async () => {
    axios.post.mockRejectedValue({ response: { status: 404, data: 'List not found' } });
    const client = makeClient();
    await expect(client.createCard('bad_list', 'Title')).rejects.toThrow(TrelloError);
  });
});

// ── updateCard ────────────────────────────────────────────────────────────────

describe('updateCard', () => {
  test('sends only provided fields', async () => {
    const updated = { id: 'c1', name: 'New name', url: 'http://t.co/c1', due: null };
    axios.put.mockResolvedValue({ data: updated });

    const client = makeClient();
    await client.updateCard('c1', { name: 'New name' });

    const body = axios.put.mock.calls[0][1];
    expect(body).toEqual({ name: 'New name' });
  });

  test('throws TrelloError on failure', async () => {
    axios.put.mockRejectedValue({ response: { status: 404, data: 'Not found' } });
    const client = makeClient();
    await expect(client.updateCard('missing', { name: 'X' })).rejects.toThrow(TrelloError);
  });
});

// ── moveCard ──────────────────────────────────────────────────────────────────

describe('moveCard', () => {
  test('sends idList in body', async () => {
    const moved = { id: 'c1', name: 'Card', url: 'http://t.co/c1', idList: 'l2' };
    axios.put.mockResolvedValue({ data: moved });

    const client = makeClient();
    await client.moveCard('c1', 'l2');

    const body = axios.put.mock.calls[0][1];
    expect(body).toEqual({ idList: 'l2' });
  });
});

// ── deleteCard ────────────────────────────────────────────────────────────────

describe('deleteCard', () => {
  test('calls DELETE on the correct URL', async () => {
    axios.delete.mockResolvedValue({});

    const client = makeClient();
    await client.deleteCard('c1');

    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/cards/c1'),
      expect.anything(),
    );
  });

  test('throws TrelloError on failure', async () => {
    axios.delete.mockRejectedValue({ response: { status: 404, data: 'Not found' } });
    const client = makeClient();
    await expect(client.deleteCard('bad')).rejects.toThrow(TrelloError);
  });
});

// ── getListByName ─────────────────────────────────────────────────────────────

describe('getListByName', () => {
  test('finds list case-insensitively', async () => {
    const lists = [{ id: 'l1', name: 'To Do' }, { id: 'l2', name: 'In Progress' }];
    axios.get.mockResolvedValue({ data: lists });

    const client = makeClient();
    const result = await client.getListByName('in progress');

    expect(result).not.toBeNull();
    expect(result.id).toBe('l2');
  });

  test('returns null when not found', async () => {
    axios.get.mockResolvedValue({ data: [{ id: 'l1', name: 'To Do' }] });

    const client = makeClient();
    const result = await client.getListByName('Nonexistent');

    expect(result).toBeNull();
  });
});
