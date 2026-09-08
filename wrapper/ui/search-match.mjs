/** Search only visible text; normalize accents and German spelling. */
export function searchText(value = '') {
  return String(value).toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/\p{M}/gu, '');
}
function nearWord(a, b) {
  if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
export function searchScore(value, query) {
  const text = searchText(value), terms = searchText(query).trim().split(/\s+/).filter(Boolean).slice(0, 12);
  if (!terms.length) return 1;
  let score = 0, words;
  for (const term of terms) {
    if (text.includes(term)) { score += 4; continue; }
    words ||= text.match(/[\p{L}\p{N}]+/gu) || [];
    if (!words.some(word => nearWord(term, word))) return 0;
    score += 1;
  }
  return score;
}
