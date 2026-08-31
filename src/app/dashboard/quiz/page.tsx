import { redirect } from "next/navigation"

// "Quiz Harian" sudah tidak lagi punya daftar terpisah — sekarang jadi salah
// satu opsi ("Quiz") di dalam modal "Pilih Latihan" pada tiap deck di
// Daftar Kata (flashcard-nya harus selesai dulu baru Quiz kebuka). Route ini
// dipertahankan sebagai redirect saja supaya bookmark/link lama tidak 404.
export default function QuizHarianRedirectPage() {
  redirect("/dashboard/flashcard")
}
