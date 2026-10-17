"use client"

/* (c) 2026 Piansah - Mandarin Journey learning. All rights reserved. */
/*
   ai-tutor-chat.tsx -- Floating AI Tutor Chat Widget
   Chatbot belajar Mandarin dengan Google Gemini, disimpan ke Supabase. */

import * as React from "react"
import {
  Send,
  Bot,
  Plus,
  Loader2,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSupabase } from "@/hooks/use-supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  created_at?: string
}

// ─── Helper: format text AI (bold, newline) ──────────────────────────────────

function formatAIText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part.split("\n").map((line, j, arr) => (
      <React.Fragment key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </React.Fragment>
    ))
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AITutorChat() {
  const supabase = useSupabase()
  const [messages, setMessages] = React.useState<Message[]>([])
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [streamingText, setStreamingText] = React.useState("")
  const [profileAvatar, setProfileAvatar] = React.useState("")
  const [profileInitial, setProfileInitial] = React.useState("U")

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    let active = true
    async function loadProfileAvatar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active || !user) return

      const { data: profile } = await supabase
        .from("user_profile")
        .select("display_name, custom_avatar_url")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!active) return
      const name = profile?.display_name || user.user_metadata?.full_name || user.email || "User"
      setProfileInitial(String(name).trim().charAt(0).toUpperCase() || "U")
      setProfileAvatar(profile?.custom_avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || "")
    }

    void loadProfileAvatar()
    return () => { active = false }
  }, [supabase])

  // Auto-scroll ke bawah saat ada pesan baru
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingText])

  // Auto-resize textarea
  React.useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px"
  }, [input])

  function startNewChat() {
    setMessages([])
    setStreamingText("")
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isLoading) return

    setInput("")
    setIsLoading(true)
    setStreamingText("")

    // Tampilkan pesan user secara optimistis
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])

    // History yang dikirim ke API (tanpa pesan user terbaru, sudah ada di `message`)
    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
        }),
      })

      if (!res.ok || !res.body) {
        let reason = "Gagal menghubungi AI Tutor"
        try {
          const data = await res.json()
          if (typeof data.details === "string") reason = data.details
        } catch { /* keep the generic message */ }
        throw new Error(reason)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6)
          if (raw === "[DONE]") break

          try {
            const parsed = JSON.parse(raw)
            if (parsed.text) {
              accumulated += parsed.text
              setStreamingText(accumulated)
            }
            if (parsed.error) throw new Error(parsed.error)
          } catch { /* skip invalid JSON */ }
        }
      }

      // Pindahkan teks streaming ke messages
      if (accumulated) {
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: accumulated,
        }
        setMessages((prev) => [...prev, aiMsg])
      }
    } catch (err) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: err instanceof Error && err.message !== "Gagal menghubungi AI Tutor"
          ? `Maaf, AI Tutor mengalami kendala: ${err.message}`
          : "Maaf, terjadi kesalahan. Coba lagi ya! 😅",
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setStreamingText("")
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-card">
            {/* Header */}
            <div
              className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-5 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  AI Tutor Mandarin
                </p>
                <p className="text-xs text-muted-foreground">
                  Powered by Gemini · 加油!
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={startNewChat}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Chat baru"
                  title="Chat baru"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 min-h-0">

              {/* ── View: Chat ────────────────────────────────────────────── */}
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Welcome state */}
                  {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                        <span className="text-3xl">🤖</span>
                      </div>
                      <div>
                        <p className="text-base font-semibold mb-1">AI Tutor Mandarin</p>
                        <p className="text-sm text-muted-foreground">
                          Tanya apa saja tentang bahasa Mandarin! Mulai dari arti kata, grammar, sampai latihan percakapan.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 w-full">
                        {[
                          "Apa artinya 你好?",
                          "Ajari saya cara ngitung dalam Mandarin",
                          "Mari latihan percakapan sederhana",
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => { setInput(suggestion); textareaRef.current?.focus() }}
                            className="text-left text-xs px-3 py-2 rounded-lg transition-colors hover:bg-muted border border-border"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message bubbles */}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user"
                            ? "rounded-tr-sm text-white"
                            : "rounded-tl-sm"
                          }`}
                        style={
                          msg.role === "user"
                            ? { background: "var(--primary)" }
                            : {
                              background: "var(--color-muted)",
                              color: "var(--color-foreground)",
                            }
                        }
                      >
                        {msg.role === "assistant" ? formatAIText(msg.content) : msg.content}
                      </div>
                      {msg.role === "user" && (
                        <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                          <AvatarImage src={profileAvatar} alt="Profil Anda" />
                          <AvatarFallback className="text-[10px]">{profileInitial}</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}

                  {/* Streaming bubble */}
                  {streamingText && (
                    <div className="flex gap-2.5 justify-start">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div
                        className="max-w-[78%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed"
                        style={{ background: "var(--color-muted)", color: "var(--color-foreground)" }}
                      >
                        {formatAIText(streamingText)}
                        <span className="inline-block h-3.5 w-0.5 bg-current opacity-70 animate-pulse ml-0.5 align-middle" />
                      </div>
                    </div>
                  )}

                  {/* Loading dots (before first stream chunk) */}
                  {isLoading && !streamingText && (
                    <div className="flex gap-2.5 justify-start">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div
                        className="rounded-2xl rounded-tl-sm px-4 py-3"
                        style={{ background: "var(--color-muted)" }}
                      >
                        <div className="flex gap-1.5 items-center h-4">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div
                  className="shrink-0 p-3"
                  style={{ borderTop: "1px solid var(--color-border)" }}
                >
                  <div
                    className="flex items-end gap-2 rounded-xl px-3 py-2"
                    style={{ background: "var(--color-muted)", border: "1px solid var(--color-border)" }}
                  >
                    <textarea
                      ref={textareaRef}
                      id="ai-tutor-input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Tanya tentang Mandarin..."
                      disabled={isLoading}
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                      style={{ maxHeight: "120px" }}
                    />
                    <button
                      id="ai-tutor-send-button"
                      onClick={sendMessage}
                      disabled={!input.trim() || isLoading}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: input.trim() && !isLoading
                          ? "var(--primary)"
                          : "var(--color-border)",
                      }}
                      aria-label="Kirim pesan"
                    >
                      {isLoading
                        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        : <Send className="h-4 w-4 text-white" />
                      }
                    </button>
                  </div>
                  <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                    Shift+Enter untuk baris baru · AI bisa salah, verifikasi informasi penting
                  </p>
                </div>
              </>
            </div>
    </section>
  )
}
