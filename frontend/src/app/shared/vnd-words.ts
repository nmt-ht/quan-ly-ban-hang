// "Số tiền bằng chữ" on phiếu thu / phiếu chi: 1.250.000 → "Một triệu hai trăm năm mươi nghìn đồng".

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['', ' nghìn', ' triệu'];

/** Read a 0–999 group; `full` = there is a higher group, so "không trăm" / "lẻ" are spelled out. */
function readGroup(n: number, full: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts: string[] = [];
  if (h > 0 || full) parts.push(`${DIGITS[h]} trăm`);
  if (t > 1) {
    parts.push(`${DIGITS[t]} mươi`);
    if (u === 1) parts.push('mốt');
    else if (u === 4) parts.push('tư');
    else if (u === 5) parts.push('lăm');
    else if (u > 0) parts.push(DIGITS[u]);
  } else if (t === 1) {
    parts.push('mười');
    if (u === 5) parts.push('lăm');
    else if (u > 0) parts.push(DIGITS[u]);
  } else if (u > 0) {
    if (h > 0 || full) parts.push('lẻ');
    parts.push(DIGITS[u]);
  }
  return parts.join(' ');
}

/** Read 0 < n < 1 tỷ; `full` = a "tỷ" part comes before it. */
function readBelowBillion(n: number, full: boolean): string {
  const groups = [n % 1000, Math.floor(n / 1000) % 1000, Math.floor(n / 1_000_000)];
  const top = groups[2] ? 2 : groups[1] ? 1 : 0;
  const words: string[] = [];
  for (let i = top; i >= 0; i--) {
    if (groups[i] === 0) continue;
    words.push(readGroup(groups[i], full || i < top) + UNITS[i]);
  }
  return words.join(' ');
}

function readInteger(n: number): string {
  if (n === 0) return 'không';
  // Above "tỷ" the part before it is read as a number of its own: 1.500 tỷ = "một nghìn năm trăm tỷ".
  const high = Math.floor(n / 1_000_000_000);
  const low = n % 1_000_000_000;
  const words = [high ? `${readInteger(high)} tỷ` : '', low ? readBelowBillion(low, high > 0) : ''];
  return words.join(' ').replace(/\s+/g, ' ').trim();
}

export function vndInWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  const text = `${readInteger(n)} đồng`;
  const sentence = text.charAt(0).toUpperCase() + text.slice(1);
  return amount < 0 ? `Âm ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}` : sentence;
}
