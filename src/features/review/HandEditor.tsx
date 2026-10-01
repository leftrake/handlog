import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Icon } from '../../components/icons'
import { PlayingCard } from '../../components/PlayingCard'
import { Banner, Button, ConfirmButton, EmptyState, IconButton, Page, PageHeader, Panel, Section, Segmented, Switch, TextArea } from '../../components/ui'
import { useSession, useSettings, useTags } from '../../db/hooks'
import { replayHand, setupFromHand } from '../../domain/engine'
import { formatDateTime, formatNumber, formatTime } from '../../domain/format'
import { syncPlayers } from '../../domain/hand'
import { positionLabel } from '../../domain/positions'
import { blindLevelLabel } from '../../domain/session'
import type { Action, Hand, Player, ReviewStatus } from '../../domain/types'
import { countBySeverity, validateHand } from '../../domain/validation'
import { useLocalPref } from '../../lib/hooks'
import { HoleView, ResultText } from '../hands/HandRow'
import { ActionEditor } from './ActionEditor'
import { amountUnit, type EntryUnit } from './amountUnit'
import { REVIEW_LABEL } from './labels'
import { IssueList } from './IssueList'
import { PlayersEditor } from './PlayersEditor'
import { useHandDraft } from './useHandDraft'

const WENT_LABEL = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown' } as const

function stakesText(hand: Hand): string {
  if (hand.unit === 'bb' && hand.blindLevel) return blindLevelLabel(hand.blindLevel)
  let s = `${formatNumber(hand.sb)}/${formatNumber(hand.bb)}`
  if (hand.straddle) s += `/${formatNumber(hand.straddle)}`
  return s
}

export function HandEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const tags = useTags()
  const { hand, missing, update, savedAt, discard } = useHandDraft(id)
  const session = useSession(hand?.sessionId ?? undefined)
  const [entryUnit, setEntryUnit] = useLocalPref<EntryUnit>('handlog.entryUnit', 'money')

  const replay = useMemo(() => (hand ? replayHand(setupFromHand(hand)) : null), [hand])
  const issues = useMemo(() => (hand && replay ? validateHand(hand, replay) : []), [hand, replay])

  if (missing) {
    return (
      <>
        <PageHeader title="Hand" back="/hands" />
        <EmptyState title="Hand not found">It may have been deleted.</EmptyState>
      </>
    )
  }
  if (!hand || !replay || !settings || !tags) return <PageHeader title="Hand" back />

  const unit = amountUnit(hand, entryUnit, settings.currencySymbol)
  const tagNames = hand.tagIds.map((t) => tags.find((x) => x.id === t)?.name).filter(Boolean)
  const handIssues = issues.filter((i) => !i.actionId)
  const { errors, warnings } = countBySeverity(issues)

  const setActions = (actions: Action[]) =>
    update((h) => ({ actions, players: syncPlayers({ ...h, actions }, null) }))
  const setPlayers = (players: Player[]) => update({ players })

  const title = [hand.heroPosition ? positionLabel(hand.heroPosition) : null, hand.hole?.kind === 'class' ? hand.hole.handClass : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <PageHeader
        title={title || 'Hand review'}
        subtitle={
          <>
            {formatDateTime(hand.createdAt)} · {stakesText(hand)}
            {session?.location ? ` · ${session.location}` : ''}
            {savedAt ? ` · saved ${formatTime(savedAt)}` : ''}
          </>
        }
        back
        actions={
          <>
            <IconButton icon="pencil" label="Edit quick details" onClick={() => navigate(`/capture/${hand.id}`)} />
            <IconButton icon="play" label="Replay hand" onClick={() => navigate(`/hands/${hand.id}/replay`)} />
          </>
        }
      />
      <Page className="lg:max-w-6xl">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-6">
          <div>
            <Section>
              <Panel className="space-y-3">
                <div className="flex items-center gap-3">
                  <HoleView hand={hand} size="md" />
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <PlayingCard key={i} card={hand.board[i] ?? null} size="sm" className={i === 3 || i === 4 ? 'ml-1' : ''} />
                    ))}
                  </div>
                  <div className="ml-auto text-right">
                    <ResultText hand={hand} prefs={settings} className="text-xl" />
                    <div className="text-xs text-muted">{hand.wentTo ? WENT_LABEL[hand.wentTo] : '—'}</div>
                  </div>
                </div>
                {(tagNames.length > 0 || hand.note) && (
                  <div className="text-sm">
                    {tagNames.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {tagNames.map((t) => (
                          <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {hand.note && <p className="whitespace-pre-wrap text-muted">{hand.note}</p>}
                  </div>
                )}
                <Link
                  to={`/capture/${hand.id}`}
                  className="flex items-center gap-1 text-sm font-medium text-accent"
                >
                  <Icon name="pencil" size={16} /> Edit cards, position, result, tags, note
                </Link>
              </Panel>
            </Section>

            <Section title="Review">
              <Panel className="space-y-2">
                <Segmented<ReviewStatus>
                  value={hand.reviewStatus}
                  onChange={(reviewStatus) => update({ reviewStatus })}
                  options={(['unreviewed', 'reviewed', 'needs_study'] as const).map((r) => ({ value: r, label: REVIEW_LABEL[r] }))}
                />
                <Switch
                  checked={hand.flagged}
                  onChange={(flagged) => update({ flagged })}
                  label="Flagged for review"
                  description="Flagged, unreviewed hands appear in the review queue."
                />
              </Panel>
            </Section>

            <Section
              title="Players & stacks"
              action={
                hand.unit === 'money' ? (
                  <Segmented<EntryUnit>
                    size="sm"
                    className="w-32"
                    value={entryUnit}
                    onChange={setEntryUnit}
                    options={[
                      { value: 'money', label: settings.currencySymbol },
                      { value: 'bb', label: 'BB' },
                    ]}
                  />
                ) : (
                  <span className="text-xs text-muted">Big blinds</span>
                )
              }
            >
              <PlayersEditor hand={hand} unit={unit} onChange={setPlayers} />
            </Section>
          </div>

          <div>
            <Section
              title="Action"
              action={
                (errors > 0 || warnings > 0) && (
                  <span className={`text-xs font-semibold ${errors ? 'text-loss' : 'text-warn'}`}>
                    {errors ? `${errors} problem${errors > 1 ? 's' : ''}` : `${warnings} note${warnings > 1 ? 's' : ''}`}
                  </span>
                )
              }
            >
              <Panel className="space-y-3">
                {handIssues.length > 0 && <IssueList issues={handIssues} />}
                <ActionEditor hand={hand} replay={replay} unit={unit} onActions={setActions} />
              </Panel>
            </Section>

            <Section title="Study">
              <Panel className="space-y-3">
                {hand.actions.some((a) => a.position === hand.heroPosition) && (
                  <Banner icon="note">Tap the note icon on any of your actions to record what you were thinking.</Banner>
                )}
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-muted">What I'd do differently</span>
                  <TextArea
                    value={hand.study.differently}
                    onChange={(e) => update((h) => ({ study: { ...h.study, differently: e.target.value } }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-medium text-muted">Open question</span>
                  <TextArea
                    value={hand.study.question}
                    placeholder="What do you want answered about this hand?"
                    onChange={(e) => update((h) => ({ study: { ...h.study, question: e.target.value } }))}
                  />
                </label>
              </Panel>
            </Section>

            <Section>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button block icon="play" onClick={() => navigate(`/hands/${hand.id}/replay`)}>
                  Replay hand
                </Button>
                <ConfirmButton
                  block
                  variant="ghost"
                  icon="trash"
                  className="text-loss"
                  onConfirm={async () => {
                    await discard(hand.id)
                    navigate('/hands', { replace: true })
                  }}
                >
                  Delete hand
                </ConfirmButton>
              </div>
            </Section>
          </div>
        </div>
        {hand.unit === 'bb' && <p className="mt-2 text-center text-xs text-faint">Tournament hand: amounts are in big blinds.</p>}
      </Page>
    </>
  )
}
