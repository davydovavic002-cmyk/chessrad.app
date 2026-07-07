export function normalizeLinkCode(raw) {
  if (!raw) return '';
  return String(raw).toUpperCase().replace(/^CR-?/i, '').replace(/\s/g, '').trim();
}

export function formatLinkCode(code) {
  const norm = normalizeLinkCode(code);
  return norm ? `CR-${norm}` : '';
}

export function linkUrl(code) {
  const formatted = formatLinkCode(code);
  if (!formatted) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/link/${formatted}`;
}
