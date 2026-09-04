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
  durationMinutes: number
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
  partType: "content" | "practice" | "quiz"
  vocab: { id: string; hanzi: string; pinyin: string; translation: string | null }[]
}

export type ModulDetail = {
  id: string
  slug: string
  title: string
  description: string | null
  summary: string | null
  durationMinutes: number
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
  duration_minutes: number
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

export async function fetchModulOverview(): Promise<ModulOverview> {
  const supa = createClient()
  const {
    data: { user },
  } = await supa.auth.getUser()

  const [levelsRes, modulesRes, tagsRes, progressRes] = await Promise.all([
    supa.from("modul_levels").select("id, code, label, description, order_index").order("order_index"),
    supa
      .from("modul_modules")
      .select("id, level_id, slug, title, description, order_index, duration_minutes, part_count, has_quiz")
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
      progressByModule.set(row.module_id, { status: row.status, progress_percent: row.progress_percent })
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
      durationMinutes: m.duration_minutes,
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
    .select("id, slug, title, description, summary, duration_minutes, has_quiz, level:modul_levels(code, label)")
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
        "id, order_index, title, content, part_type, modul_vocab_cards(id, hanzi, pinyin, translation, order_index)",
      )
      .eq("module_id", moduleRow.id)
      .order("order_index")
      .order("order_index", { foreignTable: "modul_vocab_cards" }),
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

  return {
    id: moduleRow.id,
    slug: moduleRow.slug,
    title: moduleRow.title,
    description: moduleRow.description,
    summary: moduleRow.summary,
    durationMinutes: moduleRow.duration_minutes,
    hasQuiz: moduleRow.has_quiz,
    tags: (tagsRes.data ?? [])
      .map((t) => extractTagName((t as { modul_tags: unknown }).modul_tags))
      .filter((n): n is string => Boolean(n)),
    level: level ? { code: level.code, label: level.label } : { code: "", label: "" },
    parts: (partsRes.data ?? []).map((p) => ({
      id: p.id,
      orderIndex: p.order_index,
      title: p.title,
      content: p.content as Record<string, unknown> | null,
      partType: p.part_type as ModulPart["partType"],
      vocab: (p.modul_vocab_cards ?? []) as ModulPart["vocab"],
    })),
    progress: progressRes.data
      ? {
        status: progressRes.data.status,
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
}

export type ModulQuizQuestion = {
  id: string
  questionText: string
  options: ModulQuizOption[]
  correctOptionId: string
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
 *  Asumsi: pilihan ganda disimpan dalam kolom `options` (JSONB) dan kunci jawaban di `correct_option_id`. */
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
    .select("id, question_text, options, correct_option_id")
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
      // options bisa berupa array JSON [{ id: "A", text: "..." }]
      const opts = Array.isArray(q.options) ? q.options : []
      return {
        id: q.id,
        questionText: q.question_text,
        correctOptionId: q.correct_option_id,
        options: opts.map((o: any) => ({
          id: o.id,
          text: o.text || o.option_text,
        })),
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

  // Tandai modul selesai jika lulus
  if (passed) {
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
  }
}