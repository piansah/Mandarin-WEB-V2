import { Languages } from "lucide-react"

export default function HanziPage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 p-12 text-center min-h-[60vh]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Languages className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold">Hanzi</h1>
      <p className="text-muted-foreground text-sm max-w-sm">
        Fitur belajar Hanzi akan segera tersedia. Stay tuned!
      </p>
    </div>
  )
}
