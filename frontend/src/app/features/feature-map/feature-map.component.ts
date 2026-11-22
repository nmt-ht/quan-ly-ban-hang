import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { FEATURE_MAPS, MIN_W, NODE_H, TARGET_W, featureMapOf, layoutOf } from './feature-maps';

/**
 * /so-do/:key — sơ đồ của một phân hệ chính (bấm tên nhóm ở menu): các màn hình nối với nhau thế nào, chứng từ đi từ đâu sang đâu.
 * Mỗi ô là một liên kết tới màn đó (mờ đi nếu chức vụ không được mở). Màn rộng vẽ sơ đồ SVG; điện thoại hiện danh sách các bước.
 */
@Component({
  selector: 'app-feature-map',
  standalone: true,
  imports: [RouterLink, NavIconComponent],
  templateUrl: './feature-map.component.html',
  styleUrl: './feature-map.component.scss',
})
export class FeatureMapComponent {
  private readonly auth = inject(AuthService);
  private readonly key = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('key'))), { initialValue: null });

  readonly maps = FEATURE_MAPS;
  readonly nodeH = NODE_H;
  readonly def = computed(() => featureMapOf(this.key()));
  /** Width of the drawing's frame; the drawing is spread across it so every map fills the page the same way. */
  private readonly frameW = signal(0);
  private readonly frame = viewChild<ElementRef<HTMLElement>>('frame');
  readonly layout = computed(() => (this.def() ? layoutOf(this.def()!, this.frameW() > 0 ? Math.max(MIN_W, Math.floor(this.frameW())) : TARGET_W) : null));

  constructor() {
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => this.frameW.set(entries[0].contentRect.width));
    effect(() => {
      const el = this.frame()?.nativeElement;
      ro?.disconnect();
      if (el) ro?.observe(el);
    });
    inject(DestroyRef).onDestroy(() => ro?.disconnect());
  }

  /** Điện thoại: mỗi bước một nhóm, mỗi ô kèm "nhận từ" và "đi sang". */
  readonly steps = computed(() => {
    const d = this.def();
    if (!d) return [];
    const label = new Map(d.nodes.map((x) => [x.id, x.label]));
    return d.stages.map((name, i) => ({
      name,
      nodes: d.nodes.filter((x) => x.stage === i).sort((a, b) => a.lane - b.lane).map((x) => ({
        ...x,
        from: d.edges.filter((e) => e.to === x.id).map((e) => label.get(e.from)!),
        to: d.edges.filter((e) => e.from === x.id).map((e) => label.get(e.to)!),
      })),
    })).filter((s) => s.nodes.length);
  });

  can(path: string): boolean {
    return this.auth.canVisit(path);
  }
}
