// The two PDF libraries, loaded together by print-pdf.ts through import('./pdf-libs') — a chunk of its own, so pages
// that never email a PDF never download them. (Imported statically here, not with import('jspdf') in print-pdf.ts:
// the dev server rewrites a dynamic import of a package as import('<absolute path>') in single quotes, and this
// project's folder name contains an apostrophe.)
// html2canvas-pro, not html2canvas: the app's colours are oklch(), which html2canvas 1.4 cannot read.
export { jsPDF } from 'jspdf';
export { default as html2canvas } from 'html2canvas-pro';
