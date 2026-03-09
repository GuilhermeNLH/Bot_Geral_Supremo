/**
 * tests/tableFormat.test.js
 */

const { parseTableFormat } = require('../src/tableFormat');

describe('parseTableFormat', () => {
  test('converts pipe-separated key:value string to bold Markdown', () => {
    const raw = 'Responsável: João | Prioridade: Alta | Prazo: 2024-12-31';
    const result = parseTableFormat(raw);
    expect(result).toContain('**Responsável:** João');
    expect(result).toContain('**Prioridade:** Alta');
    expect(result).toContain('**Prazo:** 2024-12-31');
  });

  test('handles single key:value pair', () => {
    const result = parseTableFormat('Status: Em andamento');
    expect(result).toBe('**Status:** Em andamento');
  });

  test('returns freeform text unchanged', () => {
    const raw = 'Just a plain description with no special formatting';
    expect(parseTableFormat(raw)).toBe(raw);
  });

  test('returns empty string unchanged', () => {
    expect(parseTableFormat('')).toBe('');
  });

  test('handles cell without colon as plain text', () => {
    const raw = 'Nota importante | Status: Ok';
    const result = parseTableFormat(raw);
    expect(result).toContain('Nota importante');
    expect(result).toContain('**Status:** Ok');
  });

  test('trims extra whitespace around key and value', () => {
    const raw = '  Campo  :   valor   |  Outro  :  dado  ';
    const result = parseTableFormat(raw);
    expect(result).toContain('**Campo:** valor');
    expect(result).toContain('**Outro:** dado');
  });
});
