import { DebtRow } from '../../core/services/debt.service';

/** Tuổi nợ buckets shown on both debt lists (aging strip + Excel). */
export const AGING_COLUMNS: { key: Exclude<keyof DebtRow['aging'], 'total'>; label: string }[] = [
  { key: 'notDue', label: 'Chưa đến hạn' },
  { key: 'overdue1to30', label: 'Quá hạn 1–30 ngày' },
  { key: 'overdue31to60', label: '31–60 ngày' },
  { key: 'overdue61to90', label: '61–90 ngày' },
  { key: 'overdueOver90', label: 'Trên 90 ngày' },
];
