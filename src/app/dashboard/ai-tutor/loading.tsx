import { Bot, LoaderCircle } from "lucide-react"

export default function AITutorLoading() {
  return (
    <main className="flex h-full min-h-0 w-full" aria-label="Memuat AI Tutor">
      <section className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-card">
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI Tutor Mandarin</p>
            <p className="text-xs text-muted-foreground">Powered by Gemini · 加油!</p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Membuka ruang belajar…
        </div>
      </section>
    </main>
  )
}
