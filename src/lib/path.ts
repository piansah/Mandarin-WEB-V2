import { createClient } from "@/lib/supabase/browser"
import { fetchModulOverview } from "./modul"

export type PathModule = {
  title: string
  status: "completed" | "active" | "locked"
  type: string
}

export type PathStep = {
  id: string
  code: string
  title: string
  description: string
  vocabCount: number
  deckCount: number
  grammarCount: number
  estafetCount: number
  status: "completed" | "active" | "locked"
  progress: number
  modules: PathModule[]
}

export async function fetchLearningPath(): Promise<PathStep[]> {
  const supa = createClient()
  
  // 1. Dapatkan overview modul untuk status level dan daftar modul
  const overview = await fetchModulOverview()

  // 2. Aggregate data secara paralel untuk mempercepat
  const hskLevels = [1, 2, 3, 4, 5, 6]
  
  const [grammarRes, estafetRes, decksRes, ...cardCountsRes] = await Promise.all([
    supa.from("grammar_patterns").select("hsk_level"),
    supa.from("hanzi_sets").select("hsk_level"),
    supa.from("flashcard_sets").select("id, hsk_level"),
    ...hskLevels.map(level =>
      supa
        .from("flashcard_cards")
        .select("id, flashcard_sets!inner(hsk_level)", { count: "exact", head: true })
        .eq("flashcard_sets.hsk_level", level)
    )
  ])

  // Inisialisasi counter per level
  const counts: Record<number, { vocab: number, deck: number, grammar: number, estafet: number }> = {
    1: { vocab: cardCountsRes[0].count || 0, deck: 0, grammar: 0, estafet: 0 },
    2: { vocab: cardCountsRes[1].count || 0, deck: 0, grammar: 0, estafet: 0 },
    3: { vocab: cardCountsRes[2].count || 0, deck: 0, grammar: 0, estafet: 0 },
    4: { vocab: cardCountsRes[3].count || 0, deck: 0, grammar: 0, estafet: 0 },
    5: { vocab: cardCountsRes[4].count || 0, deck: 0, grammar: 0, estafet: 0 },
    6: { vocab: cardCountsRes[5].count || 0, deck: 0, grammar: 0, estafet: 0 },
  }

  // Hitung grammar
  grammarRes.data?.forEach(g => { 
    if (g.hsk_level && counts[g.hsk_level]) counts[g.hsk_level].grammar++ 
  })
  
  // Hitung estafet (hanzi_sets)
  estafetRes.data?.forEach(e => { 
    if (e.hsk_level && counts[e.hsk_level]) counts[e.hsk_level].estafet++ 
  })
  
  // Hitung deck (flashcard_sets)
  decksRes.data?.forEach(d => { 
    if (d.hsk_level && counts[d.hsk_level]) counts[d.hsk_level].deck++ 
  })

  const pathSteps: PathStep[] = []
  
  for (let i = 1; i <= 6; i++) {
    const levelCode = `hsk${i}`
    const levelData = overview.levels.find(l => l.code === levelCode)
    const modules = overview.modules.filter(m => m.level.code === levelCode)
    
    let status: "completed" | "active" | "locked" = "locked"
    let progress = 0

    if (levelData) {
      if (levelData.totalModules > 0 && levelData.completedModules === levelData.totalModules) {
        status = "completed"
        progress = 100
      } else if (modules.some(m => m.status === "active" || m.status === "completed")) {
        status = "active"
        const totalProgress = modules.reduce((sum, m) => sum + m.progressPercent, 0)
        progress = levelData.totalModules > 0 ? Math.round(totalProgress / levelData.totalModules) : 0
      } else if (i === 1 && levelData.totalModules === 0) {
        // Fallback jika tidak ada modul sama sekali tapi ini level pertama
        status = "active"
      }
    }

    // Pastikan level selanjutnya active jika level sebelumnya completed
    if (status === "locked" && i > 1) {
      const prevLevel = pathSteps[i - 2]
      if (prevLevel.status === "completed") {
        status = "active"
      }
    }

    pathSteps.push({
      id: levelCode,
      code: levelCode,
      title: levelData ? levelData.label : getFallbackTitle(i),
      description: levelData?.description || getFallbackDesc(i),
      vocabCount: counts[i].vocab,
      deckCount: counts[i].deck,
      grammarCount: counts[i].grammar,
      estafetCount: counts[i].estafet,
      status,
      progress,
      modules: modules.map(m => ({
        title: m.title,
        status: m.status,
        type: m.hasQuiz ? "Modul + Kuis" : "Modul"
      }))
    })
  }

  return pathSteps
}

function getFallbackTitle(level: number) {
  const titles = ["HSK 1 - Pemula", "HSK 2 - Dasar", "HSK 3 - Menengah", "HSK 4 - Lanjutan", "HSK 5 - Mahir", "HSK 6 - Fasih"]
  return titles[level - 1]
}

function getFallbackDesc(level: number) {
  const descs = [
    "Kenalan, pesan makanan, tanya arah",
    "Belanja, transportasi, kesehatan",
    "Pekerjaan, pendidikan, perasaan",
    "Berita, budaya, diskusi ringan",
    "Sastra, akademik, bisnis",
    "Tingkat native, mampu bicara semua topik kompleks"
  ]
  return descs[level - 1]
}
