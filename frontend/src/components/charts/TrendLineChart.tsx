import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import { BRAND, CHART_CHROME, formatMonthLabel } from '../../lib/chartTheme';

interface TrendPoint {
  label: string;
  value: number;
}

interface TrendLineChartProps {
  data: TrendPoint[];
  name: string;
  color?: string;
  height?: number;
  formatXAxis?: (label: string) => string;
  valueFormatter?: (value: number) => string;
}

export default function TrendLineChart({
  data,
  name,
  color = BRAND,
  height = 280,
  formatXAxis = formatMonthLabel,
  valueFormatter = (v) => String(v),
}: TrendLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} />
        <XAxis
          dataKey="label"
          tickFormatter={formatXAxis}
          tick={{ fill: CHART_CHROME.tick, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: CHART_CHROME.grid }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: CHART_CHROME.tick, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          cursor={{ stroke: CHART_CHROME.tick, strokeDasharray: '4 4' }}
          content={
            <ChartTooltip labelFormatter={formatXAxis} valueFormatter={valueFormatter} />
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          name={name}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
