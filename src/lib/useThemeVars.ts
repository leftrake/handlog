import { useEffect, useState } from 'react'

function read<T extends string>(names: readonly T[]): Record<T, string> {
  const cs = getComputedStyle(document.documentElement)
  return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Record<T, string>
}

/**
 * Current values of theme CSS variables, re-read when the theme changes. Chart libraries draw
 * SVG with presentation attributes, where `var()` isn't reliable, so they get resolved colours.
 */
export function useThemeVars<T extends string>(names: readonly T[]): Record<T, string> {
  const key = names.join(',')
  const [vals, setVals] = useState(() => read(names))
  useEffect(() => {
    const list = key.split(',') as T[]
    const mo = new MutationObserver(() => setVals(read(list)))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [key])
  return vals
}
