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

/** One input of a form dialog. Every value is a string ("" = left empty); a `date` is YYYY-MM-DD. */
export interface DialogField {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'date' | 'select' | 'number';
  required?: boolean;
  placeholder?: string;
  /** A line under the input: what it is for, what happens with it. */
  hint?: string;
  value?: string;
  options?: { value: string; label: string }[];
  maxLength?: number;
  /** date only: the earliest / latest day that can be picked. */
  min?: string;
  max?: string;
}

export interface FormOptions extends ConfirmOptions {
  fields: DialogField[];
  /**
   * The work the dialog is for. It runs while the dialog stays open (the button shows "Đang xử lý…"); a refusal from the server is
   * shown inside the dialog and the user can fix the field and try again. The dialog closes once it succeeds.
   */
  run?: (values: Record<string, string>) => Promise<unknown>;
}

export interface ConfirmRequest extends ConfirmOptions {
  fields?: DialogField[];
  run?: (values: Record<string, string>) => Promise<unknown>;
  resolve: (result: Record<string, string> | true | null) => void;
}

/**
 * The one dialog of the app for "are you sure" and "tell me more first":
 *   `if (!(await confirm.ask({ title, message, confirmLabel }))) return;`
 *   `const v = await confirm.form({ title, fields: [{ key: 'reason', label: 'Lý do huỷ' }], run: (v) => api.cancel(id, v['reason']) });`
 * It replaces window.confirm and the strips that used to float over the page. Drawn once by <app-confirm-host> in the app root.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<ConfirmRequest | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    this.current()?.resolve(null);
    return new Promise<boolean>((resolve) => this.current.set({ ...opts, resolve: (r) => resolve(r !== null) }));
  }

  /** The values the user entered (once `run`, if any, succeeded), or null when they backed out. */
  form(opts: FormOptions): Promise<Record<string, string> | null> {
    this.current()?.resolve(null);
    return new Promise((resolve) => this.current.set({ ...opts, resolve: (r) => resolve(r === true ? {} : r) }));
  }

  /** Called by the host: the dialog's answer (true for a plain confirmation, the values for a form, null for "no"). */
  answer(result: Record<string, string> | true | null): void {
    const c = this.current();
    this.current.set(null);
    c?.resolve(result);
  }
}
