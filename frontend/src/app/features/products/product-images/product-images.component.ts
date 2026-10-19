import { ChangeDetectionStrategy, Component, ElementRef, model, signal, viewChild } from '@angular/core';
import { ProductImage } from '../../../core/models/domain.models';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PER_BATCH = 10;
const MAX_EDGE = 1600; // stored images are downscaled; the mock keeps them in memory

async function downscale(file: File): Promise<ProductImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let url = canvas.toDataURL('image/webp', 0.85);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.85);
  return { id: crypto.randomUUID(), url, name: file.name, width, height };
}

// Product photo uploader: drop zone + gallery. The first image is Ảnh chính.
@Component({
  selector: 'app-product-images',
  standalone: true,
  imports: [NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-images.component.html',
  styleUrl: './product-images.component.scss',
})
export class ProductImagesComponent {
  readonly images = model<ProductImage[]>([]);
  readonly dragging = signal(false);
  readonly busy = signal(false);
  readonly errors = signal<string[]>([]);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  pick(): void {
    this.fileInput().nativeElement.click();
  }

  onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.add([...(input.files ?? [])]);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    // Ignore leave events fired when moving between children of the zone.
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node)) this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    void this.add([...(event.dataTransfer?.files ?? [])]);
  }

  async add(files: File[]): Promise<void> {
    const errors: string[] = [];
    if (files.length > MAX_PER_BATCH) {
      errors.push(`Chỉ nhận ${MAX_PER_BATCH} ảnh mỗi lần — đã bỏ qua ${files.length - MAX_PER_BATCH} ảnh cuối.`);
      files = files.slice(0, MAX_PER_BATCH);
    }
    const ok = files.filter((f) => {
      if (!ACCEPTED.includes(f.type)) {
        errors.push(`${f.name}: chỉ nhận JPEG, PNG hoặc WebP.`);
        return false;
      }
      if (f.size > MAX_BYTES) {
        errors.push(`${f.name}: lớn hơn 10MB.`);
        return false;
      }
      return true;
    });

    this.busy.set(true);
    const added: ProductImage[] = [];
    for (const f of ok) {
      try {
        added.push(await downscale(f));
      } catch {
        errors.push(`${f.name}: không đọc được ảnh (file hỏng?).`);
      }
    }
    this.busy.set(false);
    this.errors.set(errors);
    if (added.length) this.images.update((cur) => [...cur, ...added]);
  }

  makePrimary(id: string): void {
    this.images.update((cur) => {
      const img = cur.find((i) => i.id === id);
      return img ? [img, ...cur.filter((i) => i.id !== id)] : cur;
    });
  }

  remove(id: string): void {
    this.images.update((cur) => cur.filter((i) => i.id !== id));
  }
}
