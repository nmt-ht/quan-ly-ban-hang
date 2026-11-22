import { Contract, ContractKind, ContractStatus } from '../../core/models/contract.models';

// Quy tắc hiển thị của hợp đồng (máy chủ giữ bản gốc: backend/src/modules/contracts/contracts.rules.ts).

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = { BAN: 'Hợp đồng bán', MUA: 'Hợp đồng mua' };
export const CONTRACT_PARTY_LABEL: Record<ContractKind, string> = { BAN: 'Khách hàng', MUA: 'Nhà cung cấp' };
/** Path segment of each kind's list: /hop-dong/ban, /hop-dong/mua. */
export const CONTRACT_KIND_PATH: Record<ContractKind, string> = { BAN: 'ban', MUA: 'mua' };
export const kindOfPath = (p: string | null | undefined): ContractKind => (p === 'mua' ? 'MUA' : 'BAN');

export const isOpen = (c: Pick<Contract, 'status'> | ContractStatus) => (typeof c === 'string' ? c : c.status) === 'DANG_THUC_HIEN';

/** Báo trước bao nhiêu ngày thì coi là "sắp hết hạn". */
export const EXPIRING_DAYS = 30;

/** "expired" = quá hạn mà chưa thanh lý; "soon" = còn ≤ 30 ngày; chỉ xét hợp đồng đang thực hiện. */
export function expiryOf(c: Pick<Contract, 'endDate' | 'status'>, today: string): 'none' | 'soon' | 'expired' {
  if (!c.endDate || !isOpen(c)) return 'none';
  if (c.endDate < today) return 'expired';
  const days = Math.round((Date.parse(`${c.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days <= EXPIRING_DAYS ? 'soon' : 'none';
}

export const EXPIRY_LABEL = { soon: 'Sắp hết hạn', expired: 'Quá hạn' } as const;

/** Hợp đồng còn nhận được đơn của đối tác này: đúng loại, đúng đối tác, đang thực hiện (hoặc đơn vốn đã gắn nó). */
export function pickableContracts(list: Contract[], kind: ContractKind, partnerId: string, keepId: string | null | undefined): Contract[] {
  if (!partnerId) return [];
  return list.filter((c) => c.kind === kind && c.partnerId === partnerId && (isOpen(c) || c.id === keepId));
}
