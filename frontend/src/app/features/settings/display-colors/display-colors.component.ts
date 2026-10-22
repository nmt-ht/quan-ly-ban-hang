import { Component, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { DisplayColorsService, TAG_PRESETS, TagColor, TagGroup, TagItem } from '../../../core/services/display-colors.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { tagClass } from '../../../shared/tag-class';

// Thiết lập › Màu hiển thị: master-detail. Pick a group of labels on the left (each shows its current
// palette as dots); on the right see the whole group on a light and a dark ground at once, then
// change one value with a swatch or — for any other hue — the slider under "Tuỳ chỉnh sắc độ".
@Component({
  selector: 'app-display-colors',
  standalone: true,
  imports: [NgClass, NavIconComponent],
  templateUrl: './display-colors.component.html',
  styleUrl: './display-colors.component.scss',
})
export class DisplayColorsComponent {
  readonly colors = inject(DisplayColorsService);
  readonly presets = TAG_PRESETS;
  readonly groups = this.colors.groups;

  readonly selectedId = signal(this.groups[0].id);
  readonly group = computed(() => this.groups.find((g) => g.id === this.selectedId()) ?? this.groups[0]);
  /** Item whose hue slider is open (`group:key`), one at a time. */
  readonly sliderOpen = signal<string | null>(null);

  select(g: TagGroup): void {
    this.selectedId.set(g.id);
    this.sliderOpen.set(null);
  }

  cls(g: TagGroup, i: TagItem): string {
    return tagClass(g.id, i.key);
  }

  current(g: TagGroup, i: TagItem): TagColor {
    return this.colors.colorOf(g.id, i.key);
  }

  hue(g: TagGroup, i: TagItem): number {
    const c = this.current(g, i);
    return c === 'neutral' ? 100 : c;
  }

  isPicked(g: TagGroup, i: TagItem, color: TagColor): boolean {
    return this.current(g, i) === color;
  }

  pick(g: TagGroup, i: TagItem, color: TagColor): void {
    this.colors.set(g.id, i.key, color);
  }

  slide(g: TagGroup, i: TagItem, value: string): void {
    this.colors.set(g.id, i.key, Number(value));
  }

  changedIn(g: TagGroup): number {
    return g.items.filter((i) => !this.colors.isDefault(g.id, i.key)).length;
  }

  isChanged(g: TagGroup, i: TagItem): boolean {
    return !this.colors.isDefault(g.id, i.key);
  }

  toggleSlider(g: TagGroup, i: TagItem): void {
    const k = `${g.id}:${i.key}`;
    this.sliderOpen.update((cur) => (cur === k ? null : k));
  }

  isSliderOpen(g: TagGroup, i: TagItem): boolean {
    return this.sliderOpen() === `${g.id}:${i.key}`;
  }

  // Swatch / dot values (inline custom properties, same formula as .tag).
  swatchH(c: TagColor): number {
    return c === 'neutral' ? 100 : c;
  }

  swatchC(c: TagColor): number {
    return c === 'neutral' ? 0.1 : 1;
  }

  colorName(c: TagColor): string {
    return this.presets.find((p) => p.color === c)?.name ?? `Sắc độ ${c}°`;
  }
}
