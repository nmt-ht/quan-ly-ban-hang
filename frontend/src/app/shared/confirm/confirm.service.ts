import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  /** The question, one short sentence: "Đảo bút toán BT0000001?" */
  title: string;
  /** What happens, and whether it can be undone. */
  message?: string;
  /** The confirming button; say the action ("Đảo bút toán"), not "OK". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = destructive or hard to undo (red confirming button, focus starts on Huỷ); primary = a go-ahead. */
  tone?: 'danger' | 'primary';
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * The one confirmation dialog of the app (replaces window.confirm): `if (!(await this.confirm.ask({ title, message, confirmLabel }))) return;`.
 * The dialog itself is drawn once by <app-confirm-host> in the app root.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmRequest | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    this.current()?.resolve(false);
    return new Promise<boolean>((resolve) => this.current.set({ ...opts, resolve }));
  }

  answer(ok: boolean): void {
    const c = this.current();
    this.current.set(null);
    c?.resolve(ok);
  }
}
