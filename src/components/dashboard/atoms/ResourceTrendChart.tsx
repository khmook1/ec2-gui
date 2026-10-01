import { memo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
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
import type { ResourceTrendPoint } from "@/components/dashboard/utils/useResourceHistory";
import "../css/dashboard.css";

const GAP_LABEL = "집계 안됨";
/** 표시 구간 대비 이보다 좁은 빈 구간에는 라벨을 그리지 않는다 (글자가 넘침). */
const GAP_LABEL_MIN_RATIO = 0.08;

interface ResourceTrendChartProps {
  samples: ResourceTrendPoint[];
  /** 샘플이 없는 [시작, 끝] 구간. 차트에 `집계 안됨`으로 표시 */
  gaps?: [number, number][];
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
  const sample = payload?.[0]?.payload as ResourceTrendPoint | undefined;
  if (!active || !sample) {
    return null;
  }

  if (sample.gap) {
    return (
      <div className="dashboard-trend__tooltip">
        <div className="dashboard-trend__tooltip-time">
          {formatClock(sample.gap[0], false)} ~{" "}
          {formatClock(sample.gap[1], false)}
        </div>
        <div className="dashboard-trend__tooltip-gap">{GAP_LABEL}</div>
      </div>
    );
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
  gaps = [],
  focused = null,
  domain = null,
  emptyLabel = "샘플 수집 중…",
}: ResourceTrendChartProps) {
  const sampleCount = samples.filter((sample) => sample.gap == null).length;
  if (sampleCount < 2) {
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
  const domainSpan = domain ? domain[1] - domain[0] : 0;

  return (
    <div
      className="dashboard-trend"
      role="img"
      aria-label={`${chartLabel} 사용률 추이 (샘플 ${sampleCount}개${gaps.length > 0 ? `, ${GAP_LABEL} 구간 ${gaps.length}개` : ""})`}
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
          {gaps.map(([x1, x2]) => (
            <ReferenceArea
              key={x1}
              x1={x1}
              x2={x2}
              className="dashboard-trend__gap"
              fill="var(--text-secondary)"
              fillOpacity={0.08}
              stroke="var(--border)"
              strokeDasharray="4 4"
              label={
                domainSpan > 0 && (x2 - x1) / domainSpan >= GAP_LABEL_MIN_RATIO
                  ? {
                      value: GAP_LABEL,
                      position: "center",
                      fill: "var(--text-secondary)",
                      fontSize: 13,
                    }
                  : undefined
              }
            />
          ))}
          <Tooltip
            filterNull={false}
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
