/**
 * Folding for Arabic text typed into a CSV.
 *
 * A column header or a kind is written by hand, so it arrives with whatever
 * spelling the person reached for: with or without harakat, with أ or ا, with
 * ة or ه. Folding those apart before matching means one alias covers all of
 * them rather than a table of near-duplicates.
 *
 * Latin text passes through untouched, so a file can mix the two.
 */
const HARAKAT = /[ً-ْٰـ]/g;

export function foldArabic(value: string): string {
  return value
    .replace(HARAKAT, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\s_-]+/g, "_")
    .toLowerCase()
    .trim();
}
