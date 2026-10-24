import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { DebtReminder, ReminderChannel } from './reminder.rules';

export interface ReminderDraft {
  customerId: string;
  channel: ReminderChannel;
  note?: string;
  promisedDate?: string;
  promisedAmount?: number;
}

// Lịch sử nhắc nợ (Pha 2): read when a debt screen opens, appended after each "Ghi nhận đã nhắc".
@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly api = inject(ApiService);
  readonly all = signal<DebtReminder[]>([]);

  async load(): Promise<void> {
    this.all.set(await this.api.get<DebtReminder[]>('/debt-reminders'));
  }

  async record(d: ReminderDraft): Promise<DebtReminder> {
    const r = await this.api.post<DebtReminder>('/debt-reminders', d);
    this.all.update((list) => [r, ...list]);
    return r;
  }

  /** Latest first. */
  of(customerId: string): DebtReminder[] {
    return this.all().filter((r) => r.customerId === customerId);
  }
}
