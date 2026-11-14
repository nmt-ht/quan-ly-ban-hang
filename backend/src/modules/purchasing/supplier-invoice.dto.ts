import { BadRequestException } from '@nestjs/common';
import { OptionalDay, OptionalText } from '../../common/dto.js';
import { vnDay } from '../../common/text.js';

/** Hoá đơn GTGT của NCC: ký hiệu, số, ngày. Bỏ trống cả ba = chưa có hoá đơn. */
export class SupplierInvoiceDto {
  @OptionalText(20) invoiceSeries?: string;
  @OptionalText(30) invoiceNo?: string;
  @OptionalDay() invoiceDate?: string;
}

/**
 * Hoá đơn NCC đã làm sạch: ký hiệu hoặc ngày mà thiếu số hoá đơn là nhập thiếu (cả ba trống = chưa có hoá đơn); ngày hoá đơn
 * không được sau hôm nay.
 */
export function cleanSupplierInvoice(i: { invoiceSeries?: string | null; invoiceNo?: string | null; invoiceDate?: string | null }) {
  const series = i.invoiceSeries?.trim() || null;
  const no = i.invoiceNo?.trim() || null;
  const date = i.invoiceDate || null;
  if ((series || date) && !no) throw new BadRequestException('Nhập số hoá đơn NCC (hoặc bỏ trống ký hiệu và ngày hoá đơn).');
  if (date && date > vnDay()) throw new BadRequestException('Ngày hoá đơn không được sau hôm nay.');
  return { series, no, date };
}
