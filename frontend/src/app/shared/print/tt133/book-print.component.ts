import { Component, computed, input } from '@angular/core';
import { PrintDocumentComponent, PrintSigner } from '../print-document.component';

/** Cột của một sổ. `group` gộp các cột liền nhau cùng nhóm dưới một tiêu đề chung (Số phát sinh: Nợ | Có). */
export interface BookColumn {
  head: string;
  group?: string;
  /** Số liệu: căn phải, không xuống dòng. */
  num?: boolean;
  /** Căn giữa (ngày, số hiệu). */
  center?: boolean;
}

/** Một ô: chuỗi / số, hoặc ô gộp nhiều cột (nhãn "Số dư đầu kỳ" trải qua `span` cột). */
export type BookCell = string | number | null | { text: string | number | null; span: number };

export interface BookRow {
  cells: BookCell[];
  /** `open` = số dư đầu kỳ, `sum` = cộng phát sinh / số dư cuối kỳ: tô nền, chữ đậm. */
  kind?: 'open' | 'sum';
}

const BOOK_SIGNERS: PrintSigner[] = [
  { role: 'Người ghi sổ' },
  { role: 'Kế toán trưởng' },
  { role: 'Người đại diện theo pháp luật', hint: '(Ký, họ tên, đóng dấu)' },
];

interface HeaderCell { text: string; colspan: number; rowspan: number }

/**
 * Sổ kế toán theo mẫu TT133 (S03a-DNN, S03b-DNN, S04a-DNN, S05-DNN, S12-DNN, S19-DNN): đầu trang có mẫu số, tiêu đề cột hai tầng,
 * số liệu căn phải, dòng số dư và cộng phát sinh tô nền. Mỗi sổ chỉ khai cột và dòng (tt133-books.ts), giấy và khối ký dùng chung.
 */
@Component({
  selector: 'app-book-print',
  standalone: true,
  imports: [PrintDocumentComponent],
  template: `
    <app-print-document [formNo]="formNo()" [title]="title()" [sub]="sub()" [landscape]="landscape()" [signers]="signers()">
      @if (sub2()) { <p class="pd-sub">{{ sub2() }}</p> }
      <table class="pd-table pd-book">
        <thead>
          <tr>
            @for (h of top(); track $index) { <th scope="col" [attr.colspan]="h.colspan" [attr.rowspan]="h.rowspan">{{ h.text }}</th> }
          </tr>
          @if (hasGroups()) {
            <tr>@for (h of bottom(); track $index) { <th scope="col">{{ h.text }}</th> }</tr>
          }
          <tr class="c">@for (c of columns(); track $index) { <th scope="col">{{ letter($index) }}</th> }</tr>
        </thead>
        <tbody>
          @for (r of rows(); track $index) {
            <tr [class.open]="r.kind === 'open'" [class.sum]="r.kind === 'sum'">
              @for (c of r.cells; track $index; let i = $index) {
                <td [attr.colspan]="span(c)" [class.num-cell]="numeric(r, i)" [class.c]="centered(r, i)">{{ text(c) }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
      <p class="pd-note">Sổ này có … trang, đánh số từ trang 01 đến trang … · Ngày mở sổ: …</p>
    </app-print-document>
  `,
})
export class BookPrintComponent {
  readonly formNo = input.required<string>();
  readonly title = input.required<string>();
  readonly sub = input<string>();
  readonly sub2 = input<string>();
  readonly landscape = input(true);
  readonly columns = input.required<BookColumn[]>();
  readonly rows = input.required<BookRow[]>();
  readonly signers = input<PrintSigner[]>(BOOK_SIGNERS);

  readonly hasGroups = computed(() => this.columns().some((c) => c.group));

  /** Hàng tiêu đề trên: cột đơn chiếm hai hàng, nhóm gộp theo chiều ngang. */
  readonly top = computed<HeaderCell[]>(() => {
    const out: HeaderCell[] = [];
    const cols = this.columns();
    if (!this.hasGroups()) return cols.map((c) => ({ text: c.head, colspan: 1, rowspan: 1 }));
    for (let i = 0; i < cols.length; i++) {
      const g = cols[i].group;
      if (!g) { out.push({ text: cols[i].head, colspan: 1, rowspan: 2 }); continue; }
      let n = 1;
      while (i + n < cols.length && cols[i + n].group === g) n++;
      out.push({ text: g, colspan: n, rowspan: 1 });
      i += n - 1;
    }
    return out;
  });
  /** Hàng tiêu đề dưới: tên từng cột của các nhóm. */
  readonly bottom = computed<HeaderCell[]>(() => this.columns().filter((c) => c.group).map((c) => ({ text: c.head, colspan: 1, rowspan: 1 })));

  letter(i: number): string {
    return 'ABCDEFGHIJKLMNOP'[i] ?? String(i + 1);
  }
  span(c: BookCell): number | null {
    return typeof c === 'object' && c !== null ? c.span : null;
  }
  text(c: BookCell): string {
    const v = typeof c === 'object' && c !== null ? c.text : c;
    if (v === null || v === undefined || v === '') return '';
    return typeof v === 'number' ? Math.round(v).toLocaleString('vi-VN') : v;
  }
  /** Cột thật của ô thứ i (tính cả các ô gộp đứng trước). */
  private column(r: BookRow, i: number): number {
    let col = 0;
    for (let k = 0; k < i; k++) col += this.span(r.cells[k]) ?? 1;
    return col;
  }
  numeric(r: BookRow, i: number): boolean {
    return !!this.columns()[this.column(r, i)]?.num && this.span(r.cells[i]) === null;
  }
  centered(r: BookRow, i: number): boolean {
    return !!this.columns()[this.column(r, i)]?.center && this.span(r.cells[i]) === null;
  }
}
