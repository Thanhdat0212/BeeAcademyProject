import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  delay?: number;
  children: ReactNode;
}

export default function ChartCard({
  title,
  subtitle,
  action,
  loading = false,
  isEmpty = false,
  emptyText = 'Chưa có dữ liệu',
  delay = 0,
  children,
}: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-on-surface">{title}</h3>
          {subtitle && (
            <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-on-surface-variant">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : isEmpty ? (
        <div className="h-64 flex items-center justify-center text-sm text-on-surface-variant">
          {emptyText}
        </div>
      ) : (
        children
      )}
    </motion.div>
  );
}
