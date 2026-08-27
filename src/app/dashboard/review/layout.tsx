export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {children}
    </div>
  )
}
