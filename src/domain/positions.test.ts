import { describe, expect, it } from 'vitest'
import {
  clockwiseFromButton,
  isTableSize,
  parsePosition,
  positionLabel,
  positionsFor,
  postflopOrder,
  preflopOrder,
  smallBlindPosition,
  straddlePosition,
  tableSizeLabel,
  toTableSize,
} from './positions'

describe('positions', () => {
  it('lists seats for each table size', () => {
    expect(positionsFor(9)).toEqual(['UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'])
    expect(positionsFor(6)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'])
  })

  it('orders preflop action, moving a UTG straddler to last', () => {
    expect(preflopOrder(6)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'])
    expect(preflopOrder(6, true)).toEqual(['HJ', 'CO', 'BTN', 'SB', 'BB', 'UTG'])
  })

  it('orders postflop action from the small blind', () => {
    expect(postflopOrder(6)).toEqual(['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'])
    expect(postflopOrder(9)[0]).toBe('SB')
    expect(postflopOrder(9).at(-1)).toBe('BTN')
  })

  it('goes clockwise from the button', () => {
    expect(clockwiseFromButton(6)).toEqual(['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'])
  })

  it('labels and parses', () => {
    expect(positionLabel('UTG1')).toBe('UTG+1')
    expect(parsePosition('utg+1')).toBe('UTG1')
    expect(parsePosition('btn')).toBe('BTN')
    expect(parsePosition('dealer')).toBeNull()
  })
})

describe('every table size', () => {
  const sizes = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const

  it('has one unique seat per player, ending with the button and blinds', () => {
    for (const n of sizes) {
      const seats = positionsFor(n)
      expect(seats).toHaveLength(n)
      expect(new Set(seats).size).toBe(n)
      expect(seats.at(-1)).toBe('BB')
      expect(seats).toContain('BTN')
    }
  })

  it('names short-handed and full-ring seats', () => {
    expect(positionsFor(2)).toEqual(['BTN', 'BB'])
    expect(positionsFor(3)).toEqual(['BTN', 'SB', 'BB'])
    expect(positionsFor(4)).toEqual(['UTG', 'BTN', 'SB', 'BB'])
    expect(positionsFor(5)).toEqual(['UTG', 'CO', 'BTN', 'SB', 'BB'])
    expect(positionsFor(7)).toEqual(['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'])
    expect(positionsFor(8)).toEqual(['UTG', 'UTG1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'])
    expect(positionsFor(10)).toEqual(['UTG', 'UTG1', 'UTG2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'])
  })

  it('orders action for every size, with the button last postflop', () => {
    for (const n of sizes) {
      expect([...preflopOrder(n)].sort()).toEqual([...positionsFor(n)].sort())
      expect([...postflopOrder(n)].sort()).toEqual([...positionsFor(n)].sort())
      expect(postflopOrder(n).at(-1)).toBe('BTN')
    }
  })

  it('handles heads-up: button posts the small blind, acts first preflop and last postflop', () => {
    expect(smallBlindPosition(2)).toBe('BTN')
    expect(preflopOrder(2)).toEqual(['BTN', 'BB'])
    expect(postflopOrder(2)).toEqual(['BB', 'BTN'])
    expect(straddlePosition(2)).toBeNull()
    expect(positionLabel('BTN', 2)).toBe('BTN/SB')
    expect(positionLabel('BTN', 6)).toBe('BTN')
  })

  it('straddles from the first seat to act, who then acts last', () => {
    expect(straddlePosition(3)).toBe('BTN')
    expect(preflopOrder(3, true)).toEqual(['SB', 'BB', 'BTN'])
    expect(straddlePosition(10)).toBe('UTG')
    expect(preflopOrder(10, true)[0]).toBe('UTG1')
  })

  it('labels and clamps table sizes', () => {
    expect(tableSizeLabel(2)).toBe('Heads-up')
    expect(tableSizeLabel(8)).toBe('8-handed')
    expect(toTableSize(1)).toBe(2)
    expect(toTableSize(12)).toBe(10)
    expect(isTableSize(7)).toBe(true)
    expect(isTableSize(11)).toBe(false)
    expect(parsePosition('utg+2')).toBe('UTG2')
  })
})
