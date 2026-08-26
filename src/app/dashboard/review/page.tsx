"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/browser"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Clock, CheckCircle2, RotateCcw } from "lucide-react"

type DueCard = {
  id: string
  hanzi: string
  pinyin: string
  arti: string
  dueDate: string
  interval: number
  easeFactor: number
}

export default function ReviewPage() {
  const [dueCards, setDueCards] = React.useState<DueCard[]>([])
  const [loading, setLoading] = React.useState(true)
  const [reviewing, setReviewing] = React.useState(false)

  React.useEffect(() => {
    loadDueCards()
  }, [])

  async function loadDueCards() {
    setLoading(true)
    try {
      const supa = createClient()
      const { data: { user } } = await supa.auth.getUser()
      if (!user) return

      // Fetch cards due for review from SRS system
      const { data: cards } = await supa
        .from("srs_cards")
        .select("id, hanzi, pinyin, arti, due_date, interval, ease_factor")
        .eq("user_id", user.id)
        .lte("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(20)

      if (cards) {
        setDueCards(cards.map(card => ({
          id: card.id,
          hanzi: card.hanzi,
          pinyin: card.pinyin,
          arti: card.arti,
          dueDate: card.due_date,
          interval: card.interval,
          easeFactor: card.ease_factor,
        })))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Review Kosakata</h1>
        <p className="text-muted-foreground">
          {dueCards.length > 0
            ? `${dueCards.length} kartu harus direview hari ini`
            : "Tidak ada kartu yang harus direview"}
        </p>
      </div>

      {dueCards.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="text-muted-foreground">Semua kartu sudah direview!</p>
            <Button variant="outline" onClick={loadDueCards}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {dueCards.map((card) => (
            <Card key={card.id} className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{card.hanzi}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {new Date(card.dueDate).toLocaleDateString('id-ID')}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-muted-foreground">{card.pinyin}</p>
                  <p className="font-medium">{card.arti}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                    <span>Interval: {card.interval} hari</span>
                    <span>EF: {card.easeFactor.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
