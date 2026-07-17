import { CHART_CHROME } from '../../lib/chartTheme';

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
}

export default function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = (v) => String(v),
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const heading =
    label !== undefined && labelFormatter
      ? labelFormatter(String(label))
      : label !== undefined
        ? String(label)
        : undefined;

  return (
    <div
      className="rounded-xl bg-surface-container-lowest px-3 py-2 shadow-md"
      style={{ border: `1px solid ${CHART_CHROME.tooltipBorder}` }}
    >
      {heading && (
        <p className="text-xs font-semibold text-on-surface mb-1">{heading}</p>
      )}
      <div className="space-y-1">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: item.color }}
            />
            {item.name && (
              <span className="text-on-surface-variant">{item.name}:</span>
            )}
            <span className="font-semibold text-on-surface tabular-nums">
              {valueFormatter(typeof item.value === 'number' ? item.value : 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
