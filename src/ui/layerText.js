/** Plain presentation runs: preserve short Latin codes and separator wrapping. */
export function rowTextParts(text) {
  const value = String(text ?? '');
  const parts = [];
  const plain = (text) =>
    text.split(' · ').forEach((piece, index) => {
      if (index) parts.push({ text: ' ·', keep: true });
      if (piece || index)
        parts.push({ text: `${index ? ' ' : ''}${piece}`, keep: false });
    });
  let cursor = 0;
  for (const match of value.matchAll(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g)) {
    if (match[0].length > 16) continue;
    plain(value.slice(cursor, match.index));
    parts.push({ text: match[0], keep: true });
    cursor = match.index + match[0].length;
  }
  plain(value.slice(cursor));
  return parts;
}

/** Compatibility helper for existing plain DOM readouts. */
export function setRowText(element, text) {
  const value = String(text ?? '');
  if (element.textContent === value) return;
  const parts = rowTextParts(value);
  element.textContent = parts.some((part) => part.keep) ? '' : value;
  if (!parts.some((part) => part.keep)) return;
  for (const part of parts) {
    const span = document.createElement('span');
    if (part.keep) span.className = 'data-keep';
    span.textContent = part.text;
    element.appendChild(span);
  }
}
