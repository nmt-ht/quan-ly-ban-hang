import { Component, input } from '@angular/core';
import { PrintDocumentComponent, PrintSigner } from '../print-document.component';
import { statementAmount } from '../tt133/statement-print.component';
import { VatReturnLine } from './vat-return.rules';

const TT80_NOTE = '(Ban hành theo Thông tư số 80/2021/TT-BTC ngày 29/9/2021 của Bộ Tài chính)';

const RETURN_SIGNER: PrintSigner[] = [
  { role: 'NGƯỜI NỘP THUẾ hoặc ĐẠI DIỆN HỢP PHÁP CỦA NGƯỜI NỘP THUẾ', hint: '(Ký, ghi rõ họ tên, chức vụ và đóng dấu)' },
];

/**
 * Tờ khai thuế GTGT mẫu 01/GTGT (TT80/2021): đầu trang mẫu số + căn cứ, kỳ tính thuế, bảng Chỉ tiêu | Mã số | Số tiền,
 * khối ký của người nộp thuế. Dùng: <app-vat-return-print [lines]="…" [sub]="'Kỳ tính thuế: Tháng 1 năm 2026'" [date]="today" />
 */
@Component({
  selector: 'app-vat-return-print',
  standalone: true,
  imports: [PrintDocumentComponent],
  template: `
    <app-print-document formNo="01/GTGT" [formNote]="note" title="TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG" [sub]="sub()" [date]="date()" [signers]="signers">
      <p class="pd-sub">(Áp dụng đối với người nộp thuế tính thuế theo phương pháp khấu trừ) · Đơn vị tiền: đồng Việt Nam</p>
      <table class="pd-table pd-statement">
        <thead>
          <tr>
            <th scope="col">CHỈ TIÊU</th><th scope="col" class="nw">Mã số</th><th scope="col" class="nw">Số tiền</th>
          </tr>
        </thead>
        <tbody>
          @for (l of lines(); track $index) {
            @if (l.head) {
              <tr class="bold"><td colspan="3">{{ l.label }}</td></tr>
            } @else {
              <tr [class.bold]="l.bold">
                <td class="label-l1">{{ l.label }}</td>
                <td class="code-cell">{{ l.code }}</td>
                <td class="r">{{ amount(l.value) }}</td>
              </tr>
            }
          }
        </tbody>
      </table>
      <p class="pd-note">
        Số liệu lập từ hoá đơn và sổ kế toán trong kỳ; mức thuế suất 8% và các mức khác gộp ở chỉ tiêu [32a]/[33a].
        Đây là số liệu hỗ trợ — đối chiếu mẫu tờ khai hiện hành và kê khai trên HTKK/eTax của cơ quan thuế khi nộp.
      </p>
    </app-print-document>
  `,
})
export class VatReturnPrintComponent {
  /** Dòng dưới tiêu đề: "Kỳ tính thuế: Tháng 01 năm 2026". */
  readonly sub = input.required<string>();
  /** ISO day lập tờ khai. */
  readonly date = input<string>();
  readonly lines = input.required<VatReturnLine[]>();
  readonly note = TT80_NOTE;
  readonly signers = RETURN_SIGNER;
  readonly amount = statementAmount;
}
