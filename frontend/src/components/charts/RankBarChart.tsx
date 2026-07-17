import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import { BRAND, CATEGORICAL, CHART_CHROME } from '../../lib/chartTheme';

export interface RankItem {
  label: string;
  value: number;
}

interface RankBarChartProps {
  data: RankItem[];
  name: string;
  color?: string;
  multicolor?: boolean;
  height?: number;
  valueFormatter?: (value: number) => string;
}

export default function RankBarChart({
  data,
  name,
  color = BRAND,
  multicolor = false,
  height = 280,
  valueFormatter = (v) => String(v),
}: RankBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        barCategoryGap={8}
      >
        <CartesianGrid horizontal={false} stroke={CHART_CHROME.grid} />
        <XAxis
          type="number"
          tickFormatter={valueFormatter}
          tick={{ fill: CHART_CHROME.tick, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: CHART_CHROME.tick, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: CHART_CHROME.grid, fillOpacity: 0.4 }}
          content={<ChartTooltip valueFormatter={valueFormatter} />}
        />
        <Bar dataKey="value" name={name} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={multicolor ? CATEGORICAL[i % CATEGORICAL.length] : color}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
