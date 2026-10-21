// "Số tiền bằng chữ" on phiếu thu / phiếu chi: 1.250.000 → "Một triệu hai trăm năm mươi nghìn đồng".

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['', ' nghìn', ' triệu', ' tỷ'];

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

function readInteger(n: number): string {
  if (n === 0) return 'không';
  const groups: number[] = [];
  let x = n;
  while (x > 0) {
    groups.push(x % 1000);
    x = Math.floor(x / 1000);
  }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    // Above "tỷ" the unit cycles: 1.000 tỷ = "nghìn tỷ".
    const unit = UNITS[i % 4] + (i >= 4 ? ' tỷ'.repeat(Math.floor(i / 4)) : '');
    words.push(readGroup(g, i < groups.length - 1) + unit);
  }
  return words.join(' ').replace(/\s+/g, ' ').trim();
}

export function vndInWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  const text = `${readInteger(n)} đồng`;
  const sentence = text.charAt(0).toUpperCase() + text.slice(1);
  return amount < 0 ? `Âm ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}` : sentence;
}
