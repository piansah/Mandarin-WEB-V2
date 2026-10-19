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
  progressCompleted: number
  progressTotal: number
  modules: PathModule[]
}

import { SupabaseClient } from "@supabase/supabase-js"

export async function fetchLearningPath(client?: SupabaseClient): Promise<PathStep[]> {
  const supa = client ?? createClient()
  
  // Data overview dan seluruh agregat tidak saling bergantung, jadi ambil
  // bersamaan agar halaman peta belajar tidak menunggu dua gelombang query.
  const hskLevels = [1, 2, 3, 4, 5, 6]
  
  const [userRes, overview, grammarRes, estafetRes, decksRes, ...cardCountsRes] = await Promise.all([
    supa.auth.getUser(),
    fetchModulOverview(supa),
    supa.from("grammar_patterns").select("slug, hsk_level"),
    supa.from("hanzi_sets").select("key, hsk_level"),
    supa.from("flashcard_sets").select("id, hsk_level"),
    ...hskLevels.map(level =>
      supa
        .from("flashcard_cards")
        .select("id, flashcard_sets!inner(hsk_level)", { count: "exact", head: true })
        .eq("flashcard_sets.hsk_level", level)
    )
  ])

  const userId = userRes.data.user?.id
  const scoresRes = userId
    ? await supa
      .from("user_scores")
      .select("type, key")
      .eq("user_id", userId)
      .in("type", ["quiz", "grammar", "kal"])
    : { data: [] as { type: string; key: string }[] }
  const completedActivities = new Set((scoresRes.data ?? []).map(row => `${row.type}:${row.key}`))

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
    
    const levelDecks = (decksRes.data ?? []).filter(deck => deck.hsk_level === i)
    const levelGrammar = (grammarRes.data ?? []).filter(pattern => pattern.hsk_level === i)
    const levelEstafet = (estafetRes.data ?? []).filter(set => set.hsk_level === i)

    // Modul tuntas setelah lulus kuis; deck dan Estafet masing-masing satu
    // aktivitas yang dihitung dari kuisnya; grammar selesai setelah latihan.
    const progressTotal = modules.length + levelDecks.length + levelGrammar.length + levelEstafet.length
    const completedModules = modules.filter(module => module.status === "completed").length
    const completedDeckActivities = levelDecks.filter(deck => completedActivities.has(`quiz:${deck.id}`)).length
    const completedGrammar = levelGrammar.filter(pattern => completedActivities.has(`grammar:${pattern.slug}`)).length
    const completedEstafet = levelEstafet.filter(set => completedActivities.has(`kal:${set.key}`)).length
    const progressCompleted = completedModules + completedDeckActivities + completedGrammar + completedEstafet
    const progress = progressTotal > 0 ? Math.round((progressCompleted / progressTotal) * 100) : 0

    let status: "completed" | "active" | "locked" = "locked"
    if (progressTotal > 0 && progressCompleted === progressTotal) {
      status = "completed"
    } else if (
      progressCompleted > 0 ||
      modules.some(module => module.status === "active" || module.status === "completed") ||
      (i === 1 && (levelData?.totalModules ?? 0) === 0)
    ) {
      status = "active"
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
      progressCompleted,
      progressTotal,
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
