import { describe, expect, it } from 'vitest'
import {
  allHandClasses,
  comboCount,
  findDuplicates,
  formatCard,
  fullDeck,
  gridHandClass,
  gridPosition,
  handClassMatches,
  handClassOf,
  holeHandClass,
  makeHandClass,
  parseCard,
  parseCards,
  parseHandClass,
  unavailableCards,
} from './cards'

describe('parseCard', () => {
  it('parses standard notation in any case', () => {
    expect(parseCard('As')).toBe('As')
    expect(parseCard('as')).toBe('As')
    expect(parseCard('AS')).toBe('As')
    expect(parseCard('td')).toBe('Td')
    expect(parseCard(' 9c ')).toBe('9c')
  })

  it('accepts 10 for ten and suit symbols', () => {
    expect(parseCard('10h')).toBe('Th')
    expect(parseCard('A♠')).toBe('As')
    expect(parseCard('K♥')).toBe('Kh')
    expect(parseCard('Q♦')).toBe('Qd')
    expect(parseCard('J♣')).toBe('Jc')
  })

  it('rejects invalid cards', () => {
    for (const bad of ['', 'A', 'Ax', '1s', '11h', 'Zs', 'AsK', 'AKs']) {
      expect(parseCard(bad)).toBeNull()
    }
  })
})

describe('parseCards', () => {
  it('parses runs with or without separators', () => {
    expect(parseCards('AsKd')).toEqual(['As', 'Kd'])
    expect(parseCards('As Kd 7c')).toEqual(['As', 'Kd', '7c'])
    expect(parseCards('10h9h')).toEqual(['Th', '9h'])
    expect(parseCards('A♠,K♦')).toEqual(['As', 'Kd'])
    expect(parseCards('')).toEqual([])
  })

  it('returns null when any part is invalid', () => {
    expect(parseCards('AsKx')).toBeNull()
    expect(parseCards('As K')).toBeNull()
  })
})

describe('deck and duplicates', () => {
  it('builds a 52-card deck of unique cards', () => {
    const deck = fullDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck).size).toBe(52)
  })

  it('finds cards used more than once', () => {
    expect(findDuplicates(['As', 'Kd', 'As', '7c', 'Kd', 'As'])).toEqual(['As', 'Kd'])
    expect(findDuplicates(['As', 'Kd', null, undefined])).toEqual([])
  })

  it('marks used cards unavailable except the one being edited', () => {
    const used = ['As', 'Kd', '7c', null] as const
    const blocked = unavailableCards(used, 'Kd')
    expect(blocked.has('As')).toBe(true)
    expect(blocked.has('7c')).toBe(true)
    expect(blocked.has('Kd')).toBe(false)
    expect(unavailableCards(used).has('Kd')).toBe(true)
  })
})

describe('hand classes', () => {
  it('classifies two cards', () => {
    expect(handClassOf('As', 'Ks')).toBe('AKs')
    expect(handClassOf('Kd', 'Ac')).toBe('AKo')
    expect(handClassOf('7h', '7c')).toBe('77')
    expect(handClassOf('2c', 'Td')).toBe('T2o')
  })

  it('builds from ranks', () => {
    expect(makeHandClass('K', 'A', true)).toBe('AKs')
    expect(makeHandClass('9', 'T', false)).toBe('T9o')
    expect(makeHandClass('Q', 'Q', true)).toBe('QQ')
  })

  it('parses shorthand strings', () => {
    expect(parseHandClass('aks')).toBe('AKs')
    expect(parseHandClass('KA o')).toBe('AKo')
    expect(parseHandClass('qq')).toBe('QQ')
    expect(parseHandClass('109s')).toBe('T9s')
    expect(parseHandClass('AK')).toBeNull()
    expect(parseHandClass('QQs')).toBeNull()
    expect(parseHandClass('AKx')).toBeNull()
  })

  it('reads hole cards entered either way', () => {
    expect(holeHandClass({ kind: 'exact', cards: ['Jh', 'Th'] })).toBe('JTs')
    expect(holeHandClass({ kind: 'class', handClass: 'A5s' })).toBe('A5s')
    expect(holeHandClass(null)).toBeNull()
  })

  it('counts combos', () => {
    expect(comboCount('AA')).toBe(6)
    expect(comboCount('AKs')).toBe(4)
    expect(comboCount('AKo')).toBe(12)
    const total = allHandClasses().reduce((n, hc) => n + comboCount(hc), 0)
    expect(total).toBe(1326)
  })

  it('maps the 13x13 grid both ways', () => {
    expect(allHandClasses()).toHaveLength(169)
    expect(new Set(allHandClasses()).size).toBe(169)
    expect(gridHandClass(0, 0)).toBe('AA')
    expect(gridHandClass(0, 1)).toBe('AKs')
    expect(gridHandClass(1, 0)).toBe('AKo')
    expect(gridHandClass(12, 12)).toBe('22')
    for (const hc of allHandClasses()) {
      const { row, col } = gridPosition(hc)
      expect(gridHandClass(row, col)).toBe(hc)
    }
  })

  it('matches loose search queries', () => {
    expect(handClassMatches('AKs', 'AK')).toBe(true)
    expect(handClassMatches('AKo', 'ka')).toBe(true)
    expect(handClassMatches('AKo', 'AKs')).toBe(false)
    expect(handClassMatches('QQ', 'qq')).toBe(true)
    expect(handClassMatches('KQs', 'A')).toBe(false)
    expect(handClassMatches('A5s', 'a')).toBe(true)
    expect(handClassMatches('77', 'pairs')).toBe(true)
    expect(handClassMatches('76s', 'suited')).toBe(true)
    expect(handClassMatches('76o', 'suited')).toBe(false)
    expect(handClassMatches('T9s', '109')).toBe(true)
    expect(handClassMatches('T9s', 'xyz')).toBe(false)
  })
})

describe('formatCard', () => {
  it('uses suit symbols', () => {
    expect(formatCard('As')).toBe('A♠')
    expect(formatCard('Th')).toBe('T♥')
  })
})
