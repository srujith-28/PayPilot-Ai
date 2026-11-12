import React, { useState } from 'react';
import type { CashflowPoint } from '../../types/index.ts';

interface CashflowChartProps {
  data: CashflowPoint[];
  minimumReserve: number;
  simulatedExpense?: {
    amount: number;
    startWeekIndex: number;
  };
  compact?: boolean;
}

export const CashflowChart: React.FC<CashflowChartProps> = ({
  data,
  minimumReserve,
  simulatedExpense,
  compact = false,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">
        No forecast data available.
      </div>
    );
  }

  // Dimensions
  const height = compact ? 220 : 360;
  const width = 840;
  const padding = {
    top: 25,
    right: 25,
    bottom: compact ? 30 : 50,
    left: compact ? 55 : 65,
  };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min and max for Y-axis scale
  const allValues: number[] = [minimumReserve, 0];
  data.forEach((d) => {
    allValues.push(d.p80EndingCash, d.p20EndingCash, d.projectedEndingCash, d.expectedIncoming, d.expectedOutgoing);
    if (simulatedExpense && d.weekIndex >= simulatedExpense.startWeekIndex) {
      allValues.push(d.projectedEndingCash - simulatedExpense.amount);
    }
  });

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const yMin = Math.floor(Math.min(0, rawMin) / 5000) * 5000;
  const yMax = Math.ceil((rawMax * 1.1) / 5000) * 5000;

  const getY = (val: number) => {
    return padding.top + chartHeight - ((val - yMin) / (yMax - yMin)) * chartHeight;
  };

  const getX = (index: number) => {
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  // Build SVG Paths for P50 line, P20 line, P80 line, and simulated line
  const p50Points = data.map((d, i) => `${getX(i)},${getY(d.projectedEndingCash)}`).join(' ');
  const p20Points = data.map((d, i) => ({ x: getX(i), y: getY(d.p20EndingCash) }));
  const p80Points = data.map((d, i) => ({ x: getX(i), y: getY(d.p80EndingCash) }));

  // Fan chart polygon: P80 line forward, then P20 line backwards
  const fanPolygonPoints = [
    ...p80Points.map((p) => `${p.x},${p.y}`),
    ...[...p20Points].reverse().map((p) => `${p.x},${p.y}`),
  ].join(' ');

  // Simulated expense curve
  let simulatedPoints = '';
  if (simulatedExpense && simulatedExpense.amount > 0) {
    simulatedPoints = data
      .map((d, i) => {
        const val =
          i >= simulatedExpense.startWeekIndex
            ? d.projectedEndingCash - simulatedExpense.amount
            : d.projectedEndingCash;
        return `${getX(i)},${getY(val)}`;
      })
      .join(' ');
  }

  // Y-axis gridlines
  const yStep = (yMax - yMin) / 5;
  const yTicks = Array.from({ length: 6 }, (_, i) => yMin + i * yStep);

  const reserveY = getY(minimumReserve);

  const hoveredPoint = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="relative w-full overflow-hidden select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible font-sans"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="p50Grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="uncertaintyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#99f6e4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ccfbf1" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Y Gridlines and Labels */}
        {yTicks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="2 3"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px] tabular-nums font-mono"
              >
                ${(tick / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}

        {/* Minimum Cash Reserve Floor Threshold */}
        {reserveY >= padding.top && reserveY <= height - padding.bottom && (
          <g>
            <line
              x1={padding.left}
              y1={reserveY}
              x2={width - padding.right}
              y2={reserveY}
              stroke="#e11d48"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={width - padding.right - 4}
              y={reserveY - 6}
              textAnchor="end"
              className="fill-rose-700 text-[10px] font-semibold tracking-wide"
            >
              Min Reserve Floor: ${minimumReserve.toLocaleString()}
            </text>
          </g>
        )}

        {/* Uncertainty Fan Area (P20 to P80 range) */}
        <polygon points={fanPolygonPoints} fill="url(#uncertaintyGrad)" />

        {/* P50 Expected Net Cash Area */}
        <polygon
          points={`${padding.left},${getY(0)} ${p50Points} ${width - padding.right},${getY(0)}`}
          fill="url(#p50Grad)"
        />

        {/* Weekly Incoming & Outgoing Flow Bars */}
        {data.map((d, i) => {
          const x = getX(i);
          const barWidth = compact ? 8 : 12;
          const barOffset = barWidth / 2;

          // Incoming bar (teal/emerald)
          const inHeight = ((d.expectedIncoming - 0) / (yMax - yMin)) * chartHeight;
          const inY = getY(0) - inHeight;

          // Outgoing bar (slate/rose)
          const outHeight = ((d.expectedOutgoing - 0) / (yMax - yMin)) * chartHeight;
          const outY = getY(0);

          return (
            <g key={`bars-${d.weekIndex}`} className="opacity-80 hover:opacity-100 transition-opacity">
              {d.expectedIncoming > 0 && (
                <rect
                  x={x - barOffset - 2}
                  y={inY}
                  width={barWidth / 2}
                  height={Math.max(2, inHeight)}
                  rx="1"
                  fill="#10b981"
                  className="transition-all"
                />
              )}
              {d.expectedOutgoing > 0 && (
                <rect
                  x={x + 2}
                  y={outY}
                  width={barWidth / 2}
                  height={Math.max(2, outHeight)}
                  rx="1"
                  fill="#f43f5e"
                  className="transition-all"
                />
              )}
            </g>
          );
        })}

        {/* P80 Line (Optimistic - subtle dashed) */}
        <polyline
          fill="none"
          stroke="#0d9488"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity="0.4"
          points={p80Points.map((p) => `${p.x},${p.y}`).join(' ')}
        />

        {/* P20 Line (Conservative - subtle dashed) */}
        <polyline
          fill="none"
          stroke="#0f766e"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity="0.4"
          points={p20Points.map((p) => `${p.x},${p.y}`).join(' ')}
        />

        {/* Simulated Expense Trajectory (if active) */}
        {simulatedPoints && (
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeDasharray="5 3"
            points={simulatedPoints}
          />
        )}

        {/* Main P50 Projected Cash Ending Line */}
        <polyline
          fill="none"
          stroke="#0f766e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={p50Points}
        />

        {/* Interactive Data Points and Invisible Hit Areas */}
        {data.map((d, i) => {
          const x = getX(i);
          const y = getY(d.projectedEndingCash);
          const isHovered = hoveredIndex === i;

          return (
            <g key={`pt-${d.weekIndex}`}>
              {/* Visible circle marker */}
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 5.5 : 3.5}
                fill={isHovered ? '#0f766e' : '#ffffff'}
                stroke="#0f766e"
                strokeWidth={isHovered ? 2.5 : 2}
                className="transition-all"
              />

              {/* X Axis Label */}
              <text
                x={x}
                y={height - padding.bottom + (compact ? 16 : 22)}
                textAnchor="middle"
                className={`text-[10px] font-medium tabular-nums ${
                  isHovered ? 'fill-slate-900 font-bold' : 'fill-slate-500'
                }`}
              >
                {compact ? `W${d.weekIndex + 1}` : d.weekLabel}
              </text>

              {/* Broad hit region for mouse hover */}
              <rect
                x={x - chartWidth / (data.length * 2)}
                y={padding.top}
                width={chartWidth / data.length}
                height={chartHeight + padding.bottom}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
              />
            </g>
          );
        })}
      </svg>

      {/* Interactive Tooltip Card */}
      {hoveredPoint && (
        <div
          className="absolute pointer-events-none z-20 rounded-lg border border-slate-200 bg-white/98 p-3 shadow-lg text-xs backdrop-blur-xs transition-all w-64"
          style={{
            left: `${Math.min(
              75,
              Math.max(15, (getX(hoveredPoint.weekIndex) / width) * 100)
            )}%`,
            top: '8px',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
            <span className="font-semibold text-slate-900">{hoveredPoint.weekLabel}</span>
            <span className="text-[11px] text-slate-500">{hoveredPoint.dateRange}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Projected Ending Cash:</span>
              <span className="font-bold text-teal-800 tabular-nums">
                ${hoveredPoint.projectedEndingCash.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                Expected Inflow:
              </span>
              <span className="font-semibold text-emerald-700 tabular-nums">
                +${hoveredPoint.expectedIncoming.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                Expected Outflow:
              </span>
              <span className="font-semibold text-rose-700 tabular-nums">
                -${hoveredPoint.expectedOutgoing.toLocaleString()}
              </span>
            </div>

            <div className="border-t border-slate-100 pt-1.5 flex justify-between items-center text-[10px] text-slate-500">
              <span>Uncertainty Range:</span>
              <span className="tabular-nums font-mono">
                P20: ${hoveredPoint.p20EndingCash.toLocaleString()} · P80: ${hoveredPoint.p80EndingCash.toLocaleString()}
              </span>
            </div>

            {simulatedExpense && hoveredPoint.weekIndex >= simulatedExpense.startWeekIndex && (
              <div className="border-t border-amber-100 pt-1.5 flex justify-between items-center text-[11px] text-amber-900 font-medium">
                <span>With ${simulatedExpense.amount} expense:</span>
                <span className="font-bold tabular-nums">
                  ${(hoveredPoint.projectedEndingCash - simulatedExpense.amount).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart Legend */}
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-teal-800 inline-block" />
            <span>P50 Expected Cash Balance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-teal-200/60 inline-block" />
            <span>Uncertainty Range (P20 – P80)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500 inline-block" />
            <span>Inflows</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-rose-500 inline-block" />
            <span>Outflows</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-rose-600 inline-block" />
            <span>Minimum Cash Reserve</span>
          </div>
          {simulatedExpense && (
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-500 inline-block" />
              <span>Simulated Purchase Path</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
