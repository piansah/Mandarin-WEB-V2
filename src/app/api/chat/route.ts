/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/*
   route.ts -- api/chat/route.ts
   Endpoint streaming untuk AI Tutor Mandarin menggunakan Google Gemini.
   Menerima pesan user dan streaming respons Gemini tanpa menyimpan chat. */

import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI, type Content } from "@google/genai"
import { createClient } from "@/lib/supabase/server"

const GEMINI_TIMEOUT_MS = 25_000
const GEMINI_RETRY_DELAYS_MS = [500, 1_000]

function isTemporaryGeminiError(error: unknown) {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number(error.status)
    : undefined
  const message = error instanceof Error ? error.message : String(error)

  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
    || /\b(408|429|500|502|503|504)\b|TIMEOUT|DEADLINE_EXCEEDED|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(message)
}

const SYSTEM_PROMPT = `Kamu adalah Tutor Mandarin AI yang ahli dan ramah untuk aplikasi Mandarin Journey (belajar HSK).

PERAN KAMU:
- Bantu pengguna memahami kosakata, tata bahasa, dan ekspresi Mandarin
- Jelaskan arti karakter Hanzi, pinyin, dan nada (tones)
- Berikan contoh kalimat yang natural dan relevan
- Perbaiki kesalahan bahasa dengan sopan dan konstruktif
- Latih percakapan Mandarin dengan pengguna (roleplay)
- Sesuaikan level penjelasan dengan level pengguna (HSK 1-6)

FORMAT RESPONS:
- Gunakan Bahasa Indonesia untuk penjelasan
- Tulis Hanzi dengan pinyin di sampingnya, contoh: 你好 (nǐ hǎo)
- Untuk karakter baru, sertakan terjemahan: 学习 (xuéxí) = belajar
- Gunakan nada dalam pinyin (ā á ǎ à, ē é ě è, dll.)
- Buat respons ringkas tapi informatif, max 300 kata kecuali diminta lebih panjang
- Untuk latihan percakapan, mainkan peran dengan natural

BATASAN:
- Fokus hanya pada bahasa Mandarin dan budaya Tiongkok yang relevan
- Jika ditanya di luar topik, arahkan kembali ke belajar Mandarin dengan ramah
- Jangan mengaku mengetahui seluruh materi atau isi database aplikasi.
- Jika konteks deck database disertakan, gunakan data itu sebagai sumber utama untuk pertanyaan tentang deck tersebut.
- Jika pengguna menanyakan data database tanpa memilih deck dan konteksnya tidak tersedia, jelaskan bahwa deck belum dipilih dan minta pengguna memilih deck di bagian atas chat.

Mulai dengan antusias dan dukung semangat belajar pengguna! 加油! (jiā yóu - semangat!)`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { message, sessionId, deckId: rawDeckId } = body

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Pesan terlalu panjang (maks 2000 karakter)" }, { status: 400 })
    }

    if (typeof sessionId !== "string") {
      return NextResponse.json({ error: "Sesi chat tidak valid" }, { status: 400 })
    }

    let deckContext = ""
    let exactVocabularyList: string | null = null
    if (rawDeckId !== null && rawDeckId !== undefined && rawDeckId !== "") {
      const deckId = Number(rawDeckId)
      if (!Number.isSafeInteger(deckId) || deckId < 1) {
        return NextResponse.json({ error: "Deck referensi tidak valid" }, { status: 400 })
      }

      const { data: deck, error: deckError } = await supabase
        .from("flashcard_sets")
        .select("id, title, description, hsk_level")
        .eq("id", deckId)
        .eq("is_default", true)
        .maybeSingle()

      if (deckError) throw deckError
      if (!deck) return NextResponse.json({ error: "Deck tidak ditemukan" }, { status: 404 })

      const asksForFullList = /\b(daftar|list|semua|seluruh|lengkap|sebutkan|tampilkan|apa saja)\b/i.test(message)
        && /\b(kosakata|kata|deck|kartu)\b/i.test(message)
      let cardsQuery = supabase
        .from("flashcard_cards")
        .select("hanzi, pinyin, arti, catatan, word_class", asksForFullList ? { count: "exact" } : undefined)
        .eq("set_id", deck.id)
        .order("id", { ascending: true })

      if (asksForFullList) cardsQuery = cardsQuery.range(0, 999)
      else cardsQuery = cardsQuery.limit(250)

      const { data: firstPage, error: cardsError, count } = await cardsQuery
      if (cardsError) throw cardsError
      const cards = [...(firstPage ?? [])]

      if (asksForFullList && (count ?? 0) > cards.length) {
        for (let offset = cards.length; offset < (count ?? 0); offset += 1000) {
          const { data: nextPage, error: nextPageError } = await supabase
            .from("flashcard_cards")
            .select("hanzi, pinyin, arti, catatan, word_class")
            .eq("set_id", deck.id)
            .order("id", { ascending: true })
            .range(offset, offset + 999)
          if (nextPageError) throw nextPageError
          if (!nextPage?.length) break
          cards.push(...nextPage)
        }
      }

      if (asksForFullList) {
        exactVocabularyList = [
          `Berikut seluruh ${cards.length} kosakata yang tercatat di Deck ${deck.id}: ${deck.title} (HSK ${deck.hsk_level}.`,
          ...cards.map((card, index) => {
            const details = [card.word_class, card.catatan].filter(Boolean).join("; ")
            return `${index + 1}. ${card.hanzi} (${card.pinyin}) = ${card.arti}${details ? ` — ${details}` : ""}`
          }),
        ].join("\n")
      }

      deckContext = `\n\nDATA REFERENSI DATABASE — deck ${deck.id}: ${deck.title} (HSK ${deck.hsk_level})\nDeskripsi: ${deck.description || "(tidak ada)"}\nDaftar kartu yang tersedia (${cards?.length ?? 0}):\n${JSON.stringify((cards ?? []).map((card) => ({
        hanzi: card.hanzi,
        pinyin: card.pinyin,
        arti: card.arti,
        catatan: card.catatan,
        kelasKata: card.word_class,
      })))}\n\nGunakan hanya kartu di atas saat menyebut kosakata deck ini. Jika kata yang ditanyakan tidak ada dalam data, katakan bahwa kata tersebut tidak tercantum di deck ini. Jangan menyimpulkan daftar yang dikirim adalah seluruh deck jika batas pengambilan mungkin tercapai.`
    }

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("id, title")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (sessionError) throw sessionError
    if (!session) return NextResponse.json({ error: "Sesi chat tidak ditemukan" }, { status: 404 })

    const { data: savedMessages, error: historyError } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(40)

    if (historyError) throw historyError

    const geminiHistory: Content[] = []
    for (const msg of [...(savedMessages ?? [])].reverse()) {
      const role = msg.role === "assistant" ? "model" : "user"
      const previous = geminiHistory.at(-1)

      // Gemini requires alternating user/model turns, starting with a user turn.
      if (!previous && role !== "user") continue
      if (previous?.role === role) {
        const textPart = previous.parts?.find((part) => typeof part.text === "string")
        if (textPart?.text) textPart.text += `\n\n${msg.content}`
      } else {
        geminiHistory.push({ role, parts: [{ text: msg.content }] })
      }
    }

    const { error: saveUserError } = await supabase.from("chat_messages").insert({
      session_id: session.id,
      role: "user",
      content: message.trim(),
    })
    if (saveUserError) throw saveUserError

    const sessionUpdate: { updated_at: string; title?: string } = {
      updated_at: new Date().toISOString(),
    }
    if (!savedMessages?.length) sessionUpdate.title = message.trim().replace(/\s+/g, " ").slice(0, 72)
    const { error: sessionUpdateError } = await supabase
      .from("chat_sessions")
      .update(sessionUpdate)
      .eq("id", session.id)
      .eq("user_id", user.id)
    if (sessionUpdateError) throw sessionUpdateError

    if (exactVocabularyList) {
      const { error: saveAssistantError } = await supabase.from("chat_messages").insert({
        session_id: session.id,
        role: "assistant",
        content: exactVocabularyList,
      })
      if (saveAssistantError) throw saveAssistantError

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: exactVocabularyList })}\n\n`))
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured")

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), GEMINI_TIMEOUT_MS)
    const ai = new GoogleGenAI({ apiKey })
    const chat = ai.chats.create({
      model: "gemini-3.6-flash",
      history: geminiHistory,
      config: {
        systemInstruction: `${SYSTEM_PROMPT}${deckContext}`,
        abortSignal: abortController.signal,
      },
    })

    // Retry hanya saat Gemini menolak request sebelum stream dimulai.
    // Gangguan di tengah stream tidak diulang agar jawaban tidak terduplikasi.
    let result
    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          result = await chat.sendMessageStream({ message: message.trim() })
          break
        } catch (error) {
          const retryDelay = GEMINI_RETRY_DELAYS_MS[attempt]
          if (!isTemporaryGeminiError(error) || retryDelay === undefined) throw error

          console.warn(`[/api/chat] Gemini sementara tidak tersedia; mencoba ulang (${attempt + 1}/2).`)
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          if (abortController.signal.aborted) throw error
        }
      }
    } catch (error) {
      clearTimeout(timeout)
      throw error
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let fullResponse = ""

        try {
          for await (const chunk of result) {
            const text = chunk.text
            if (text) {
              fullResponse += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          if (fullResponse) {
            const { error: saveAssistantError } = await supabase.from("chat_messages").insert({
              session_id: session.id,
              role: "assistant",
              content: fullResponse,
            })
            if (saveAssistantError) throw saveAssistantError
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
        } catch (error) {
          console.error("[/api/chat] Gemini stream error:", error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Layanan AI terputus. Coba lagi sebentar lagi." })}\n\n`))
        } finally {
          clearTimeout(timeout)
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("[/api/chat] Error:", error)
    const temporarilyUnavailable = isTemporaryGeminiError(error)
    return NextResponse.json(
      {
        error: "Terjadi kesalahan, coba lagi.",
        details: temporarilyUnavailable
          ? "Layanan AI sedang padat. Coba kirim pesan lagi sebentar lagi."
          : "AI Tutor sedang mengalami kendala. Coba lagi nanti.",
      },
      { status: temporarilyUnavailable ? 503 : 500 }
    )
  }
}

