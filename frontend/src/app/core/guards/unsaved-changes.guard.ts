import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ConfirmService } from '../../shared/confirm/confirm.service';

/** A form component that can tell whether the user has typed something not yet saved. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Ask before leaving a form with unsaved edits (menu click, back button, link). */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() ||
  inject(ConfirmService).ask({ title: 'Rời trang và bỏ thay đổi?', message: 'Bạn có thay đổi chưa lưu. Rời trang thì các thay đổi này mất.', confirmLabel: 'Rời trang', cancelLabel: 'Ở lại', tone: 'danger' });

/** Ctrl+S (or ⌘S on Mac). */
export function isSaveShortcut(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's';
}

/** Browser-level prompt for reload / tab close; call from a `window:beforeunload` listener. */
export function warnBeforeUnload(e: BeforeUnloadEvent, dirty: boolean): void {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = '';
}
