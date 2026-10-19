export function formatVnd(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

export function formatVndSigned(amount: number): string {
  const sign = amount > 0 ? '+' : '';
  return sign + formatVnd(amount);
}
