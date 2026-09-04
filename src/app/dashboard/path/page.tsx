"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Map, CheckCircle2, Lock, PlayCircle, BookOpen, PenTool, Milestone, Library } from "lucide-react"

import { fetchLearningPath, PathStep } from "@/lib/path"
import { Loader2 } from "lucide-react"

export default function PathPage() {
  const [pathSteps, setPathSteps] = React.useState<PathStep[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchLearningPath()
        setPathSteps(data)
      } catch (error) {
        console.error("Failed to load learning path:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Memuat peta belajar...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col p-6 gap-8 text-foreground max-w-4xl mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col gap-1 text-center md:text-left">
        <div className="flex items-center justify-center md:justify-start gap-2">
          <Map className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Learning Path</h1>
        </div>
        <p className="text-sm text-muted-foreground">Peta perjalanan belajarmu dari HSK 1 hingga HSK 6</p>
      </div>

      <div className="relative mt-4">
        {/* Garis vertikal penghubung (hanya terlihat di layar medium ke atas) */}
        <div className="absolute left-8 top-4 bottom-8 w-1 bg-muted z-0 hidden md:block rounded-full" />
        
        <div className="flex flex-col gap-8 md:gap-12">
          {pathSteps.map((step, index) => {
            const isCompleted = step.status === "completed"
            const isActive = step.status === "active"
            const isLocked = step.status === "locked"

            return (
              <div key={step.id} className="relative z-10 flex flex-col md:flex-row gap-4 md:gap-8 items-start group">
                
                {/* Node Icon */}
                <div className="hidden md:flex flex-col items-center mt-4 shrink-0">
                  <div className={`w-16 h-16 rounded-full border-[6px] flex items-center justify-center bg-background transition-transform duration-300 group-hover:scale-110
                    ${isCompleted ? 'border-emerald-500 text-emerald-500' : 
                      isActive ? 'border-primary text-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]' : 
                      'border-muted text-muted-foreground bg-muted/20'}`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : 
                     isActive ? <Milestone className="w-6 h-6" /> : 
                     <Lock className="w-6 h-6" />}
                  </div>
                </div>

                {/* Content Card */}
                <Card className={`flex-1 overflow-hidden transition-all duration-300 w-full
                  ${isActive ? 'border-primary ring-2 ring-primary/20 shadow-xl scale-[1.02]' : 
                    isLocked ? 'opacity-60 bg-muted/10 shadow-none hover:opacity-100' : 
                    'hover:shadow-md'}`}
                >
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      
                      {/* Left: Info */}
                      <div className="flex flex-col gap-2 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider uppercase
                            ${isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : 
                              isActive ? 'bg-primary text-primary-foreground' : 
                              'bg-muted text-muted-foreground'}`}
                          >
                            Tahap {index + 1}
                          </span>
                          {isActive && (
                            <span className="text-[10px] uppercase font-bold text-primary animate-pulse tracking-wider">
                              • Sedang Dipelajari
                            </span>
                          )}
                        </div>
                        
                        <h2 className="text-xl md:text-2xl font-bold">{step.title}</h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-3 mt-4">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-md">
                            <Library className="w-3.5 h-3.5" />
                            <span>{step.modules?.length || 0} Modul</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-md">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{step.vocabCount} Kata ({step.deckCount} Deck)</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-md">
                            <PenTool className="w-3.5 h-3.5" />
                            <span>{step.grammarCount} Tata Bahasa</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/50 px-3 py-1.5 rounded-md">
                            <Map className="w-3.5 h-3.5" />
                            <span>{step.estafetCount} Estafet</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Progress & Action */}
                      <div className="flex flex-col items-start md:items-end justify-center gap-3 shrink-0 min-w-[140px] border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 border-muted/50">
                        {isCompleted && (
                          <div className="flex flex-col items-start md:items-end w-full">
                            <span className="text-sm font-bold text-emerald-500 mb-2">Tuntas 100%</span>
                            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden mb-3">
                              <div className="h-full bg-emerald-500 w-full" />
                            </div>
                            <Button variant="outline" className="w-full rounded-full text-xs h-8">Review Ulang</Button>
                          </div>
                        )}
                        
                        {isActive && (
                          <div className="flex flex-col items-start md:items-end w-full">
                            <span className="text-sm font-bold text-primary mb-2">Progress {step.progress}%</span>
                            <div className="w-full h-2.5 bg-primary/20 rounded-full overflow-hidden mb-4">
                              <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${step.progress}%` }} />
                            </div>
                            <Button className="w-full rounded-full gap-2">
                              Lanjutkan <PlayCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}

                        {isLocked && (
                          <div className="flex flex-col items-start md:items-end w-full opacity-60">
                            <span className="text-sm font-bold text-muted-foreground mb-2">Belum Terbuka</span>
                            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden mb-4" />
                            <Button variant="secondary" className="w-full rounded-full gap-2 text-xs h-8 cursor-not-allowed" disabled>
                              <Lock className="w-3 h-3" /> Terkunci
                            </Button>
                          </div>
                        )}
                      </div>

                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
