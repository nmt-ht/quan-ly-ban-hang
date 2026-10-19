import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MockDataService } from '../../../core/services/mock-data.service';

@Component({
  selector: 'app-company-info',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-info.component.html',
})
export class CompanyInfoComponent {
  readonly today = new Date().toLocaleDateString('vi-VN');

  constructor(readonly data: MockDataService) {}

  save(): void {
    this.data.companyInfo.set({ ...this.data.companyInfo() });
  }
}
