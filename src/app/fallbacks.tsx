import { EmptyState, PageHeader } from '../components/ui'

export function NotFound() {
  return (
    <>
      <PageHeader title="Not found" back="/" />
      <EmptyState title="Nothing here">That page doesn't exist.</EmptyState>
    </>
  )
}

export function Placeholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState title={title}>Coming in a later build phase.</EmptyState>
    </>
  )
}
