/** Round to cents (or hundredths of a big blind) to keep float noise out of pots and stats. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function sum(values: readonly number[]): number {
  return round2(values.reduce((a, b) => a + b, 0))
}
