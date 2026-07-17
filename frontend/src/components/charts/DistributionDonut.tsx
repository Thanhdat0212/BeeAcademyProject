import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import { CATEGORICAL, CHART_CHROME } from '../../lib/chartTheme';

export interface DonutSlice {
  label: string;
  value: number;
}

interface DistributionDonutProps {
  data: DonutSlice[];
  height?: number;
  colors?: readonly string[];
  valueFormatter?: (value: number) => string;
}

interface SliceLabelProps {
  percent?: number;
}

function renderPercent({ percent }: SliceLabelProps): string {
  if (percent === undefined || percent < 0.06) return '';
  return `${Math.round(percent * 100)}%`;
}

export default function DistributionDonut({
  data,
  height = 280,
  colors = CATEGORICAL,
  valueFormatter = (v) => String(v),
}: DistributionDonutProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="55%"
          outerRadius="82%"
          paddingAngle={2}
          stroke={CHART_CHROME.surface}
          strokeWidth={2}
          label={renderPercent}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, paddingTop: 8, color: CHART_CHROME.tick }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
