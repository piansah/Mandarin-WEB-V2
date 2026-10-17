/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/*
   route.ts -- api/chat/route.ts
   Endpoint streaming untuk AI Tutor Mandarin menggunakan Google Gemini.
   Menerima pesan user dan streaming respons Gemini tanpa menyimpan chat. */

import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI, type Content } from "@google/genai"
import { createClient } from "@/lib/supabase/server"

const GEMINI_TIMEOUT_MS = 25_000

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

Mulai dengan antusias dan dukung semangat belajar pengguna! 加油! (jiā yóu - semangat!)`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { message, history = [] } = body

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Pesan terlalu panjang (maks 2000 karakter)" }, { status: 400 })
    }

    // Konversi history ke format Gemini
    const rawHistory = Array.isArray(history)
      ? (history as { role?: unknown; content?: unknown }[])
      : []
    const geminiHistory: Content[] = []

    for (const msg of rawHistory) {
      if ((msg.role !== "user" && msg.role !== "assistant") || typeof msg.content !== "string") continue

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

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured")

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), GEMINI_TIMEOUT_MS)
    const ai = new GoogleGenAI({ apiKey })
    const chat = ai.chats.create({
      model: "gemini-3.6-flash",
      history: geminiHistory,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        abortSignal: abortController.signal,
      },
    })

    // Kirim pesan dan stream respons menggunakan Google Gen AI SDK.
    let result
    try {
      result = await chat.sendMessageStream({ message: message.trim() })
    } catch (error) {
      clearTimeout(timeout)
      throw error
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          for await (const chunk of result) {
            const text = chunk.text
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
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

