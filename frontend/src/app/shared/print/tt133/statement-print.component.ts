import { Component, input } from '@angular/core';
import { PrintDocumentComponent, PrintSigner } from '../print-document.component';

export interface StatementPrintLine {
  code: string;
  label: string;
  level?: number;
  bold?: boolean;
  amount?: number | null;
  prior?: number | null;
}

/** Số liệu báo cáo tài chính: số âm trong ngoặc đơn, chỉ tiêu không có số thì để trống. */
export function statementAmount(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const text = Math.abs(Math.round(v)).toLocaleString('vi-VN');
  return v < 0 ? `(${text})` : text;
}

const REPORT_SIGNERS: PrintSigner[] = [
  { role: 'Người lập biểu' },
  { role: 'Kế toán trưởng' },
  { role: 'Người đại diện theo pháp luật', hint: '(Ký, họ tên, đóng dấu)' },
];

/**
 * Báo cáo tài chính theo mẫu TT133 (B01b-DNN, B02-DNN, B03-DNN): đầu trang có mẫu số và căn cứ ban hành, bảng
 * Chỉ tiêu | Mã số | Thuyết minh | hai cột số liệu, rồi khối ký. Dùng: <app-statement-print formNo="B02-DNN" title="…" [heads]="['Năm nay','Năm trước']" [lines]="…" />
 */
@Component({
  selector: 'app-statement-print',
  standalone: true,
  imports: [PrintDocumentComponent],
  template: `
    <app-print-document [formNo]="formNo()" [title]="title()" [sub]="sub()" [signers]="signers()">
      @if (sub2()) { <p class="pd-sub">{{ sub2() }}</p> }
      <table class="pd-table pd-statement">
        <thead>
          <tr>
            <th scope="col">CHỈ TIÊU</th><th scope="col" class="nw">Mã số</th><th scope="col" class="nw">Thuyết minh</th>
            <th scope="col" class="nw">{{ heads()[0] }}</th><th scope="col" class="nw">{{ heads()[1] }}</th>
          </tr>
          <tr class="c"><th scope="col">A</th><th scope="col">B</th><th scope="col">C</th><th scope="col">1</th><th scope="col">2</th></tr>
        </thead>
        <tbody>
          @for (l of lines(); track l.code) {
            <tr [class.bold]="l.bold">
              <td [class]="'label-l' + (l.level ?? 0)">{{ l.label }}</td>
              <td class="code-cell">{{ l.code }}</td>
              <td></td>
              <td class="r">{{ amount(l.amount) }}</td>
              <td class="r">{{ amount(l.prior) }}</td>
            </tr>
          }
        </tbody>
      </table>
      <p class="pd-note">Chỉ tiêu không có số liệu được miễn trình bày nhưng không đánh lại mã số. Số trong ngoặc đơn (…) là số âm.</p>
    </app-print-document>
  `,
})
export class StatementPrintComponent {
  readonly formNo = input.required<string>();
  readonly title = input.required<string>();
  /** Dòng dưới tiêu đề: "Tại ngày 31 tháng 12 năm 2026", "Năm 2026". */
  readonly sub = input<string>();
  /** Dòng thứ hai: đơn vị tính, ghi chú. */
  readonly sub2 = input<string>('Đơn vị tính: đồng');
  readonly heads = input<[string, string]>(['Năm nay', 'Năm trước']);
  readonly lines = input.required<StatementPrintLine[]>();
  readonly signers = input<PrintSigner[]>(REPORT_SIGNERS);
  readonly amount = statementAmount;
}
