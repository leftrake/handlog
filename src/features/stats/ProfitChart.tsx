import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate, formatMoney } from '../../domain/format'
import { niceTicks, type TimelinePoint } from '../../domain/stats'
import type { Session } from '../../domain/types'
import { useThemeVars } from '../../lib/useThemeVars'

const VARS = ['viz-1', 'viz-grid', 'viz-axis', 'muted', 'surface', 'fg', 'line', 'surface-2'] as const

function compactMoney(n: number, currency: string): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1000) return `${sign}${currency}${Number((abs / 1000).toFixed(2))}k`
  return `${sign}${currency}${Math.round(abs)}`
}

interface Point extends TimelinePoint {
  i: number
}

/** Cumulative session profit: one series, so no legend; the section title names it. */
export function ProfitChart({
  points,
  sessions,
  currency,
}: {
  points: readonly TimelinePoint[]
  sessions: ReadonlyMap<string, Session>
  currency: string
}) {
  const c = useThemeVars(VARS)
  const data: Point[] = points.map((p, i) => ({ ...p, i: i + 1 }))
  const last = data.at(-1)
  if (!last) return null
  const ticks = niceTicks(data.map((d) => d.cumulative))

  return (
    <div className="h-56 w-full sm:h-64" role="img" aria-label={`Cumulative profit over ${data.length} sessions, ending at ${formatMoney(last.cumulative, currency, { signed: true })}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 22, right: 18, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={c['viz-grid']} strokeWidth={1} />
          <XAxis
            dataKey="i"
            type="number"
            domain={[1, Math.max(2, data.length)]}
            allowDecimals={false}
            tickLine={false}
            axisLine={{ stroke: c['viz-axis'] }}
            tick={{ fill: c.muted, fontSize: 11 }}
            tickFormatter={(i: number) => {
              const p = data[i - 1]
              return p ? new Date(p.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
            }}
            minTickGap={28}
          />
          <YAxis
            width={52}
            ticks={ticks}
            domain={[ticks[0], ticks.at(-1)!]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: c.muted, fontSize: 11 }}
            tickFormatter={(v: number) => compactMoney(v, currency)}
          />
          <ReferenceLine y={0} stroke={c['viz-axis']} strokeWidth={1} />
          <Tooltip
            cursor={{ stroke: c.muted, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as Point | undefined) : undefined
              if (!p) return null
              const s = sessions.get(p.sessionId)
              return (
                <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                  <div className="num text-base font-bold text-fg">{formatMoney(p.cumulative, currency, { signed: true })}</div>
                  <div className="text-muted">running total</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-3 rounded" style={{ background: c['viz-1'] }} />
                    <span className="num font-semibold text-fg">{formatMoney(p.result, currency, { signed: true })}</span>
                    <span className="text-muted">
                      {formatDate(p.at)}
                      {s?.location ? ` · ${s.location}` : ''}
                    </span>
                  </div>
                </div>
              )
            }}
          />
          <Area
            type="linear"
            dataKey="cumulative"
            stroke={c['viz-1']}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={c['viz-1']}
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 5, fill: c['viz-1'], stroke: c.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={last.i}
            y={last.cumulative}
            r={4}
            fill={c['viz-1']}
            stroke={c.surface}
            strokeWidth={2}
            label={{ value: compactMoney(last.cumulative, currency), position: 'top', fill: c.fg, fontSize: 12, fontWeight: 600 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
