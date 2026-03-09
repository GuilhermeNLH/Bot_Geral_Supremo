/**
 * src/tableFormat.js
 *
 * Converts a pipe-separated "Campo: valor | Campo2: valor2" string into
 * a Markdown-flavoured description suitable for Trello cards.
 *
 * Example input:
 *   "Responsável: João | Prioridade: Alta | Prazo: 2024-12-31"
 *
 * Example output:
 *   "**Responsável:** João\n**Prioridade:** Alta\n**Prazo:** 2024-12-31"
 *
 * Freeform text (no pipe AND no colon) is returned unchanged.
 */

const TABLE_SEPARATOR = '|';

/**
 * @param {string} raw
 * @returns {string}
 */
function parseTableFormat(raw) {
  if (!raw) return raw;
  if (!raw.includes(TABLE_SEPARATOR) && !raw.includes(':')) return raw;

  const cells = raw.split(TABLE_SEPARATOR);
  const lines = [];

  for (const cell of cells) {
    const trimmed = cell.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      lines.push(`**${key}:** ${value}`);
    } else {
      lines.push(trimmed);
    }
  }

  return lines.length > 0 ? lines.join('\n') : raw;
}

module.exports = { parseTableFormat };
