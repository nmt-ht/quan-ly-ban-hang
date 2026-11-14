import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import {
  Account, BalanceSheetView, EmployeeView, FixedAssetView, IncomeStatementView, JournalEntryView, LedgerView, OpeningBalancesView,
  PayrollCenterKey, PayrollParamsView, PayrollRunSummary, PayrollSheetView, PrepaidItemView, ProductionCostRow, TrialBalanceView,
} from '../models/domain.models';
import {
  AccountBookView, PartnerSummaryView, VatInputsView, VatOutputsView, VatSummaryView,
} from '../models/books-vat.models';

export interface EmployeeInput {
  name: string; center: PayrollCenterKey; baseSalary: number; allowance?: number; insuranceSalary?: number | null; dependents?: number; note?: string;
}

export interface ProductionCostInput {
  orderId: string; kind: 'NHAN_CONG' | 'SAN_XUAT_CHUNG'; amount: number; date: string; creditAccount: string; description?: string;
}

export interface PrepaidItemInput { name: string; cost: number; startDate: string; allocationMonths: number; expenseAccount?: string; fundingAccount?: string; note?: string }

export interface FixedAssetInput { name: string; cost: number; usageStartDate: string; usefulLifeMonths: number; expenseAccount?: string; note?: string }

export interface ManualEntryInput {
  date: string;
  description?: string;
  lines: { accountCode: string; debit: number; credit: number; description?: string }[];
}

/** Sổ cái kế toán (TT133): danh mục TK, nhật ký, sổ cái, cân đối phát sinh, số dư đầu kỳ. */
@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly api = inject(ApiService);

  accounts() {
    return this.api.get<Account[]>('/accounting/accounts');
  }

  journal(from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const s = q.toString();
    return this.api.get<JournalEntryView[]>('/accounting/journal' + (s ? '?' + s : ''));
  }

  ledger(code: string, period?: string) {
    return this.api.get<LedgerView>('/accounting/ledger/' + encodeURIComponent(code) + (period ? '?period=' + period : ''));
  }

  trialBalance(period?: string) {
    return this.api.get<TrialBalanceView>('/accounting/trial-balance' + (period ? '?period=' + period : ''));
  }

  openingBalances(period?: string) {
    return this.api.get<OpeningBalancesView>('/accounting/opening-balances' + (period ? '?period=' + period : ''));
  }

  saveOpening(period: string, rows: { accountCode: string; debit: number; credit: number }[]) {
    return this.api.post<OpeningBalancesView>('/accounting/opening-balances', { period, rows });
  }

  createManual(dto: ManualEntryInput) {
    return this.api.post<{ id: string }>('/accounting/journal', dto);
  }

  reverse(id: string) {
    return this.api.post<{ ok: boolean }>('/accounting/journal/' + id + '/reverse');
  }

  incomeStatement(period?: string) {
    return this.api.get<IncomeStatementView>('/accounting/income-statement' + (period ? '?period=' + period : ''));
  }

  balanceSheet(period?: string) {
    return this.api.get<BalanceSheetView>('/accounting/balance-sheet' + (period ? '?period=' + period : ''));
  }

  closePeriod(period: string) {
    return this.api.post<{ ok: boolean; period: string }>('/accounting/close-period', { period });
  }

  fixedAssets() {
    return this.api.get<FixedAssetView[]>('/accounting/assets');
  }

  createAsset(dto: FixedAssetInput) {
    return this.api.post<FixedAssetView>('/accounting/assets', dto);
  }

  depreciate(period: string) {
    return this.api.post<{ period: string; total: number; count: number }>('/accounting/assets/depreciate', { period });
  }

  employees() {
    return this.api.get<EmployeeView[]>('/accounting/employees');
  }

  createEmployee(dto: EmployeeInput) {
    return this.api.post<EmployeeView>('/accounting/employees', dto);
  }

  updateEmployee(id: string, dto: Partial<EmployeeInput> & { isActive?: boolean }) {
    return this.api.patch<EmployeeView>('/accounting/employees/' + id, dto);
  }

  payrollSettings() {
    return this.api.get<PayrollParamsView>('/accounting/payroll/settings');
  }

  savePayrollSettings(p: PayrollParamsView) {
    return this.api.post<PayrollParamsView>('/accounting/payroll/settings', p);
  }

  payrollPreview(period: string, adjustments: { employeeId: string; amount: number }[]) {
    return this.api.post<PayrollSheetView>('/accounting/payroll/preview', { period, adjustments });
  }

  payrollRun(period: string, adjustments: { employeeId: string; amount: number }[]) {
    return this.api.post<{ id: string; period: string }>('/accounting/payroll/run', { period, adjustments });
  }

  payrollRuns() {
    return this.api.get<PayrollRunSummary[]>('/accounting/payroll/runs');
  }

  payrollRunDetail(period: string) {
    return this.api.get<PayrollSheetView>('/accounting/payroll/runs/' + period);
  }

  payrollCancel(period: string) {
    return this.api.post<{ ok: boolean; reversed: number }>('/accounting/payroll/runs/' + period + '/cancel');
  }

  productionCosts() {
    return this.api.get<ProductionCostRow[]>('/accounting/production-costs');
  }

  addProductionCost(dto: ProductionCostInput) {
    return this.api.post<{ id: string; date: string }>('/accounting/production-costs', dto);
  }

  prepaidItems() {
    return this.api.get<PrepaidItemView[]>('/accounting/prepaid');
  }

  createPrepaid(dto: PrepaidItemInput) {
    return this.api.post<PrepaidItemView>('/accounting/prepaid', dto);
  }

  allocatePrepaid(period: string) {
    return this.api.post<{ period: string; total: number; count: number }>('/accounting/prepaid/allocate', { period });
  }

  // ---------- Sổ sách TT133 ----------
  accountBook(code: string, from: string, to: string, partnerId?: string) {
    const q = new URLSearchParams({ code, from, to });
    if (partnerId) q.set('partnerId', partnerId);
    return this.api.get<AccountBookView>('/accounting/books/account?' + q.toString());
  }

  partnerSummary(code: string, from: string, to: string) {
    return this.api.get<PartnerSummaryView>('/accounting/books/partners?' + new URLSearchParams({ code, from, to }).toString());
  }

  // ---------- Thuế GTGT ----------
  vatOutputs(from: string, to: string) {
    return this.api.get<VatOutputsView>('/accounting/vat/outputs?' + new URLSearchParams({ from, to }).toString());
  }

  vatInputs(from: string, to: string) {
    return this.api.get<VatInputsView>('/accounting/vat/inputs?' + new URLSearchParams({ from, to }).toString());
  }

  vatSummary(from: string, to: string) {
    return this.api.get<VatSummaryView>('/accounting/vat/summary?' + new URLSearchParams({ from, to }).toString());
  }

  vatOffset(date: string) {
    return this.api.post<{ id: string; amount: number; date: string }>('/accounting/vat/offset', { date });
  }

  settings() {
    return this.api.get<{ ledgerStartDate?: string | null }>('/accounting/settings');
  }

  setSettings(ledgerStartDate: string | null) {
    return this.api.post<{ ledgerStartDate?: string | null }>('/accounting/settings', { ledgerStartDate });
  }
}
