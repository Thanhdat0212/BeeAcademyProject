/**
 * Bảng màu + helper dùng chung cho mọi biểu đồ (Recharts).
 *
 * Recharts nhận chuỗi màu hex, không dùng được class Tailwind, nên màu M3
 * được ánh xạ sang hex ở đây. Palette categorical đã qua validator CVD-safe
 * (dataviz skill) trên nền card trắng — giữ nguyên thứ tự slot khi dùng.
 */

/** Màu thương hiệu (M3 --color-primary) — dùng cho chart 1 chuỗi. */
export const BRAND = '#ad2c00';

/** Xanh dương tương phản mạnh với brand — dùng làm chuỗi thứ 2 (phí nền tảng). */
export const BRAND_ALT = '#2a78d6';

/**
 * Palette phân loại (đã validate CVD trên nền trắng). Gán theo thứ tự slot,
 * không xoay vòng. Slice pie cần nhãn trực tiếp vì vài hue < 3:1 contrast.
 */
export const CATEGORICAL = [
  '#2a78d6', // xanh dương
  '#008300', // lục
  '#e87ba4', // hồng
  '#eda100', // vàng
  '#1baf7a', // ngọc
  '#eb6834', // cam
  '#4a3aa7', // tím
  '#e34948', // đỏ
] as const;

/** Màu chrome/ink cho trục, lưới, tooltip — recessive, không lấn dữ liệu. */
export const CHART_CHROME = {
  grid: '#e7e8ec', // M3 surface-container-high
  tick: '#6b7075', // xám trung tính cho nhãn trục
  surface: '#ffffff', // nền card chứa chart
  tooltipBorder: 'rgba(25,28,31,0.12)',
} as const;

/** Rút gọn tiền VND cho nhãn trục: 1.2M, 900K. */
export function formatVndShort(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}Tr`;
  }
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

/** Tiền VND đầy đủ cho tooltip. */
export function formatVndFull(v: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(v)}₫`;
}

/** "2026-06" → "T6/26" cho nhãn trục thời gian. */
export function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  if (!month) return ym;
  return `T${Number(month)}/${year.slice(2)}`;
}
