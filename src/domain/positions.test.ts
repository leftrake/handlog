import { describe, expect, it } from 'vitest'
import { clockwiseFromButton, parsePosition, positionLabel, positionsFor, postflopOrder, preflopOrder } from './positions'

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
