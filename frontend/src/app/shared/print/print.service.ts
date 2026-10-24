import { Injectable, signal } from '@angular/core';

/** Khổ giấy của một lần in: A4 dọc, A5 dọc (nửa A4) hay cuộn nhiệt K80 (rộng 80 mm, dài theo nội dung). */
export type Paper = 'A4' | 'A5' | 'K80';

export const PAPER_LABEL: Record<Paper, { name: string; hint: string }> = {
  A4: { name: 'A4', hint: 'Khổ đầy đủ, lưu hồ sơ' },
  A5: { name: 'A5', hint: 'Nửa tờ A4, gọn cho phiếu ít dòng' },
  K80: { name: 'K80', hint: 'Máy in nhiệt 80 mm, in tại quầy' },
};

const KEY = 'nt.print.paper.';
/** Top + bottom margin of the K80 roll (@page k80 in print.scss). */
const ROLL_MARGIN_MM = 3 + 6;
const PX_TO_MM = 25.4 / 96;

// Runs window.print() on the chosen paper. The paper goes on <html data-paper> for the time of the print: print.scss
// sends the body to the matching named @page (a5 / k80) and lays the documents out for it. K80 is a roll: before
// printing, the documents are measured with the same rules and the page is made exactly that long, so the printer
// cuts after the last line instead of feeding a blank A4 length.
@Injectable({ providedIn: 'root' })
export class PrintService {
  /** The paper being printed on right now ('A4' between prints). */
  readonly paper = signal<Paper>('A4');

  /** The paper last used for this kind of document on this computer — A4 the first time. */
  remembered(kind: string, papers: readonly Paper[]): Paper {
    let p: string | null = null;
    try {
      p = localStorage.getItem(KEY + kind);
    } catch {
      /* storage blocked: A4 */
    }
    return papers.includes(p as Paper) ? (p as Paper) : papers[0];
  }

  async print(kind: string, paper: Paper, prepare?: () => void, done?: () => void): Promise<void> {
    try {
      localStorage.setItem(KEY + kind, paper);
    } catch {
      /* not remembered — still prints */
    }
    const root = document.documentElement;
    this.paper.set(paper);
    if (paper === 'A4') delete root.dataset['paper'];
    else root.dataset['paper'] = paper.toLowerCase();
    prepare?.();
    await rendered();
    const roll = paper === 'K80' ? this.fitRoll() : null;
    try {
      window.print();
    } finally {
      roll?.remove();
      delete root.dataset['paper'];
      this.paper.set('A4');
      done?.();
    }
  }

  /** Measures the printouts at roll width and sets @page k80 to their length. Returns the <style> to remove after. */
  private fitRoll(): HTMLStyleElement {
    const root = document.documentElement;
    root.dataset['paperMeasure'] = '';
    const docs = Array.from(document.querySelectorAll<HTMLElement>('.print-only'));
    const height = docs.reduce((sum, d) => sum + d.getBoundingClientRect().height, 0);
    delete root.dataset['paperMeasure'];
    const mm = Math.ceil(height * PX_TO_MM + ROLL_MARGIN_MM + 4);
    const style = document.createElement('style');
    style.textContent = `@page k80 { size: 80mm ${Math.max(mm, 60)}mm; }`;
    document.head.appendChild(style);
    return style;
  }
}

/** After Angular has drawn what prepare() changed (zoneless: the next task, then a frame). */
function rendered(): Promise<void> {
  return new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => resolve())));
}
