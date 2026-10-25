import { Injectable, inject } from '@angular/core';
import { CompanyInfo } from '../models/domain.models';
import { DataStore } from './data-store.service';
import { ApiService } from '../api/api.service';

// All writes for Thiết lập › Thông tin công ty: PUT /company (permission company.update).
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly data = inject(DataStore);
  private readonly api = inject(ApiService);

  readonly info = this.data.companyInfo.asReadonly();

  async save(info: CompanyInfo): Promise<void> {
    const { lockDate: _l, ...body } = info;
    this.data.companyInfo.set(await this.api.put<CompanyInfo>('/company', body));
  }

  /** Khoá sổ đến ngày (PUT /company/lock-date, quyền period.lock); null = bỏ khoá sổ. */
  async setLockDate(lockDate: string | null): Promise<void> {
    this.data.companyInfo.set(await this.api.put<CompanyInfo>('/company/lock-date', { lockDate }));
  }
}
