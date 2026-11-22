import { Injectable, inject } from '@angular/core';
import { ApiService, upsertById } from '../../core/api/api.service';
import { Contract, ContractDraft } from '../../core/models/contract.models';
import { DataStore } from '../../core/services/data-store.service';

// Writes for Hợp đồng. The server checks the rules (đúng đối tác, chỉ sửa khi còn đang thực hiện, thanh lý không trước ngày ký…)
// and numbers the HDB… / HDM…; the list holds the contracts without their orders, the detail call adds them.
@Injectable({ providedIn: 'root' })
export class ContractService {
  private readonly data = inject(DataStore);
  private readonly api = inject(ApiService);

  /** The saved contract replaces the list copy; its orders are kept only on the detail (returned to the caller). */
  private keep(c: Contract): Contract {
    const { orders: _orders, ...row } = c;
    this.data.contracts.update((list) => upsertById(list, row as Contract));
    return c;
  }

  find(id: string): Contract | undefined {
    return this.data.contracts().find((c) => c.id === id);
  }

  /** One contract with the orders linked to it. */
  async detail(id: string): Promise<Contract> {
    return this.keep(await this.api.get<Contract>(`/contracts/${id}`));
  }

  async create(d: ContractDraft): Promise<Contract> {
    return this.keep(await this.api.post<Contract>('/contracts', d));
  }

  async update(id: string, d: ContractDraft): Promise<Contract> {
    // updatedAt: the server refuses the save if someone else changed the contract since it was loaded.
    return this.keep(await this.api.put<Contract>(`/contracts/${id}`, { ...d, updatedAt: this.find(id)?.updatedAt }));
  }

  liquidate(id: string, date: string, note: string): Promise<Contract> {
    return this.close(id, 'liquidate', date, note);
  }

  cancel(id: string, date: string, note: string): Promise<Contract> {
    return this.close(id, 'cancel', date, note);
  }

  private async close(id: string, action: 'liquidate' | 'cancel', date: string, note: string): Promise<Contract> {
    return this.keep(await this.api.post<Contract>(`/contracts/${id}/${action}`, { date, note: note.trim() || undefined }));
  }
}
