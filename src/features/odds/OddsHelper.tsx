import { useState } from 'react'
import { Icon } from '../../components/icons'
import { Field, NumberInput, Page, PageHeader, Panel, Section, Segmented } from '../../components/ui'
import { formatNumber, formatPercent } from '../../domain/format'
import { bluffBreakEven, outsEquity, potOddsFacingBet, type DrawStreet } from '../../domain/odds'
import { useLocalPref } from '../../lib/hooks'
import { cx } from '../../lib/cx'

const COMMON_OUTS: { label: string; outs: number }[] = [
  { label: 'Gutshot', outs: 4 },
  { label: 'Two overcards', outs: 6 },
  { label: 'Open-ender', outs: 8 },
  { label: 'Flush draw', outs: 9 },
  { label: 'Flush + gutshot', outs: 12 },
  { label: 'Flush + open-ender', outs: 15 },
]

function Result({ label, value, formula, highlight }: { label: string; value: string; formula?: string; highlight?: boolean }) {
  return (
    <div className={cx('rounded-xl px-3 py-2', highlight ? 'bg-accent-soft' : 'bg-surface-2')}>
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-xl font-bold">{value}</div>
      {formula && <div className="num mt-0.5 break-words text-[11px] text-muted">{formula}</div>}
    </div>
  )
}

export function OddsHelper() {
  const [pot, setPot] = useLocalPref<number | null>('handlog.odds.pot', 100)
  const [bet, setBet] = useLocalPref<number | null>('handlog.odds.bet', 50)
  const [invested, setInvested] = useState<number | null>(null)
  const [outs, setOuts] = useLocalPref('handlog.odds.outs', 9)
  const [street, setStreet] = useLocalPref<DrawStreet>('handlog.odds.street', 'flop')

  const odds = pot !== null && bet !== null ? potOddsFacingBet(pot, bet, invested ?? 0) : null
  const estimates = outsEquity(outs, street)
  // The next card is what matters for a call now; compare against the one-card exact figure.
  const nextCard = estimates[0]
  const bluff = pot !== null && bet !== null ? bluffBreakEven(pot, bet) : null

  return (
    <>
      <PageHeader title="Odds helper" back="/more" />
      <Page>
        <Section title="Pot odds">
          <Panel className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Pot before the bet">
                <NumberInput value={pot} onChange={setPot} />
              </Field>
              <Field label="Bet you face">
                <NumberInput value={bet} onChange={setBet} />
              </Field>
            </div>
            <Field label="Already in on this street (optional)" hint="Your own bet if you're facing a raise">
              <NumberInput value={invested} onChange={setInvested} placeholder="0" />
            </Field>
            {odds ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Result label="To call" value={formatNumber(odds.toCall)} formula={invested ? `${formatNumber(bet ?? 0)} − ${formatNumber(invested)}` : 'the bet'} />
                <Result
                  label="Pot after call"
                  value={formatNumber(odds.potAfterCall)}
                  formula={`${formatNumber(pot ?? 0)} + ${formatNumber(bet ?? 0)}${invested ? ` + ${formatNumber(invested)}` : ''} + ${formatNumber(odds.toCall)}`}
                />
                <Result
                  label="Equity needed"
                  value={formatPercent(odds.requiredEquity)}
                  formula={`${formatNumber(odds.toCall)} ÷ ${formatNumber(odds.potAfterCall)}`}
                  highlight
                />
                <Result label="Pot odds" value={`${odds.ratio.toFixed(1)} : 1`} formula={`${formatNumber(odds.potBefore)} ÷ ${formatNumber(odds.toCall)}`} />
              </div>
            ) : (
              <p className="text-sm text-muted">Enter the pot and a bet to see the odds.</p>
            )}
            {bluff !== null && (
              <p className="num text-xs text-muted">
                Their bet needs to work {formatPercent(bluff)} of the time as a bluff ({formatNumber(bet ?? 0)} ÷ (
                {formatNumber(pot ?? 0)} + {formatNumber(bet ?? 0)})).
              </p>
            )}
          </Panel>
        </Section>

        <Section title="Outs to equity">
          <Panel className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-xl bg-surface-2">
                <button type="button" aria-label="Fewer outs" className="flex h-12 w-12 items-center justify-center text-2xl" onClick={() => setOuts(Math.max(0, outs - 1))}>
                  −
                </button>
                <div className="num w-14 text-center">
                  <div className="text-2xl font-bold leading-none">{outs}</div>
                  <div className="text-[10px] text-muted">outs</div>
                </div>
                <button type="button" aria-label="More outs" className="flex h-12 w-12 items-center justify-center text-2xl" onClick={() => setOuts(Math.min(20, outs + 1))}>
                  +
                </button>
              </div>
              <Segmented<DrawStreet>
                className="flex-1"
                value={street}
                onChange={setStreet}
                options={[
                  { value: 'flop', label: 'Flop' },
                  { value: 'turn', label: 'Turn' },
                ]}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_OUTS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setOuts(c.outs)}
                  className={cx(
                    'h-9 rounded-full border px-3 text-xs font-medium',
                    outs === c.outs ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2 text-muted',
                  )}
                >
                  {c.label} · {c.outs}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {estimates.map((e) => (
                <div key={e.label} className="rounded-xl border border-line p-3">
                  <div className="mb-2 text-sm font-semibold">{e.label}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Result label={e.ruleName} value={`${e.rule.toFixed(0)}%`} formula={e.ruleFormula} />
                    <Result label="Exact" value={`${e.exact.toFixed(1)}%`} formula={e.exactFormula} highlight />
                  </div>
                </div>
              ))}
            </div>
            {odds && (
              <div
                className={cx(
                  'flex items-start gap-2 rounded-xl px-3 py-2 text-sm',
                  nextCard.exact / 100 >= odds.requiredEquity ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss',
                )}
              >
                <Icon name={nextCard.exact / 100 >= odds.requiredEquity ? 'check' : 'alert'} size={18} className="mt-0.5 shrink-0" />
                <span>
                  {nextCard.exact.toFixed(1)}% to hit on the next card vs {formatPercent(odds.requiredEquity)} needed:{' '}
                  {nextCard.exact / 100 >= odds.requiredEquity
                    ? 'a direct call is profitable.'
                    : 'you need implied odds (or fold equity) to continue.'}
                </span>
              </div>
            )}
            <p className="text-xs text-faint">
              Exact figures assume every out is live and count only your hole cards and the board as known (47 unseen on the flop, 46 on the turn).
            </p>
          </Panel>
        </Section>
      </Page>
    </>
  )
}
