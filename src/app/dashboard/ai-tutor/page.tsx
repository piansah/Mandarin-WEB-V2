import { AITutorChat } from "@/components/ai-tutor-chat"

export default function AITutorPage() {
  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Tutor Mandarin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tanya kosakata, tata bahasa, Hanzi, atau berlatih percakapan Mandarin.
        </p>
      </div>
      <AITutorChat />
    </main>
  )
}
