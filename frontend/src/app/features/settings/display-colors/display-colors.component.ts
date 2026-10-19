import { Component } from '@angular/core';
import { NgClass } from '@angular/common';
import { DisplayColorsService, TAG_PRESETS, TagColor, TagGroup, TagItem } from '../../../core/services/display-colors.service';
import { NavIconComponent } from '../../../layout/nav-icon/nav-icon.component';
import { tagClass } from '../../../shared/tag-class';

@Component({
  selector: 'app-display-colors',
  standalone: true,
  imports: [NgClass, NavIconComponent],
  templateUrl: './display-colors.component.html',
  styleUrl: './display-colors.component.scss',
})
export class DisplayColorsComponent {
  readonly presets = TAG_PRESETS;

  constructor(readonly colors: DisplayColorsService) {}

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

  groupChanged(g: TagGroup): boolean {
    return g.items.some((i) => !this.colors.isDefault(g.id, i.key));
  }

  // Swatch preview values (inline custom properties, same formula as .tag).
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
