// Keypad editing for amounts typed on the in-app number pad.

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back'

/** Apply a pad key to an amount string, keeping at most two decimals and 7 integer digits. */
export function applyPadKey(text: string, k: PadKey): string {
  if (k === 'back') return text.slice(0, -1)
  if (k === '.') return text.includes('.') ? text : (text === '' ? '0' : text) + '.'
  const [int, dec] = text.split('.')
  if (dec !== undefined) return dec.length >= 2 ? text : text + k
  if (int === '0') return k
  return int.length >= 7 ? text : text + k
}
