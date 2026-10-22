import { CompanyInfo } from '../models/domain.models';

// Thông tin công ty is the one company-wide setting the user edits today, so it survives a reload
// (the rest of the mock data resets). Pure functions: MockDataService seeds its signal from here
// and CompanyService writes back, without either importing the other.
const STORAGE_KEY = 'nt.company';

export function loadCompany(fallback: CompanyInfo): CompanyInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<CompanyInfo>) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveCompany(info: CompanyInfo): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {
    /* storage blocked: the change lasts for this session */
  }
}

export function clearSavedCompany(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing stored */
  }
}
