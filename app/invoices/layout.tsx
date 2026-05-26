import Navigation from '@/components/navigation'

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Navigation />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
