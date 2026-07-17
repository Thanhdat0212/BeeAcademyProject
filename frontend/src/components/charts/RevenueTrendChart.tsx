import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import {
  CHART_CHROME,
  formatMonthLabel,
  formatVndFull,
  formatVndShort,
} from '../../lib/chartTheme';

export interface RevenueSeries {
  key: string;
  name: string;
  color: string;
}

interface RevenueTrendChartProps {
  /** Mỗi phần tử có `month` + các khóa số theo `series.key`. */
  data: object[];
  series: RevenueSeries[];
  height?: number;
}

export default function RevenueTrendChart({
  data,
  series,
  height = 280,
}: RevenueTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonthLabel}
          tick={{ fill: CHART_CHROME.tick, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: CHART_CHROME.grid }}
        />
        <YAxis
          tickFormatter={formatVndShort}
          tick={{ fill: CHART_CHROME.tick, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ stroke: CHART_CHROME.tick, strokeDasharray: '4 4' }}
          content={
            <ChartTooltip labelFormatter={formatMonthLabel} valueFormatter={formatVndFull} />
          }
        />
        {series.length > 1 && (
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8, color: CHART_CHROME.tick }}
          />
        )}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stackId={series.length > 1 ? 'revenue' : undefined}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#grad-${s.key})`}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
