import { Injectable, inject } from '@angular/core';
import { CompanyInfo } from '../models/domain.models';
import { MockDataService } from './mock-data.service';
import { saveCompany } from './company.storage';
import { ApiService } from '../api/api.service';
import { CATALOG_FROM_API } from '../api/api.config';

// All writes for Thiết lập › Thông tin công ty: PUT /company (permission company.update), or in demo
// mode this browser's storage.
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly data = inject(MockDataService);
  private readonly api = inject(ApiService);

  readonly info = this.data.companyInfo.asReadonly();

  async save(info: CompanyInfo): Promise<void> {
    if (CATALOG_FROM_API) {
      this.data.companyInfo.set(await this.api.put<CompanyInfo>('/company', info));
      return;
    }
    this.data.companyInfo.set(info);
    saveCompany(info);
  }
}
