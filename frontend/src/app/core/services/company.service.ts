import { Injectable, inject } from '@angular/core';
import { CompanyInfo } from '../models/domain.models';
import { MockDataService } from './mock-data.service';
import { saveCompany } from './company.storage';

// All writes for Thiết lập › Thông tin công ty. Against the mock store today; maps to
// PUT /company on the backend later (permission company.update).
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly data = inject(MockDataService);

  readonly info = this.data.companyInfo.asReadonly();

  save(info: CompanyInfo): void {
    this.data.companyInfo.set(info);
    saveCompany(info);
  }
}
