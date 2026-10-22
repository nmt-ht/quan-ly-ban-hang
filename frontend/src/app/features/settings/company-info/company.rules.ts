// Format rules for Thông tin công ty (same patterns as Khách hàng / Nhà cung cấp, so a number
// accepted there is accepted here).

export const PHONE_PATTERN = /^[0-9+().\s-]{8,15}$/;
/** 10 chữ số; chi nhánh: 10 số + "-" + 3 số. */
export const TAX_CODE_PATTERN = /^\d{10}(-\d{3})?$/;
/** Tên miền, có thể kèm https:// và đường dẫn; không có khoảng trắng. */
export const WEBSITE_PATTERN = /^(https?:\/\/)?[^\s./]+(\.[^\s./]+)+(\/\S*)?$/i;
