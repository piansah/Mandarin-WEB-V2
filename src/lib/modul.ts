
/**
 * MODUL — data layer untuk `/dashboard/modul` dan `/dashboard/modul/[slug]`.
 *
 * Sumber data: schema `public`, tabel dengan prefix `modul_` (modul_levels,
 * modul_modules, modul_module_parts, modul_vocab_cards, dst), plus tabel
 * per-user `modul_user_module_progress` dan `modul_bookmarks`.
 *
 * PENTING sebelum file ini bisa jalan:
 * 1. Migration `migration_modul_public.sql` sudah dijalankan di Supabase.
 * Karena semua tabel ada di schema `public`, TIDAK perlu setting apapun
 * di Settings -> API -> Exposed schemas — public sudah exposed by default.
 *
 * Status modul ("locked" / "active" / "completed") TIDAK disimpan sebagai
 * kolom di tabel `modul_modules` — itu properti tabel
 * `modul_user_module_progress` (per user). Modul tanpa baris progress
 * dianggap "locked", KECUALI modul pertama yang belum ada modul sebelumnya
 * yang belum selesai — itu jadi "active" secara otomatis (unlock linear ala
 * Duolingo). Lihat `computeModuleStatuses()`.
 */

import { createClient } from "@/lib/supabase/browser"
import { saveUserScore } from "@/lib/user-scores"

export type ModulStatus = "locked" | "active" | "completed"

export type ModulLevelSummary = {
  id: string
  code: string
  label: string
  description: string | null
  orderIndex: number
  totalModules: number
  completedModules: number
}

export type ModulModuleSummary = {
  id: string
  slug: string
  title: string
  description: string | null
  orderIndex: number
  partCount: number
  hasQuiz: boolean
  tags: string[]
  level: { code: string; label: string }
  status: ModulStatus
  progressPercent: number
}

export type ModulOverview = {
  levels: ModulLevelSummary[]
  modules: ModulModuleSummary[]
  nextStep: ModulModuleSummary | null
}

export type ModulPart = {
  id: string
  orderIndex: number
  title: string
  content: Record<string, unknown> | null
  vocabParts: { hanzi: string; pinyin: string; translation: string | null; order_index: number }[]
  kalimatParts: { hanzi: string; pinyin: string; translation: string | null; order_index: number }[]
}

export type ModulDetail = {
  id: string
  slug: string
  title: string
  description: string | null
  summary: string | null
  hasQuiz: boolean
  tags: string[]
  level: { code: string; label: string }
  parts: ModulPart[]
  progress: { status: ModulStatus; currentPartId: string | null; progressPercent: number } | null
  isBookmarked: boolean
}

/* ══════════════════════════════════════════
   HELPER: hitung status linear-unlock
══════════════════════════════════════════ */

type RawModuleRow = {
  id: string
  level_id: string
  slug: string
  title: string
  description: string | null
  order_index: number
  part_count: number
  has_quiz: boolean
}

/** Ambil `name` dari hasil embed `modul_tags(name)`. Supabase/PostgREST
 *  kadang mengembalikan relasi to-one ini sebagai objek tunggal, kadang
 *  sebagai array satu elemen (tergantung bagaimana cardinality relasi
 *  terdeteksi oleh type generator) — helper ini aman untuk keduanya. */
function extractTagName(entry: unknown): string | undefined {
  if (!entry) return undefined
  if (Array.isArray(entry)) {
    return (entry[0] as { name?: string } | undefined)?.name
  }
  return (entry as { name?: string }).name
}

function computeModuleStatuses(
  sortedModules: RawModuleRow[],
  progressByModule: Map<string, { status: ModulStatus; progress_percent: number }>,
): Map<string, { status: ModulStatus; progressPercent: number }> {
  const result = new Map<string, { status: ModulStatus; progressPercent: number }>()
  let frontierFound = false

  for (const m of sortedModules) {
    const progress = progressByModule.get(m.id)

    if (progress?.status === "completed") {
      result.set(m.id, { status: "completed", progressPercent: 100 })
      continue
    }

    if (!frontierFound) {
      // Modul pertama yang belum selesai = garis depan yang terbuka.
      frontierFound = true
      result.set(m.id, { status: "active", progressPercent: progress?.progress_percent ?? 0 })
    } else {
      result.set(m.id, { status: "locked", progressPercent: 0 })
    }
  }

  return result
}

/* ══════════════════════════════════════════
   OVERVIEW (list + roadmap)
══════════════════════════════════════════ */

import { SupabaseClient } from "@supabase/supabase-js"

export async function fetchModulOverview(
  client?: SupabaseClient
): Promise<ModulOverview> {
  const supa = client ?? createClient()
  const {
    data: { session },
  } = await supa.auth.getSession()
  const user = session?.user

  const [levelsRes, modulesRes, tagsRes, progressRes] = await Promise.all([
    supa.from("modul_levels").select("id, code, label, description, order_index").order("order_index"),
    supa
      .from("modul_modules")
      .select("id, level_id, slug, title, description, order_index, part_count, has_quiz")
      .eq("is_published", true)
      .order("order_index"),
    supa.from("modul_module_tags").select("module_id, modul_tags(name)"),
    user
      ? supa
        .from("modul_user_module_progress")
        .select("module_id, status, progress_percent")
        .eq("user_id", user.id)
      : Promise.resolve({ data: [] as { module_id: string; status: ModulStatus; progress_percent: number }[] }),
  ])

  if (levelsRes.error) throw new Error(levelsRes.error.message)
  if (modulesRes.error) throw new Error(modulesRes.error.message)

  const levelRows = levelsRes.data ?? []
  const moduleRows = modulesRes.data ?? []
  const levelById = new Map(levelRows.map((l) => [l.id, l]))

  const tagsByModule = new Map<string, string[]>()
    ; (tagsRes.data ?? []).forEach((row) => {
      const name = extractTagName((row as { modul_tags: unknown }).modul_tags)
      if (!name) return
      const list = tagsByModule.get(row.module_id) ?? []
      list.push(name)
      tagsByModule.set(row.module_id, list)
    })

  const progressByModule = new Map<string, { status: ModulStatus; progress_percent: number }>()
    ; (progressRes.data ?? []).forEach((row) => {
      progressByModule.set(row.module_id, { status: row.status as ModulStatus, progress_percent: row.progress_percent })
    })

  // Urutan global: level dulu (order_index level), baru order_index modul di dalamnya.
  const sortedModules = [...moduleRows].sort((a, b) => {
    const la = levelById.get(a.level_id)?.order_index ?? 0
    const lb = levelById.get(b.level_id)?.order_index ?? 0
    if (la !== lb) return la - lb
    return a.order_index - b.order_index
  })

  const statusMap = computeModuleStatuses(sortedModules, progressByModule)

  const modules: ModulModuleSummary[] = sortedModules.map((m) => {
    const level = levelById.get(m.level_id)
    const computed = statusMap.get(m.id)!
    return {
      id: m.id,
      slug: m.slug,
      title: m.title,
      description: m.description,
      orderIndex: m.order_index,
      partCount: m.part_count,
      hasQuiz: m.has_quiz,
      tags: tagsByModule.get(m.id) ?? [],
      level: level ? { code: level.code, label: level.label } : { code: "", label: "" },
      status: computed.status,
      progressPercent: computed.progressPercent,
    }
  })

  const levels: ModulLevelSummary[] = [...levelRows]
    .sort((a, b) => a.order_index - b.order_index)
    .map((l) => {
      const modulesInLevel = modules.filter((m) => m.level.code === l.code)
      return {
        id: l.id,
        code: l.code,
        label: l.label,
        description: l.description,
        orderIndex: l.order_index,
        totalModules: modulesInLevel.length,
        completedModules: modulesInLevel.filter((m) => m.status === "completed").length,
      }
    })

  return {
    levels,
    modules,
    nextStep: modules.find((m) => m.status === "active") ?? null,
  }
}

/* ══════════════════════════════════════════
   DETAIL MODUL (halaman [slug])
══════════════════════════════════════════ */

export async function fetchModuleDetail(slug: string): Promise<ModulDetail | null> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()

  const { data: moduleRow, error } = await supa
    .from("modul_modules")
    .select("id, slug, title, description, summary, has_quiz, level:modul_levels(code, label)")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()

  if (error || !moduleRow) return null

  const level = moduleRow.level as unknown as { code: string; label: string } | null

  const [tagsRes, partsRes, progressRes, bookmarkRes] = await Promise.all([
    supa.from("modul_module_tags").select("modul_tags(name)").eq("module_id", moduleRow.id),
    supa
      .from("modul_module_parts")
      .select(
        "id, order_index, title, content, vocab_parts, kalimat_parts",
      )
      .eq("module_id", moduleRow.id)
      .order("order_index"),
    user
      ? supa
        .from("modul_user_module_progress")
        .select("status, current_part_id, progress_percent")
        .eq("user_id", user.id)
        .eq("module_id", moduleRow.id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supa
        .from("modul_bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("module_id", moduleRow.id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // Module parts menentukan kosakata apa yang ditampilkan lewat Hanzi saja.
  // Pinyin dan arti selalu diambil dari sumber kosakata utama.
  const rawParts = partsRes.data ?? []
  const vocabHanzi = Array.from(new Set(rawParts.flatMap((part) => {
    const vocabParts = part.vocab_parts as { cards?: unknown } | null
    if (!Array.isArray(vocabParts?.cards)) return []
    return vocabParts.cards.flatMap((card) => {
      if (!card || typeof card !== "object") return []
      const hanzi = (card as { hanzi?: unknown }).hanzi
      return typeof hanzi === "string" && hanzi.trim() ? [hanzi.trim()] : []
    })
  })))

  const vocabRes = vocabHanzi.length > 0
    ? await supa
      .from("flashcard_cards")
      .select("hanzi, pinyin, arti, set_id")
      .in("hanzi", vocabHanzi)
      .order("set_id", { ascending: true })
    : { data: [] }

  // Hanzi bisa muncul di beberapa deck; pilih record pertama secara
  // deterministik setelah diurutkan berdasarkan set_id.
  const vocabByHanzi = new Map<string, { pinyin: string; arti: string }>()
  for (const card of vocabRes.data ?? []) {
    if (!vocabByHanzi.has(card.hanzi)) {
      vocabByHanzi.set(card.hanzi, { pinyin: card.pinyin, arti: card.arti })
    }
  }

  return {
    id: moduleRow.id,
    slug: moduleRow.slug,
    title: moduleRow.title,
    description: moduleRow.description,
    summary: moduleRow.summary,
    hasQuiz: moduleRow.has_quiz,
    tags: (tagsRes.data ?? [])
      .map((t) => extractTagName((t as { modul_tags: unknown }).modul_tags))
      .filter((n): n is string => Boolean(n)),
    level: level ? { code: level.code, label: level.label } : { code: "", label: "" },
    parts: rawParts.map((p) => {
      // Extract vocab from vocab_parts JSON
      const vocabParts = p.vocab_parts as { cards?: unknown } | null
      const vocabCards = Array.isArray(vocabParts?.cards)
        ? (vocabParts.cards as Array<{ hanzi: string; pinyin: string; translation: string | null; order_index: number }>)
          .map((v, i) => {
            const source = vocabByHanzi.get(v.hanzi)
            return {
              ...v,
              pinyin: source?.pinyin ?? "",
              translation: source?.arti ?? null,
              id: `${p.id}-vocab-${i}`,
            }
          })
        : []

      // Extract kalimat from kalimat_parts JSON
      const kalimatParts = p.kalimat_parts as { cards?: unknown } | null
      const kalimatCards = Array.isArray(kalimatParts?.cards)
        ? (kalimatParts.cards as Array<{ hanzi: string; pinyin: string; translation: string | null; order_index: number }>)
          .map((k, i) => ({ ...k, id: `${p.id}-kalimat-${i}` }))
        : []

      return {
        id: p.id,
        orderIndex: p.order_index,
        title: p.title,
        content: p.content as Record<string, unknown> | null,
        vocabParts: vocabCards,
        kalimatParts: kalimatCards,
      }
    }),
    progress: progressRes.data
      ? {
        status: progressRes.data.status as ModulStatus,
        currentPartId: progressRes.data.current_part_id,
        progressPercent: progressRes.data.progress_percent,
      }
      : null,
    isBookmarked: !!bookmarkRes.data,
  }
}

/* ══════════════════════════════════════════
   MUTASI: progress & bookmark
══════════════════════════════════════════ */

/** Panggil sekali saat halaman detail modul dibuka, supaya modul yang
 *  sebelumnya cuma "active" secara virtual (belum ada baris progress)
 *  langsung punya baris nyata dan tidak balik "locked" kalau dibuka ulang. */
export async function ensureModuleStarted(moduleId: string): Promise<void> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return

  const { data: existing } = await supa
    .from("modul_user_module_progress")
    .select("id")
    .eq("user_id", user.id)
    .eq("module_id", moduleId)
    .maybeSingle()

  if (existing) return

  const { error } = await supa.from("modul_user_module_progress").insert({
    user_id: user.id,
    module_id: moduleId,
    status: "active",
    started_at: new Date().toISOString(),
  })
  if (error) console.warn("[modul] Gagal memulai progress modul:", error.message)
}

/** Simpan posisi bagian yang sedang dibaca. Kalau `isLastPart` true, modul
 *  langsung ditandai selesai (100%). Sengaja tidak menyentuh `started_at`
 *  di sini supaya waktu mulai modul tidak ke-reset tiap pindah bagian. */
export async function saveModulePartProgress(
  moduleId: string,
  partId: string,
  progressPercent: number,
  isLastPart: boolean,
): Promise<void> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return

  // Simpan progress bagian ke modul_user_module_progress
  const { error } = await supa.from("modul_user_module_progress").upsert(
    {
      user_id: user.id,
      module_id: moduleId,
      current_part_id: partId,
      progress_percent: progressPercent,
      status: isLastPart ? "completed" : "active",
      completed_at: isLastPart ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,module_id" },
  )
  if (error) console.warn("[modul] Gagal menyimpan progress bagian:", error.message)

  // Catat progress ke user_scores (type 'modul') untuk XP tracking & streak.
  // Key = 'module:{moduleId}' → satu baris per modul per user.
  // Score = progressPercent (0–100), sehingga XP bertahap seiring modul dibaca.
  const { error: scoreError } = await saveUserScore("modul", `module:${moduleId}`, Math.round(progressPercent))
  if (scoreError) console.warn("[modul] Gagal menyimpan skor progress modul:", scoreError)
}

export async function setModuleBookmark(moduleId: string, bookmarked: boolean): Promise<void> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return

  if (bookmarked) {
    const { error } = await supa
      .from("modul_bookmarks")
      .upsert({ user_id: user.id, module_id: moduleId }, { onConflict: "user_id,module_id" })
    if (error) console.warn("[modul] Gagal menyimpan bookmark:", error.message)
  } else {
    const { error } = await supa
      .from("modul_bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("module_id", moduleId)
    if (error) console.warn("[modul] Gagal menghapus bookmark:", error.message)
  }
}

/* ══════════════════════════════════════════
   KUIS MODUL
══════════════════════════════════════════ */

export type ModulQuizOption = {
  id: string
  text: string
  pinyin?: string
}

export type ModulQuizType = "mcq" | "audio" | "speaking" | "fill_blank" | "word_order" | "sentence_choice" | "matching"

export type ModulQuizPairItem = { id: string; text: string }
export type ModulQuizMatching = {
  left: ModulQuizPairItem[]
  right: ModulQuizPairItem[]
  correctPairs: { leftId: string; rightId: string }[]
}

export type ModulQuizQuestion = {
  id: string
  questionText: string
  questionType: ModulQuizType
  options: ModulQuizOption[]
  correctOptionId: string
  correctOrder?: string[]
  matching?: ModulQuizMatching
}

export type ModulQuiz = {
  moduleId: string
  title: string
  levelLabel: string
  passingScore: number
  questions: ModulQuizQuestion[]
}

/** Ambil soal kuis untuk modul berdasarkan slug.
 *  Tabel: modul_quiz_questions.
 *  JSONB options menyimpan pilihan, bank kata, atau pasangan sesuai question_type. */
export async function fetchModuleQuiz(slug: string): Promise<ModulQuiz | null> {
  const supa = createClient()

  // 1. Ambil info modul
  const { data: moduleRow } = await supa
    .from("modul_modules")
    .select("id, title, has_quiz, level:modul_levels(code, label)")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle()

  if (!moduleRow || !moduleRow.has_quiz) return null

  const level = moduleRow.level as unknown as { code: string; label: string } | null

  // 2. Ambil soal + pilihan jawaban (JSON)
  const { data: questions, error } = await supa
    .from("modul_quiz_questions")
    .select("id, question_text, question_type, options, correct_option_id")
    .eq("module_id", moduleRow.id)
    .order("order_index")

  if (error) {
    console.warn("[modul] Gagal memuat kuis:", error.message)
    return null
  }

  if (!questions || questions.length === 0) return null

  return {
    moduleId: moduleRow.id,
    title: moduleRow.title,
    levelLabel: level?.label ?? "",
    passingScore: 70,
    questions: questions.map((q) => {
      const rawOptions = q.options
      const optionObject = rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)
        ? rawOptions as Record<string, unknown>
        : null
      const optionList = Array.isArray(rawOptions)
        ? rawOptions
        : Array.isArray(optionObject?.tokens)
          ? optionObject.tokens
          : []
      const opts = optionList.flatMap((option) => {
        if (typeof option !== "object" || option === null || !("id" in option)) return []
        const value = option as { id: unknown; text?: unknown; pinyin?: unknown }
        return [{ id: String(value.id), text: String(value.text ?? ""), ...(value.pinyin ? { pinyin: String(value.pinyin) } : {}) }]
      })
      const rawOrder = optionObject?.correct_order
      const correctOrder = Array.isArray(rawOrder) ? rawOrder.map(String) : undefined
      const rawMatching: { left: unknown[]; right: unknown[]; correct_pairs?: unknown } | null = optionObject && Array.isArray(optionObject.left) && Array.isArray(optionObject.right)
        ? { left: optionObject.left, right: optionObject.right, correct_pairs: optionObject.correct_pairs }
        : null
      const matching = rawMatching ? {
        left: rawMatching.left.flatMap((item) => {
          if (typeof item !== "object" || item === null || !("id" in item)) return []
          const value = item as { id: unknown; text?: unknown }
          return [{ id: String(value.id), text: String(value.text ?? "") }]
        }),
        right: rawMatching.right.flatMap((item) => {
          if (typeof item !== "object" || item === null || !("id" in item)) return []
          const value = item as { id: unknown; text?: unknown }
          return [{ id: String(value.id), text: String(value.text ?? "") }]
        }),
        correctPairs: Array.isArray(rawMatching.correct_pairs) ? rawMatching.correct_pairs.flatMap((pair) => {
          if (typeof pair !== "object" || pair === null) return []
          const value = pair as { left_id?: unknown; right_id?: unknown }
          if (value.left_id === undefined || value.right_id === undefined) return []
          return [{ leftId: String(value.left_id), rightId: String(value.right_id) }]
        }) : [],
      } : undefined
      return {
        id: q.id,
        questionText: q.question_text,
        questionType: q.question_type as ModulQuizQuestion["questionType"],
        correctOptionId: q.correct_option_id,
        options: opts,
        ...(correctOrder ? { correctOrder } : {}),
        ...(matching ? { matching } : {}),
      }
    }),
  }
}

/** Simpan hasil kuis ke user_scores dan tandai modul selesai jika lulus. */
export async function saveQuizResult(
  moduleId: string,
  scorePercent: number,
  passed: boolean,
): Promise<void> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()
  if (!user) return

  if (passed) {
    // Tandai modul selesai di modul_user_module_progress
    const { error } = await supa.from("modul_user_module_progress").upsert(
      {
        user_id: user.id,
        module_id: moduleId,
        status: "completed",
        progress_percent: 100,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,module_id" },
    )
    if (error) console.warn("[modul] Gagal menandai modul selesai:", error.message)

    // Update user_scores ke 100 — modul benar-benar selesai (termasuk kuis)
    const { error: scoreError } = await saveUserScore("modul", `module:${moduleId}`, 100)
    if (scoreError) console.warn("[modul] Gagal menyimpan skor kuis modul:", scoreError)
  }
}
