// A PDF of the printout on screen, for an email attachment: the same <app-print-document> the printer gets (A4), laid
// out off-screen at the paper's printable width (print.scss › [data-paper-capture]), drawn to canvas and paged into
// A4. The libraries load only when an email with a PDF is sent.

const A4 = { w: 210, h: 297 };
const MARGIN = { top: 14, right: 12, bottom: 16, left: 16 }; // the same as @page in print.scss
const SCALE = 2; // sharp enough to read and print, small enough to email (JPEG)

export async function printToPdf(prepare?: () => void, done?: () => void): Promise<string> {
  const { jsPDF, html2canvas } = await import('./pdf-libs');
  const root = document.documentElement;
  root.dataset['paperCapture'] = '';
  try {
    prepare?.();
    await rendered();
    await document.fonts?.ready;
    const sheets = [...document.querySelectorAll<HTMLElement>('.print-only .pd')].filter((el) => el.getBoundingClientRect().height > 0);
    if (!sheets.length) throw new Error('Không tìm thấy bản in của chứng từ để tạo PDF.');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    let first = true;
    for (const sheet of sheets) {
      const landscape = sheet.classList.contains('pd-landscape');
      const page = landscape ? { w: A4.h, h: A4.w } : A4;
      const contentW = page.w - MARGIN.left - MARGIN.right;
      const contentH = page.h - MARGIN.top - MARGIN.bottom;
      const canvas = await html2canvas(sheet, { scale: SCALE, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const mmPerPx = contentW / canvas.width;
      const slicePx = Math.floor(contentH / mmPerPx);
      for (let y = 0; y < canvas.height; y += slicePx) {
        const h = Math.min(slicePx, canvas.height - y);
        const part = document.createElement('canvas');
        part.width = canvas.width;
        part.height = h;
        part.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (!first) pdf.addPage('a4', landscape ? 'landscape' : 'portrait');
        else if (landscape) {
          pdf.deletePage(1);
          pdf.addPage('a4', 'landscape');
        }
        first = false;
        pdf.addImage(part.toDataURL('image/jpeg', 0.9), 'JPEG', MARGIN.left, MARGIN.top, contentW, h * mmPerPx);
      }
    }
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(85);
      const w = pdf.internal.pageSize.getWidth();
      pdf.text(`${i} / ${total}`, w / 2, pdf.internal.pageSize.getHeight() - 8, { align: 'center' });
    }
    return pdf.output('datauristring').split(',')[1];
  } finally {
    delete root.dataset['paperCapture'];
    done?.();
  }
}

/** A file name a mail client shows well: "Bao gia BG0000012.pdf" (no accents — some clients mangle them). */
export function pdfName(title: string, code?: string | null): string {
  const plain = title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  return `${plain}${code ? ' ' + code : ''}`.replace(/[\\/:*?"<>|]+/g, '-').trim() + '.pdf';
}

/** After Angular has drawn what prepare() changed. A timer, not requestAnimationFrame: that one never fires while the
 *  tab is in the background, and someone may switch tabs while the email is being prepared. */
function rendered(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 80));
}
