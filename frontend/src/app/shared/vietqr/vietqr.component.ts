import { Component, computed, effect, input, signal } from '@angular/core';
import { toDataURL } from 'qrcode';
import { CashAccount } from '../../core/models/domain.models';
import { formatVnd } from '../format.util';
import { bankNameOf, transferNote, vietQrPayload } from './vietqr';

/** A bank account that can receive a VietQR transfer. */
export const qrReady = (a: CashAccount) => a.type === 'NGAN_HANG' && a.isActive !== false && !!a.bankBin && !!a.accountNumber;

// Mã VietQR chuyển khoản kèm ngân hàng, số tài khoản, chủ tài khoản, số tiền và nội dung — quét bằng app ngân hàng
// nào cũng điền sẵn. Dùng được trên màn hình và trên bản in (ảnh PNG).
@Component({
  selector: 'app-vietqr',
  standalone: true,
  template: `
    @if (src(); as s) {
      <figure class="vq">
        <img [src]="s" [attr.width]="size()" [attr.height]="size()" alt="Mã VietQR chuyển khoản" />
        <figcaption>
          <strong>Quét mã để chuyển khoản</strong>
          <span>{{ bank() }} · <span class="num">{{ account().accountNumber }}</span></span>
          @if (account().accountHolder) { <span>{{ account().accountHolder }}</span> }
          @if (amount()) { <span>Số tiền: <strong class="num">{{ money(amount()!) }}</strong></span> }
          @if (noteText()) { <span>Nội dung: <span class="num">{{ noteText() }}</span></span> }
        </figcaption>
      </figure>
    } @else if (error()) {
      <p class="vq-error">{{ error() }}</p>
    }
  `,
  styles: `
    .vq { display: flex; align-items: center; gap: 12px; margin: 0; }
    .vq img { flex-shrink: 0; image-rendering: pixelated; }
    .vq figcaption { display: flex; flex-direction: column; gap: 2px; font-size: 0.85em; }
    .vq-error { color: var(--color-danger); font-size: var(--text-xs); }
  `,
})
export class VietQrComponent {
  readonly account = input.required<CashAccount>();
  readonly amount = input<number | null | undefined>(null);
  readonly note = input('');
  readonly size = input(132);

  readonly money = formatVnd;
  readonly src = signal('');
  readonly error = signal('');
  readonly bank = computed(() => bankNameOf(this.account().bankBin) ?? this.account().bankName ?? '');
  readonly noteText = computed(() => transferNote(this.note()));

  constructor() {
    effect(() => {
      const a = this.account();
      let payload: string;
      try {
        payload = vietQrPayload({ bin: a.bankBin ?? '', accountNumber: a.accountNumber ?? '', amount: this.amount() ?? 0, note: this.note() });
      } catch (e) {
        this.src.set('');
        this.error.set(`Không tạo được mã VietQR: ${(e as Error).message}.`);
        return;
      }
      const width = this.size() * 2; // crisp when printed
      // Imported statically: the dev server writes a lazy import() of a CommonJS package as a single-quoted path, which
      // breaks in a folder whose name has an apostrophe ("Tu's projects").
      void toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width }).then(
        (url) => { this.src.set(url); this.error.set(''); },
        () => this.error.set('Không tạo được mã VietQR.'),
      );
    });
  }
}
