import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { useNavigate } from 'react-router'
import { cx } from '../lib/cx'
import { Icon, type IconName } from './icons'

// ── Button ───────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'win' | 'loss'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg active:brightness-90',
  secondary: 'bg-surface-2 text-fg border border-line active:bg-surface-3',
  ghost: 'text-fg active:bg-surface-2',
  danger: 'bg-loss/15 text-loss border border-loss/40 active:bg-loss/25',
  win: 'bg-win/15 text-win border border-win/40 active:bg-win/25',
  loss: 'bg-loss/15 text-loss border border-loss/40 active:bg-loss/25',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-xl gap-2',
  lg: 'h-14 px-5 text-base rounded-2xl gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  block?: boolean
}

export function Button({ variant = 'secondary', size = 'md', icon, block, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center font-semibold transition-[filter,background-color] select-none disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, className, ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex h-11 w-11 items-center justify-center rounded-xl text-fg active:bg-surface-2 disabled:opacity-40', className)}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  )
}

/**
 * A destructive button that needs a second tap within a few seconds — confirmation without a modal.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = 'Tap again to confirm',
  ...rest
}: Omit<ButtonProps, 'onClick'> & { onConfirm: () => void; confirmLabel?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button
      {...rest}
      variant={armed ? 'danger' : rest.variant}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  )
}

// ── Segmented control ───────────────────────────────────

export interface SegOption<T extends string | number> {
  value: T
  label: ReactNode
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ariaLabel,
}: {
  options: readonly SegOption<T>[]
  value: T | null
  onChange: (v: T) => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
  ariaLabel?: string
}) {
  const h = size === 'sm' ? 'h-8 text-[13px]' : size === 'lg' ? 'h-12 text-base' : 'h-10 text-sm'
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx('flex rounded-xl bg-surface-2 p-1 gap-1', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-lg px-2 font-semibold transition-colors',
            h,
            value === o.value ? 'bg-surface-3 text-fg shadow-sm' : 'text-muted active:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Switch ───────────────────────────────────────────────

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  description?: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-2 text-left"
    >
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-surface-3')}>
        <span
          className={cx(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}

// ── Form fields ──────────────────────────────────────────

const inputClass =
  'w-full rounded-xl border border-line bg-surface-2 px-3 h-11 text-[16px] text-fg placeholder:text-faint focus:border-accent focus:outline-none'

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, className)} {...rest} />
}

export function TextArea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, 'h-auto min-h-24 py-2 leading-snug', className)} {...rest} />
}

/**
 * Numeric input that keeps the user's text while typing and reports parsed numbers.
 * Empty input reports null.
 */
export function NumberInput({
  value,
  onChange,
  className,
  allowEmpty = true,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null | undefined
  onChange: (v: number | null) => void
  allowEmpty?: boolean
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setText(value == null ? '' : String(value))
    }
  }, [value])
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cx(inputClass, 'num', className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value
        setText(t)
        const cleaned = t.replace(/[,$\s]/g, '')
        if (cleaned === '') {
          if (allowEmpty) {
            last.current = null
            onChange(null)
          }
          return
        }
        const n = Number(cleaned)
        if (Number.isFinite(n)) {
          last.current = n
          onChange(n)
        }
      }}
      {...rest}
    />
  )
}

// ── Layout ───────────────────────────────────────────────

export function PageHeader({ title, back, actions, subtitle }: { title: ReactNode; back?: boolean | string; actions?: ReactNode; subtitle?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-line/60 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2">
        {back && (
          <IconButton
            icon="chevronLeft"
            label="Back"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          />
        )}
        <div className={cx('min-w-0 flex-1', !back && 'pl-2')}>
          <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
          {subtitle && <div className="truncate text-xs text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </header>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-3xl px-4 pb-8 pt-4', className)}>{children}</div>
}

export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('mb-5', className)}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          {title && <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-surface p-4', className)}>{children}</div>
}

export function EmptyState({ icon, title, children }: { icon?: IconName; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
          <Icon name={icon} />
        </div>
      )}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-xs text-sm text-muted">{children}</div>}
    </div>
  )
}

export function Banner({ tone = 'info', icon, children, className }: { tone?: 'info' | 'warn'; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex items-start gap-2 rounded-xl border px-3 py-2 text-sm',
        tone === 'warn' ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line bg-surface-2 text-muted',
        className,
      )}
    >
      {icon && <Icon name={icon} size={18} className="mt-0.5 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// ── Bottom sheet (single level; never stacked) ───────────

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby={id}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="pb-safe relative w-full max-w-lg rounded-t-3xl border border-line bg-surface md:rounded-3xl">
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 id={id} className="text-lg font-semibold">
            {title}
          </h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors',
        active ? 'border-accent bg-accent-soft text-fg' : 'border-line bg-surface-2 text-muted active:text-fg',
        className,
      )}
    >
      {children}
    </button>
  )
}
