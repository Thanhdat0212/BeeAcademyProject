/** Helper định dạng dùng chung cho các panel Admin. */

/** 1500000 → "1.500.000đ" */
export function formatVnd(amount: number): string {
  return `${amount.toLocaleString('vi-VN')}đ`;
}

/** ISO → "DD/MM/YYYY" */
export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN');
}

/** ISO → "DD/MM/YYYY HH:mm" */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** ISO → "x phút trước" / "x giờ trước" / ngày tháng. */
export function formatRelativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

/** "2026-06" → "Tháng 06/2026" */
export function formatMonthYear(monthYear: string): string {
  const [year, month] = monthYear.split('-');
  return `Tháng ${month}/${year}`;
}
