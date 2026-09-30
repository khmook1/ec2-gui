import { memo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import {
  RESOURCE_SERIES,
  formatClock,
  type ResourceSeries,
  type ResourceSeriesKey,
} from "@/components/dashboard/utils/resourceUi";
import type { ResourceSample } from "@/components/dashboard/utils/useResourceHistory";
import "../css/dashboard.css";

interface ResourceTrendChartProps {
  samples: ResourceSample[];
  /** 지정 시 해당 시리즈만 표시, `null`이면 전체 */
  focused?: ResourceSeriesKey | null;
  /** X축 범위 고정 (선택한 표시 구간). `null`이면 데이터 범위 */
  domain?: [number, number] | null;
  /** 점이 2개 미만일 때 표시할 문구 */
  emptyLabel?: string;
}

function TrendTooltip({
  active,
  payload,
  visibleSeries,
}: TooltipContentProps & { visibleSeries: ResourceSeries[] }) {
  const sample = payload?.[0]?.payload as ResourceSample | undefined;
  if (!active || !sample) {
    return null;
  }

  return (
    <div className="dashboard-trend__tooltip">
      <div className="dashboard-trend__tooltip-time">
        {formatClock(sample.ts, false)}
      </div>
      {[...visibleSeries].reverse().map((series) => {
        const value = sample[series.key];
        return (
          <div key={series.key} className="dashboard-trend__tooltip-row">
            <span
              className="dashboard-trend__dot"
              style={{ background: series.color }}
              aria-hidden
            />
            <span>{series.label}</span>
            <strong>{value == null ? "—" : `${value}%`}</strong>
          </div>
        );
      })}
    </div>
  );
}

export const ResourceTrendChart = memo(function ResourceTrendChart({
  samples,
  focused = null,
  domain = null,
  emptyLabel = "샘플 수집 중…",
}: ResourceTrendChartProps) {
  if (samples.length < 2) {
    return (
      <div className="dashboard-trend dashboard-trend--empty" role="status">
        {emptyLabel}
      </div>
    );
  }

  const visibleSeries = focused
    ? RESOURCE_SERIES.filter((series) => series.key === focused)
    : RESOURCE_SERIES;
  const chartLabel = visibleSeries.map((series) => series.label).join("·");

  return (
    <div
      className="dashboard-trend"
      role="img"
      aria-label={`${chartLabel} 사용률 추이 (샘플 ${samples.length}개)`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={samples}
          margin={{ top: 12, right: 8, bottom: 4, left: 8 }}
        >
          <defs>
            {RESOURCE_SERIES.map((series) => (
              <linearGradient
                key={series.key}
                id={`dashboard-trend-${series.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={series.color} stopOpacity={0.45} />
                <stop
                  offset="100%"
                  stopColor={series.color}
                  stopOpacity={0.02}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={domain ?? ["dataMin", "dataMax"]}
            allowDataOverflow={domain != null}
            tickFormatter={(ts: number) => formatClock(ts, false)}
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            minTickGap={64}
            tick={{ fill: "var(--text-secondary)", fontSize: 13 }}
          />
          <YAxis hide domain={[0, 100]} />
          <Tooltip
            content={(props) => (
              <TrendTooltip {...props} visibleSeries={visibleSeries} />
            )}
            cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
          />
          {visibleSeries.map((series) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={focused ? 2.5 : 2}
              fill={`url(#dashboard-trend-${series.key})`}
              connectNulls
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: series.color }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});
