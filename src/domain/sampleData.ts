// Realistic sample sessions and hands for exploring the study views. Pure: the caller supplies
// ids, the clock and tag ids. Hands are written in a compact action notation and built through
// the replay engine, so results and pots always add up.
import { parseCards, parseHandClass } from './cards'
import { replayHand, skippedActions, stateForStreet, setupFromHand, amountToCall } from './engine'
import { createHand, syncPlayers, type HandContext } from './hand'
import { round2 } from './money'
import type { Action, ActionType, Hand, Player, Position, ReviewStatus, Session, Street, TableSize, WentTo } from './types'

interface SessionSpec {
  daysAgo: number
  startHour: number
  hours: number
  gameType: 'cash' | 'tournament'
  tableSize: TableSize
  location: string
  sb: number
  bb: number
  straddle?: number
  buyIn: number
  rebuys?: { afterMin: number; amount: number }[]
  cashOut: number
  notes: string
  tournament?: { name: string; startingStack: number; level: { level: number; sb: number; bb: number; ante?: number } }
}

interface VillainSpec {
  description?: string
  reads?: string
  shown?: string
}

interface HandSpec {
  session: number
  at: number
  hole: string
  pos: Position
  board?: string
  went: WentTo
  /** Explicit net result (for quick captures without action). */
  result?: number
  /** Who won the pot, when the result is derived from the action. */
  win?: 'hero' | 'villain' | 'split'
  tags?: string[]
  note?: string
  flagged?: boolean
  status?: ReviewStatus
  stacks?: Partial<Record<Position, number>>
  villains?: Partial<Record<Position, VillainSpec>>
  /** "p: CO r 12, BTN c | f: CO x, BTN b 20 | t: … | r: …"  (f fold, x check, c call, b bet, r raise, a all-in) */
  actions?: string
  /** Hero's thoughts, by the order of hero actions (0 = first hero action). */
  thoughts?: Record<number, string>
  differently?: string
  question?: string
  /** For tournament hands: blind level when the hand was played. */
  level?: { level: number; sb: number; bb: number; ante?: number }
}

const SESSIONS: SessionSpec[] = [
  {
    daysAgo: 21,
    startHour: 19,
    hours: 5.5,
    gameType: 'cash',
    tableSize: 9,
    location: 'Bellagio',
    sb: 1,
    bb: 3,
    buyIn: 300,
    rebuys: [{ afterMin: 200, amount: 300 }],
    cashOut: 1045,
    notes: 'Soft table, two very loose players in seats 2 and 7. Lost a big set-over-straight pot but ran well after.',
  },
  {
    daysAgo: 14,
    startHour: 18.5,
    hours: 4,
    gameType: 'cash',
    tableSize: 9,
    location: 'Aria',
    sb: 2,
    bb: 5,
    buyIn: 1000,
    cashOut: 640,
    notes: 'Tougher lineup than usual. Got coolered KK vs AA. Played OK otherwise; tired by the end.',
  },
  {
    daysAgo: 10,
    startHour: 11,
    hours: 7,
    gameType: 'tournament',
    tableSize: 9,
    location: 'Venetian',
    sb: 0.5,
    bb: 1,
    buyIn: 400,
    cashOut: 1290,
    notes: 'Min-cashed plus a few pay jumps. Busted 14th with ATs into 99.',
    tournament: { name: 'Venetian DeepStack $400', startingStack: 20000, level: { level: 14, sb: 1500, bb: 3000, ante: 3000 } },
  },
  {
    daysAgo: 5,
    startHour: 20,
    hours: 6,
    gameType: 'cash',
    tableSize: 9,
    location: 'Wynn',
    sb: 1,
    bb: 3,
    straddle: 6,
    buyIn: 500,
    cashOut: 1268,
    notes: 'Straddle on every orbit. Big pots, very loose. Value bet relentlessly.',
  },
  {
    daysAgo: 2,
    startHour: 19.5,
    hours: 3.5,
    gameType: 'cash',
    tableSize: 6,
    location: 'Commerce',
    sb: 1,
    bb: 2,
    buyIn: 200,
    rebuys: [{ afterMin: 60, amount: 200 }],
    cashOut: 155,
    notes: '6-max table. Aggressive regs on my left. Need to tighten up from the CO.',
  },
]

const HANDS: HandSpec[] = [
  // ── Bellagio 1/3 ──
  {
    session: 0,
    at: 35,
    hole: 'AsKs',
    pos: 'BTN',
    board: 'Kd7c2h9s',
    went: 'turn',
    win: 'hero',
    tags: ['3bet pot'],
    note: '3bet AKs vs CO opener, two streets of value',
    status: 'reviewed',
    stacks: { BTN: 300, CO: 420 },
    villains: { CO: { description: 'Young reg, opens wide from CO' } },
    actions: 'p: CO r 12, BTN r 36, CO c | f: CO x, BTN b 30, CO c | t: CO x, BTN b 75, CO f',
  },
  {
    session: 0,
    at: 80,
    hole: 'QhQd',
    pos: 'UTG1',
    board: 'Ac8d4s2cKs',
    went: 'showdown',
    win: 'villain',
    tags: ['Tough spot', 'Villain read'],
    note: 'BB squeezed, I flatted QQ, called down on an ace-high board',
    status: 'needs_study',
    stacks: { UTG1: 290, BB: 350, BTN: 300 },
    villains: { BB: { description: 'Older reg, tight', reads: 'Rarely squeezes light. Bets big for value.', shown: 'AhKh' } },
    actions: 'p: UTG1 r 15, BTN c, BB r 60, UTG1 c, BTN f | f: BB b 70, UTG1 c | t: BB b 160, UTG1 c',
    thoughts: { 1: 'Calling keeps his bluffs in. 4betting folds out everything I beat.', 2: 'Ace flop is bad for me but he c-bets any two after a squeeze.' },
    differently: 'Fold the turn. A tight player double-barrelling an ace-high board almost never has a worse hand.',
    question: 'Versus a tight squeezer, is flatting QQ in position better than 4betting?',
  },
  { session: 0, at: 150, hole: '7c6c', pos: 'CO', went: 'flop', result: -15, note: 'Missed flop, gave up', flagged: false },
  {
    session: 0,
    at: 215,
    hole: 'JdJs',
    pos: 'BB',
    board: 'Jc9h5d3sQd',
    went: 'showdown',
    win: 'villain',
    tags: ['Bad beat'],
    note: 'Set over a flopped open-ender, villain rivered the straight. Got it in good.',
    status: 'reviewed',
    stacks: { BB: 600, BTN: 450 },
    villains: { BTN: { description: 'Loose-aggressive, seat 7', shown: 'Th8h' } },
    actions: 'p: BTN r 10, BB r 38, BTN c | f: BB b 45, BTN r 120, BB r 300, BTN a, BB c',
  },

  // ── Aria 2/5 ──
  {
    session: 1,
    at: 20,
    hole: 'AhQh',
    pos: 'MP',
    board: 'Qs8h3hKc2h',
    went: 'showdown',
    win: 'hero',
    note: 'Top pair top kicker, rivered the flush. Three streets.',
    status: 'reviewed',
    flagged: false,
    stacks: { MP: 1000, BTN: 800, BB: 1200 },
    villains: { BTN: { shown: 'QdJd' } },
    actions: 'p: MP r 20, BTN c, BB c | f: BB x, MP b 45, BTN c, BB f | t: MP b 110, BTN c | r: MP b 260, BTN c',
  },
  {
    session: 1,
    at: 70,
    hole: 'KcKd',
    pos: 'HJ',
    board: 'AsTd4c7h2s',
    went: 'showdown',
    win: 'villain',
    tags: ['Cooler', '4bet pot'],
    note: 'KK vs AA, standard',
    status: 'reviewed',
    stacks: { HJ: 1000, CO: 1500 },
    villains: { CO: { description: 'Solid reg', shown: 'AhAd' } },
    actions: 'p: HJ r 20, CO r 65, HJ r 170, CO a, HJ c',
  },
  {
    session: 1,
    at: 130,
    hole: '9s8s',
    pos: 'BTN',
    board: 'Kh7d2c4sAd',
    went: 'river',
    win: 'hero',
    tags: ['Bluff'],
    note: 'Triple barrel with 9-high. Ace river is a great card for my range.',
    stacks: { BTN: 640, BB: 900 },
    villains: { BB: { description: 'Calling station', reads: 'Check-calls light, folds rivers when scared' } },
    actions: 'p: BTN r 15, BB c | f: BB x, BTN b 10, BB c | t: BB x, BTN b 35, BB c | r: BB x, BTN b 90, BB f',
    thoughts: { 3: 'He has a lot of Kx that hates the ace. My range has all the AK/AQ.' },
    question: 'Is the ace a good barrel card when villain check-calls twice on K-high?',
  },
  { session: 1, at: 190, hole: 'AcJd', pos: 'SB', went: 'preflop', result: -20, note: 'Folded to a 3bet', flagged: false },
  {
    session: 1,
    at: 222,
    hole: 'ThTc',
    pos: 'CO',
    board: '9c8c7dKh2d',
    went: 'river',
    win: 'villain',
    tags: ['Misplayed'],
    note: 'Called two streets on a wet board, then folded the river.',
    stacks: { CO: 700, UTG1: 900 },
    villains: { UTG1: { description: 'Nit' } },
    actions: 'p: UTG1 r 20, CO c, BTN c, BB c | f: BB x, UTG1 b 60, CO c, BTN f, BB f | t: UTG1 b 150, CO c | r: UTG1 b 300, CO f',
    thoughts: { 1: 'Overpair plus a gutter. Calling to see the turn.', 2: 'King is a blank-ish card. He could have AA/KK or a set.', 3: 'A nit triple-barrelling this board has it.' },
    differently: 'Raise the flop or fold the turn. Calling two streets then folding is the worst line versus a nit.',
  },

  // ── Venetian DeepStack (big blinds) ──
  {
    session: 2,
    at: 60,
    hole: 'AKo',
    pos: 'UTG',
    board: 'Ks7c2d4h9s',
    went: 'showdown',
    win: 'hero',
    note: 'Opened AK, BTN shoved 45bb, called. Held.',
    status: 'reviewed',
    flagged: false,
    level: { level: 5, sb: 200, bb: 400, ante: 400 },
    stacks: { UTG: 62, BTN: 45 },
    villains: { BTN: { shown: 'JhTh' } },
    actions: 'p: UTG r 2.2, BTN a, UTG c',
  },
  {
    session: 2,
    at: 190,
    hole: '7s7h',
    pos: 'BB',
    went: 'preflop',
    win: 'hero',
    tags: ['Villain read'],
    note: 'CO opening every orbit; reshoved 18bb from the BB.',
    status: 'reviewed',
    level: { level: 9, sb: 600, bb: 1200, ante: 1200 },
    stacks: { BB: 18, CO: 40 },
    villains: { CO: { description: 'Steals relentlessly', reads: 'Opened 7 of the last 9 orbits from CO/BTN' } },
    actions: 'p: CO r 2.1, BB a, CO f',
  },
  {
    session: 2,
    at: 400,
    hole: 'ATs',
    pos: 'BTN',
    board: '8s6c2dKh4s',
    went: 'showdown',
    win: 'villain',
    tags: ['Tough spot'],
    note: 'Busted 14th. ATs shove for 14bb into 99.',
    level: { level: 14, sb: 1500, bb: 3000, ante: 3000 },
    stacks: { BTN: 14, BB: 30 },
    villains: { BB: { shown: '9d9c' } },
    actions: 'p: BTN a, BB c',
    question: 'With pay jumps close, is ATs a profitable 14bb shove from the BTN?',
  },

  // ── Wynn 1/3 with $6 straddle ──
  {
    session: 3,
    at: 40,
    hole: 'A5s',
    pos: 'LJ',
    board: 'Kc9c4dTd2c',
    went: 'showdown',
    win: 'hero',
    note: 'Nut flush draw, checked back turn, rivered it and raised.',
    status: 'reviewed',
    stacks: { LJ: 500, BB: 380 },
    villains: { BB: { shown: 'KsKh', description: 'Slowplays big hands' } },
    actions: 'p: UTG1 c, LJ r 30, BB c, UTG f, UTG1 f | f: BB x, LJ b 35, BB c | t: BB x, LJ x | r: BB b 60, LJ r 190, BB c',
  },
  {
    session: 3,
    at: 120,
    hole: 'KdQd',
    pos: 'HJ',
    board: 'Qh7s3c5d8h',
    went: 'showdown',
    win: 'hero',
    tags: ['Hero call'],
    note: 'Villain bluffs rivers a lot. Called with top pair.',
    stacks: { HJ: 520, BTN: 600 },
    villains: { BTN: { reads: 'Over-bluffs rivers when checked to', shown: 'Th9h' } },
    actions: 'p: HJ r 25, BTN c | f: HJ b 30, BTN c | t: HJ x, BTN x | r: HJ x, BTN b 150, HJ c',
    thoughts: { 3: 'He checked back the turn; his value range would bet. This looks like a missed draw.' },
  },
  { session: 3, at: 200, hole: '4d4s', pos: 'UTG1', went: 'flop', result: -18, note: 'Missed set, folded to the c-bet', flagged: false },
  {
    session: 3,
    at: 260,
    hole: 'AsAh',
    pos: 'BTN',
    board: 'Jd8d4c2s6h',
    went: 'showdown',
    win: 'hero',
    note: 'Isolated a limper, got three streets from top pair.',
    status: 'reviewed',
    flagged: false,
    stacks: { BTN: 700, UTG1: 400, BB: 650 },
    villains: { UTG1: { description: 'Limp-caller', shown: 'JcTc' } },
    actions: 'p: UTG1 c, BTN r 35, BB c, UTG f, UTG1 c | f: BB x, UTG1 x, BTN b 60, BB f, UTG1 c | t: UTG1 x, BTN b 140, UTG1 c | r: UTG1 x, BTN b 165, UTG1 c',
  },
  { session: 3, at: 330, hole: 'T9s', pos: 'SB', went: 'river', result: 210, tags: ['Bluff'], note: 'Check-raised the turn as a bluff; villain folded the river.' },

  // ── Commerce 1/2 6-max ──
  {
    session: 4,
    at: 25,
    hole: 'AhKd',
    pos: 'CO',
    board: 'QsJh3d9c5s',
    went: 'showdown',
    win: 'villain',
    tags: ['4bet pot', 'Tough spot'],
    note: 'Jammed AK 100bb versus a 3bet, ran into QQ.',
    status: 'needs_study',
    stacks: { CO: 200, BTN: 260 },
    villains: { BTN: { description: 'Aggressive reg on my left', shown: 'QcQd' } },
    actions: 'p: CO r 6, BTN r 20, CO a, BTN c',
    question: 'Is jamming 100bb AKo versus a reg 3bet too loose at 1/2?',
  },
  {
    session: 4,
    at: 80,
    hole: '6h6d',
    pos: 'BB',
    board: '6cKh2h9s3c',
    went: 'river',
    win: 'hero',
    note: 'Set in a limped pot; villain folded the river.',
    status: 'reviewed',
    flagged: false,
    stacks: { BB: 200, SB: 180 },
    actions: 'p: SB c, BB x | f: SB b 4, BB r 14, SB c | t: SB x, BB b 30, SB c | r: SB x, BB b 70, SB f',
  },
  { session: 4, at: 150, hole: 'KcJc', pos: 'BTN', went: 'turn', result: -46, tags: ['Misplayed'], note: 'Floated the flop with nothing, called a turn raise. Spew.' },
  {
    session: 4,
    at: 190,
    hole: 'QcQs',
    pos: 'UTG',
    went: 'preflop',
    win: 'hero',
    tags: ['4bet pot'],
    note: '4bet QQ, HJ folded.',
    stacks: { UTG: 210, HJ: 190 },
    actions: 'p: UTG r 6, HJ r 18, UTG r 50, HJ f',
  },
]

const STREET_CODE: Record<string, Street> = { p: 'preflop', f: 'flop', t: 'turn', r: 'river' }
const TYPE_CODE: Record<string, ActionType> = { f: 'fold', x: 'check', c: 'call', b: 'bet', r: 'raise', a: 'allin' }

/** Parse the action notation, filling in skipped folds/checks the same way the editor does. */
function buildActions(base: Hand, notation: string, newId: () => string): Action[] {
  const actions: Action[] = []
  const replayNow = () => replayHand(setupFromHand({ ...base, actions }))
  for (const part of notation.split('|')) {
    const [code, body] = part.split(':').map((x) => x.trim())
    const street = STREET_CODE[code]
    if (!street) throw new Error(`Bad street code "${code}"`)
    for (const token of body.split(',').map((x) => x.trim()).filter(Boolean)) {
      const [pos, t, amt] = token.split(/\s+/)
      const type = TYPE_CODE[t]
      if (!type) throw new Error(`Bad action "${token}"`)
      // Close out the previous street: anyone still to act folds (facing a bet) or checks.
      let r = replayNow()
      while (r.final.toAct && r.final.street !== street) {
        const p = r.final.toAct
        actions.push({ id: newId(), street: r.final.street, position: p, type: amountToCall(r.final, p) > 0 ? 'fold' : 'check' })
        r = replayNow()
      }
      const state = stateForStreet(r, base, street)
      for (const s of skippedActions(state, base, pos as Position)) {
        actions.push({ id: newId(), street, position: s.position, type: s.type })
      }
      actions.push({ id: newId(), street, position: pos as Position, type, amount: amt ? Number(amt) : undefined })
    }
  }
  return actions
}

function heroResult(hand: Hand, win: 'hero' | 'villain' | 'split'): number {
  const r = replayHand(setupFromHand(hand))
  const hero = r.final.seats.find((s) => s.position === hand.heroPosition)
  if (!hero) return 0
  const returned = r.uncalled?.position === hand.heroPosition ? r.uncalled.amount : 0
  const invested = hero.invested - returned
  const share = win === 'hero' ? r.finalPot : win === 'split' ? r.finalPot / 2 : 0
  return round2(share - invested)
}

export interface SampleData {
  sessions: Session[]
  hands: Hand[]
  /** Tag names the hands use, so the caller can create any that are missing. */
  tagNames: string[]
}

/**
 * Build the sample sessions and hands.
 * `tagId(name)` must return the id of a tag with that name (creating it if needed).
 */
export function buildSampleData(now: number, newId: () => string, tagId: (name: string) => string): SampleData {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)

  const sessions: Session[] = SESSIONS.map((spec) => {
    const startedAt = day.getTime() - spec.daysAgo * 86_400_000 + spec.startHour * 3_600_000
    const endedAt = startedAt + spec.hours * 3_600_000
    return {
      id: newId(),
      gameType: spec.gameType,
      tableSize: spec.tableSize,
      location: spec.location,
      stakes: { sb: spec.sb, bb: spec.bb, straddle: spec.straddle },
      tournament: spec.tournament,
      buyIn: spec.buyIn,
      rebuys: (spec.rebuys ?? []).map((r) => ({ at: startedAt + r.afterMin * 60_000, amount: r.amount })),
      cashOut: spec.cashOut,
      startedAt,
      endedAt,
      notes: spec.notes,
      sample: true,
      createdAt: startedAt,
      updatedAt: endedAt,
    }
  })

  const hands: Hand[] = HANDS.map((spec) => {
    const session = sessions[spec.session]
    const sSpec = SESSIONS[spec.session]
    const createdAt = session.startedAt + spec.at * 60_000
    const isTourney = sSpec.gameType === 'tournament'
    const level = spec.level ?? sSpec.tournament?.level
    const ctx: HandContext = isTourney && level
      ? {
          sessionId: session.id,
          gameType: 'tournament',
          tableSize: sSpec.tableSize,
          unit: 'bb',
          sb: round2(level.sb / level.bb),
          bb: 1,
          ante: level.ante ? round2(level.ante / level.bb) : undefined,
          blindLevel: { ...level },
        }
      : {
          sessionId: session.id,
          gameType: 'cash',
          tableSize: sSpec.tableSize,
          unit: 'money',
          sb: sSpec.sb,
          bb: sSpec.bb,
          straddle: sSpec.straddle,
        }

    const hand = createHand(ctx, newId(), createdAt)
    const exact = parseCards(spec.hole)
    hand.hole =
      exact && exact.length === 2
        ? { kind: 'exact', cards: [exact[0], exact[1]] }
        : { kind: 'class', handClass: parseHandClass(spec.hole) ?? spec.hole }
    hand.heroPosition = spec.pos
    hand.board = spec.board ? (parseCards(spec.board) ?? []) : []
    hand.wentTo = spec.went
    hand.tagIds = (spec.tags ?? []).map(tagId)
    hand.note = spec.note ?? ''
    hand.flagged = spec.flagged ?? true
    hand.reviewStatus = spec.status ?? 'unreviewed'
    hand.sample = true
    hand.updatedAt = createdAt

    const players: Player[] = Object.entries(spec.stacks ?? {}).map(([pos, stack]) => {
      const v = spec.villains?.[pos as Position]
      const shown = v?.shown ? parseCards(v.shown) : null
      return {
        position: pos as Position,
        isHero: pos === spec.pos,
        stack: stack ?? null,
        description: v?.description,
        reads: v?.reads,
        shown: shown && shown.length === 2 ? [shown[0], shown[1]] : undefined,
      }
    })
    hand.players = players

    if (spec.actions) {
      hand.actions = buildActions(hand, spec.actions, newId)
      hand.players = syncPlayers(hand, null)
      let heroIndex = 0
      for (const a of hand.actions) {
        if (a.position !== spec.pos) continue
        const thought = spec.thoughts?.[heroIndex++]
        if (thought) a.thought = thought
      }
    }
    hand.result = spec.result ?? (spec.win ? heroResult(hand, spec.win) : null)
    hand.study = { differently: spec.differently ?? '', question: spec.question ?? '' }
    return hand
  })

  const tagNames = [...new Set(HANDS.flatMap((h) => h.tags ?? []))]
  return { sessions, hands, tagNames }
}
