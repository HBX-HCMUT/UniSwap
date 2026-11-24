const currency = new Intl.NumberFormat('vi-VN');
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

export const money = (amount: number) => `${currency.format(amount)} đ`;
export const moment = (date: string) => dateTime.format(new Date(date));
export function vietnamDateTime(value: string) { return new Date(`${value}+07:00`).toISOString(); }
export function vietnamDate(value: string, end = false) {
  const result = new Date(`${value}T00:00:00+07:00`);
  if (end) result.setUTCDate(result.getUTCDate() + 1);
  return result.toISOString();
}
