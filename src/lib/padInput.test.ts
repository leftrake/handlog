import { describe, expect, it } from 'vitest'
import { applyPadKey, type PadKey } from './padInput'

const typeKeys = (keys: PadKey[]) => keys.reduce(applyPadKey, '')

describe('applyPadKey', () => {
  it('builds whole and decimal amounts', () => {
    expect(typeKeys(['1', '2', '0'])).toBe('120')
    expect(typeKeys(['4', '.', '5'])).toBe('4.5')
    expect(typeKeys(['.', '5'])).toBe('0.5')
  })

  it('ignores a second decimal point and a third decimal digit', () => {
    expect(typeKeys(['1', '.', '.', '2', '5', '9'])).toBe('1.25')
  })

  it('replaces a lone leading zero', () => {
    expect(typeKeys(['0', '7'])).toBe('7')
  })

  it('caps the integer part at 7 digits', () => {
    expect(typeKeys(['9', '9', '9', '9', '9', '9', '9', '9'])).toBe('9999999')
  })

  it('backspaces', () => {
    expect(typeKeys(['1', '2', 'back'])).toBe('1')
    expect(typeKeys(['back'])).toBe('')
  })
})
