// VietQR (Pha 2): the NAPAS "chuyển nhanh 24/7 đến tài khoản" QR, built here from the bank BIN, account number, amount
// and nội dung — no image service, nothing leaves the browser. Format: EMVCo Merchant-Presented QR, each field
// ID (2) + length (2) + value, ending with a CRC16-CCITT (FALSE) checksum.
import { foldVi } from '../format.util';

/** Ngân hàng phổ biến và mã BIN NAPAS. Ngân hàng khác: nhập mã BIN 6 số (xem trên app ngân hàng / napas.com.vn). */
export const VN_BANKS: { bin: string; name: string }[] = [
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970405', name: 'Agribank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970422', name: 'MB Bank' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970441', name: 'VIB' },
  { bin: '970437', name: 'HDBank' },
  { bin: '970443', name: 'SHB' },
  { bin: '970426', name: 'MSB' },
  { bin: '970448', name: 'OCB' },
  { bin: '970440', name: 'SeABank' },
  { bin: '970431', name: 'Eximbank' },
  { bin: '970449', name: 'LPBank' },
  { bin: '970428', name: 'Nam A Bank' },
  { bin: '970409', name: 'Bac A Bank' },
  { bin: '970425', name: 'ABBANK' },
  { bin: '970427', name: 'VietABank' },
  { bin: '970412', name: 'PVcomBank' },
  { bin: '970452', name: 'KienlongBank' },
  { bin: '970438', name: 'BaoViet Bank' },
  { bin: '970419', name: 'NCB' },
  { bin: '970400', name: 'Saigonbank' },
  { bin: '970454', name: 'Viet Capital Bank' },
  { bin: '970433', name: 'VietBank' },
  { bin: '970424', name: 'Shinhan Bank' },
  { bin: '970457', name: 'Woori Bank' },
];

export const bankNameOf = (bin: string | null | undefined) => VN_BANKS.find((b) => b.bin === bin)?.name;

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC16-CCITT (FALSE): poly 0x1021, init 0xFFFF — "123456789" → "29B1". */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Nội dung chuyển khoản: không dấu, chỉ chữ số và khoảng trắng (app ngân hàng hay cắt ký tự lạ), tối đa 50 ký tự. */
export function transferNote(text: string): string {
  return foldVi(text).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
}

export interface VietQrInput {
  bin: string;
  accountNumber: string;
  /** Đồng; bỏ trống / 0 = khách tự nhập số tiền. */
  amount?: number;
  note?: string;
}

/** The QR text. Throws on a BIN or account number the banks would refuse. */
export function vietQrPayload(q: VietQrInput): string {
  const account = q.accountNumber.replace(/\s/g, '');
  if (!/^\d{6}$/.test(q.bin)) throw new Error('Mã ngân hàng (BIN) gồm 6 chữ số');
  if (!/^[0-9A-Za-z]{1,19}$/.test(account)) throw new Error('Số tài khoản không hợp lệ');
  const amount = Math.round(q.amount ?? 0);
  const note = q.note ? transferNote(q.note) : '';
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', q.bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA');
  const body =
    tlv('00', '01') +
    tlv('01', amount > 0 ? '12' : '11') +
    tlv('38', merchant) +
    tlv('53', '704') +
    (amount > 0 ? tlv('54', String(amount)) : '') +
    tlv('58', 'VN') +
    (note ? tlv('62', tlv('08', note)) : '') +
    '6304';
  return body + crc16(body);
}
