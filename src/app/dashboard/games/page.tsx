"use client"

import * as React from "react"
import Link from "next/link"
import { Gamepad2, ArrowRight, Lock, Unlock, Worm, Languages, SquareStack, LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { useSupabase } from "@/hooks/use-supabase"
import { cn } from "@/lib/utils"

export default function GameHubPage() {
  const supa = useSupabase()
  const [completedDecks, setCompletedDecks] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadStats() {
      try {
        const { data: { user } } = await supa.auth.getUser()
        if (!user) return

        // Hitung jumlah deck yang sudah diselesaikan berdasarkan jumlah distinct quiz key
        // (setiap deck yang diselesaikan menyimpan 1 baris di user_scores dengan type="quiz")
        const { data: quizScores } = await supa
          .from("user_scores")
          .select("key")
          .eq("user_id", user.id)
          .eq("type", "quiz")

        const count = quizScores ? new Set(quizScores.map(r => r.key)).size : 0
        setCompletedDecks(count)

      } catch (error) {
        console.error("Failed to load user game stats:", error)
      } finally {
        setLoading(false)
      }
    }
    
    loadStats()
  }, [supa])

  const games: { id: string; title: string; description: string; image: string; icon: LucideIcon; url: string; decksRequired: number; tags: string[] }[] = [
    {
      id: "snake",
      title: "Ular Tebak Hanzi",
      description: "Kendalikan ular untuk memakan Hanzi yang sesuai dengan pinyin dan arti yang muncul. Hati-hati jangan sampai menabrak dinding atau ekormu sendiri!",
      image: "linear-gradient(135deg, #4ADE80 0%, #16A34A 100%)",
      icon: Worm,
      url: "/dashboard/games/snake",
      decksRequired: 0, 
      tags: ["Hanzi", "Fokus", "Refleks"],
    },
    {
      id: "match",
      title: "Cocokkan Hanzi",
      description: "Latih ingatanmu! Balik kartu dan temukan pasangan Hanzi dengan Pinyin atau artinya dalam waktu yang ditentukan.",
      image: "linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)",
      icon: Languages,
      url: "/dashboard/games/match",
      decksRequired: 2, 
      tags: ["Ingatan", "Kosakata"],
    },
    {
      id: "speedrun",
      title: "Flashcard Speedrun",
      description: "Jawab sebanyak mungkin flashcard dengan benar dalam waktu 60 detik. Seberapa cepat kamu bisa mengingat?",
      image: "linear-gradient(135deg, #F87171 0%, #DC2626 100%)",
      icon: SquareStack,
      url: "/dashboard/games/speedrun",
      decksRequired: 4,
      tags: ["Kecepatan", "Recall"],
    }
  ]

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="w-full px-6 py-10 space-y-10 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary/20 blur-3xl rounded-full pointer-events-none" />
        
        <div className="space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-2">
            <Gamepad2 className="w-4 h-4" />
            <span>Zona Bermain</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Game Hub
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Belajar Mandarin tidak harus membosankan. Mainkan minigames untuk menguji kemampuanmu, dapatkan XP, dan buka game baru!
          </p>
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game, idx) => {
          const isUnlocked = completedDecks >= game.decksRequired
          
          return (
            <div 
              key={game.id}
              className="animate-in fade-in slide-in-from-bottom-4 duration-700"
              style={{ animationDelay: `${idx * 100}ms`, animationFillMode: "both" }}
            >
              <Card className={`group overflow-hidden h-full flex flex-col border-2 transition-all duration-300 hover:shadow-xl ${isUnlocked ? 'hover:border-primary/50' : 'opacity-80 grayscale-[30%]'}`}>
                {/* Thumbnail Area */}
                <div 
                  className="h-48 relative overflow-hidden"
                  style={{ background: game.image }}
                >
                  {/* Decorative Elements */}
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500" />
                  <div className="absolute -bottom-10 -right-10 opacity-30 scale-150 group-hover:scale-110 transition-transform duration-700">
                    <game.icon className="w-48 h-48 text-white" />
                  </div>
                  
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    {!isUnlocked && (
                      <Badge variant="secondary" className="bg-background/80 backdrop-blur-md flex gap-1.5 items-center px-3 py-1">
                        <Lock className="w-3 h-3" />
                        Butuh {game.decksRequired} Deck
                      </Badge>
                    )}
                    {isUnlocked && (
                      <Badge variant="default" className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-white/20 flex gap-1.5 items-center px-3 py-1">
                        <Unlock className="w-3 h-3" />
                        Terbuka
                      </Badge>
                    )}
                  </div>
                </div>

                <CardContent className="flex-1 flex flex-col p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors flex items-center gap-2">
                      {game.title}
                    </h3>
                    <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed">
                      {game.description}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-6 mt-auto">
                    {game.tags.map(tag => (
                      <span key={tag} className="text-[10px] uppercase tracking-wider font-semibold bg-muted px-2 py-1 rounded-md text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {isUnlocked ? (
                    <Link
                      href={game.url}
                      className={cn(buttonVariants({ variant: "default" }), "w-full font-semibold group/btn h-8 justify-center")}
                    >
                      Mainkan Sekarang
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  ) : (
                    <div className="space-y-2">
                      <Button className="w-full font-semibold" variant="secondary" disabled>
                        <Lock className="w-4 h-4 mr-2" />
                        Terkunci
                      </Button>
                      <p className="text-[11px] text-center text-muted-foreground">
                        Selesaikan {game.decksRequired} deck di{" "}
                        <Link href="/dashboard/flashcard" className="underline text-primary/70 hover:text-primary">Flashcard</Link>{" "}
                        untuk membuka
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}
