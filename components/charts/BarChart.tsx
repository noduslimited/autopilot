// Native SVG bar chart — no third-party charting library (CLAUDE.md rule 8,
// Design System Document section 7.9). Bar heights/paths are calculated at
// runtime from `data`, which cannot be expressed as static Tailwind classes
// — the one exception CLAUDE.md rule 6 carves out for inline/computed
// styling in SVG charts.
export interface BarChartDataPoint {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  /** Base colour (hex) — the current/last bar renders at full strength, earlier bars progressively lighter. */
  color: string;
  /** Scale ceiling for bar height. Defaults to 100 (percentage-style charts, per the PRD's two chart examples). */
  maxValue?: number;
  height?: number;
}

const BAR_RADIUS = 4;
const CHART_WIDTH = 320;
const BAR_GAP = 8;

function roundedTopBarPath(x: number, y: number, width: number, barHeight: number, radius: number): string {
  const r = Math.min(radius, width / 2, barHeight);
  const top = y;
  const bottom = y + barHeight;
  return [
    `M${x},${bottom}`,
    `L${x},${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `L${x + width - r},${top}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `L${x + width},${bottom}`,
    "Z",
  ].join(" ");
}

export function BarChart({ data, color, maxValue = 100, height = 120 }: BarChartProps) {
  const barWidth = data.length > 0 ? (CHART_WIDTH - BAR_GAP * (data.length - 1)) / data.length : 0;
  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[20px] font-bold text-text-primary">{latestValue}%</span>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${CHART_WIDTH} ${height}`}
        role="img"
        aria-label="Bar chart"
        className="mt-2"
      >
        {data.map((point, index) => {
          const x = index * (barWidth + BAR_GAP);
          const barHeight = maxValue > 0 ? (Math.max(0, Math.min(point.value, maxValue)) / maxValue) * height : 0;
          const y = height - barHeight;
          const isCurrent = index === data.length - 1;
          const opacity = data.length > 1 ? 0.3 + (0.7 * index) / (data.length - 1) : 1;

          return (
            <path
              key={point.label + index}
              d={roundedTopBarPath(x, y, barWidth, barHeight, BAR_RADIUS)}
              fill={color}
              fillOpacity={isCurrent ? 1 : opacity}
            />
          );
        })}
      </svg>

      <div className="mt-1 flex" style={{ gap: `${BAR_GAP}px` }}>
        {data.map((point, index) => (
          <span
            key={point.label + index}
            className="text-center text-tiny text-text-muted"
            style={{ width: `${barWidth}px` }}
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
