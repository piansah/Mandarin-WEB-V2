"use client"

import { useState } from "react"
import { LoginForm } from "@/components/login-form"
import { FlashcardShowcase } from "@/components/flashcard-showcase"

export function LoginClient() {
  const [showLoginOnMobile, setShowLoginOnMobile] = useState(false)

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-[#05070A]">
      {/* LEFT — flashcard showcase */}
      <div
        className={`${
          showLoginOnMobile ? "hidden lg:flex" : "flex"
        } relative flex-col overflow-hidden p-11 lg:border-r lg:border-white/10 min-h-screen lg:min-h-0`}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 60% at 15% 0%, rgba(23,166,115,0.16), transparent 55%), radial-gradient(80% 50% at 100% 100%, rgba(23,166,115,0.08), transparent 55%), #070B0E",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
          style={{
            fontFamily: "'Noto Serif SC', serif",
            fontSize: 240,
            letterSpacing: 24,
            color: "rgba(255,255,255,0.025)",
            transform: "rotate(-6deg) translateY(10%)",
          }}
        >
          木 学 中
        </div>

        <div className="relative z-10 hidden lg:flex items-center gap-2.5 font-bold text-[16px] text-white">
          <div
            className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center"
            style={{ background: "linear-gradient(160deg, #1CBF85, #0E8A5E)" }}
          >
            <span style={{ fontFamily: "'Noto Serif SC', serif" }} className="text-[15px] text-white">
              木
            </span>
          </div>
          Journey Learning
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center pt-8 lg:pt-0">
          <FlashcardShowcase />
          
          <button
            onClick={() => setShowLoginOnMobile(true)}
            className="mt-12 lg:hidden w-full max-w-[320px] h-12 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Lanjutkan
          </button>
        </div>

        <p className="relative z-10 mt-7 text-sm text-[#9AA7B5] max-w-[320px] leading-relaxed hidden lg:block">
          <b className="text-white">Latihan flashcard harian</b> — setiap kartu dijadwalkan ulang
          otomatis pakai spaced repetition, sesuai seberapa mudah kamu mengingatnya.
        </p>
      </div>

      {/* RIGHT — login */}
      <div
        className={`${
          !showLoginOnMobile ? "hidden lg:flex" : "flex"
        } items-center justify-center p-5 min-h-screen lg:min-h-0 relative`}
      >
        <div className="w-full max-w-[350px] flex flex-col gap-[22px]">
          <div className="flex flex-col items-center text-center gap-3">
            <div
              className="w-16 h-16 rounded-[18px] flex items-center justify-center"
              style={{
                background: "linear-gradient(160deg, #1CBF85, #0E8A5E)",
                boxShadow: "0 12px 28px -10px rgba(23,166,115,0.55)",
              }}
            >
              <span
                className="text-[32px] font-semibold text-[#F7FBF9]"
                style={{ fontFamily: "'Noto Serif SC', serif" }}
              >
                木
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">Journey Learning</h1>
            <p className="text-sm text-[#9AA7B5] max-w-[240px] leading-relaxed">
              Perjalananmu dalam belajar Mandarin, satu aksara setiap hari.
            </p>
          </div>

          <div className="flex gap-2.5 justify-center">
            {["你", "好", "吗"].map((c, i) => (
              <div
                key={c}
                className={`w-11 h-11 rounded-xl border flex items-center justify-center text-[21px] ${
                  i === 1
                    ? "bg-[#123328] border-[#17A673]/40 text-[#4FDDA5]"
                    : "bg-[#10161D] border-white/10 text-[#9AA7B5]"
                }`}
                style={{ fontFamily: "'Noto Serif SC', serif" }}
              >
                {c}
              </div>
            ))}
          </div>

          <div className="bg-[#141B24] border border-white/10 rounded-[22px] p-[22px] flex flex-col gap-[15px]">
            <div>
              <h2 className="text-[16.5px] font-bold text-white mb-1">Masuk untuk lanjut belajar</h2>
              <p className="text-[13.5px] text-[#9AA7B5] leading-relaxed">
                Progress dan streak-mu tersimpan otomatis lewat akun Google.
              </p>
            </div>

            <LoginForm />

            <div className="flex items-center justify-center gap-1.5 text-xs text-[#5D6B7A]">
              🔒 Data kamu aman &amp; privat
            </div>
          </div>

          <p className="text-center text-[11.5px] text-[#5D6B7A] leading-relaxed">
            Dengan masuk, kamu menyetujui{" "}
            <a href="/terms" className="text-[#9AA7B5] underline underline-offset-2">Ketentuan Layanan</a>{" "}
            dan{" "}
            <a href="/privacy" className="text-[#9AA7B5] underline underline-offset-2">Kebijakan Privasi</a>{" "}
            kami.
          </p>
        </div>
      </div>
    </div>
  )
}
