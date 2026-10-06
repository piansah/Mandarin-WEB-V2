import { redirect } from "next/navigation"

// "Quiz Kumulatif" sudah tidak lagi punya daftar terpisah — sekarang jadi
// salah satu opsi ("Quiz Kalimat") di dalam modal "Pilih Latihan" pada tiap
// set di Estafet (menggunakan hanzi_sets yang sama). Route ini dipertahankan
// sebagai redirect saja supaya bookmark/link lama tidak 404.
export default function QuizKumulatifRedirectPage() {
  redirect("/dashboard/flashcard/cumulative")
}
