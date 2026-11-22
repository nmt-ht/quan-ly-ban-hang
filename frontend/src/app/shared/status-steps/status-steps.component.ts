import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NavIconComponent } from '../../layout/nav-icon/nav-icon.component';
import { StatusStep, StepState } from './status-steps';

export type { StatusStep, StepState };
export { stepsAt } from './status-steps';

const STATE_TEXT: Record<StepState, string> = { done: 'đã xong', current: 'đang ở bước này', todo: 'chưa tới' };

// Where a document is in its life, drawn as numbered markers joined by a line: a ticked filled marker for a step that is
// done, a ringed marker for the one it is at, a hollow grey one for what is still to come. The line after a done step is
// moss, the rest grey, so the progress reads at a glance without reading a word. Wide: a row; narrow (by the width of its
// own container, not the screen): a column. Read aloud as an ordered list, the current step marked aria-current="step".
@Component({
  selector: 'app-status-steps',
  standalone: true,
  imports: [NavIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './status-steps.component.scss',
  template: `
    <ol class="ss-steps" [attr.aria-label]="ariaLabel() || null">
      @for (s of steps(); track s.label; let i = $index) {
        <li class="ss-step" [class]="'is-' + s.state" [attr.aria-current]="s.state === 'current' ? 'step' : null">
          <span class="ss-mark num" aria-hidden="true">
            @if (s.state === 'done') { <app-nav-icon name="check" /> } @else { {{ i + 1 }} }
          </span>
          <span class="ss-label">{{ s.label }}@if (s.hint) { <span class="ss-hint">· {{ s.hint }}</span> }<span class="visually-hidden"> — {{ text[s.state] }}</span></span>
        </li>
      }
    </ol>
  `,
})
export class StatusStepsComponent {
  readonly steps = input.required<StatusStep[]>();
  readonly ariaLabel = input('');
  readonly text = STATE_TEXT;
}
