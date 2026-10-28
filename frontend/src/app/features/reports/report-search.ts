import { foldVi } from '../../shared/format.util';

/** A run of text, marked when it is part of a search hit. */
export interface TextPart {
  text: string;
  hit: boolean;
}

/** The words of a search box, folded (no diacritics, lower case). */
export function searchWords(query: string): string[] {
  return foldVi(query).split(/\s+/).filter(Boolean);
}

/** Every word must appear somewhere in the texts ("ton kho" finds "Tồn kho hiện tại"). */
export function matchesAll(words: string[], ...texts: string[]): boolean {
  const hay = foldVi(texts.join(' '));
  return words.every((w) => hay.includes(w));
}

/**
 * Splits `text` into runs, marking where any search word matches without diacritics. Each character is folded on its
 * own, so a hit in the folded text maps back onto the original characters (accents kept on screen).
 */
export function highlight(text: string, words: string[]): TextPart[] {
  if (!words.length || !text) return [{ text, hit: false }];
  const chars = Array.from(text);
  let folded = '';
  const owner: number[] = []; // folded index → index in chars
  chars.forEach((c, i) => {
    const f = foldVi(c);
    folded += f;
    for (let k = 0; k < f.length; k++) owner.push(i);
  });

  const hit = new Array<boolean>(chars.length).fill(false);
  for (const w of words) {
    for (let at = folded.indexOf(w); at >= 0; at = folded.indexOf(w, at + 1)) {
      for (let k = at; k < at + w.length; k++) hit[owner[k]] = true;
    }
  }

  const parts: TextPart[] = [];
  chars.forEach((c, i) => {
    const last = parts[parts.length - 1];
    if (last && last.hit === hit[i]) last.text += c;
    else parts.push({ text: c, hit: hit[i] });
  });
  return parts;
}
