import { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Ketentuan Layanan - Journey Learning",
  description: "Ketentuan Layanan penggunaan aplikasi Journey Learning.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#05070A] text-[#9AA7B5] py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 mt-4">Ketentuan Layanan</h1>
        
        <div className="space-y-8 prose prose-invert max-w-none">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Penerimaan Ketentuan</h2>
            <p className="leading-relaxed">
              Dengan mengakses dan menggunakan aplikasi Journey Learning, Anda menyetujui untuk terikat oleh Ketentuan Layanan ini. Jika Anda tidak setuju dengan ketentuan apa pun, Anda dilarang menggunakan atau mengakses aplikasi ini.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Penggunaan Layanan</h2>
            <p className="leading-relaxed mb-3">
              Journey Learning menyediakan platform pembelajaran bahasa Mandarin menggunakan sistem flashcard dan pengulangan berkala (spaced repetition).
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Anda setuju untuk menggunakan layanan ini hanya untuk tujuan pembelajaran pribadi dan non-komersial.</li>
              <li>Anda bertanggung jawab atas menjaga kerahasiaan akun login Google Anda yang tertaut dengan layanan ini.</li>
              <li>Anda tidak diperbolehkan menggunakan layanan ini untuk tindakan yang melanggar hukum atau mengganggu server kami.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Konten Pengguna</h2>
            <p className="leading-relaxed">
              Anda mungkin dapat menambahkan flashcard, catatan, atau konten pribadi lainnya. Anda bertanggung jawab penuh atas konten yang Anda buat. Journey Learning berhak menghapus konten yang dianggap melanggar norma atau ketentuan tanpa pemberitahuan sebelumnya.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Ketersediaan Layanan</h2>
            <p className="leading-relaxed">
              Kami berusaha semaksimal mungkin untuk memastikan layanan berjalan dengan baik. Namun, kami tidak menjamin bahwa layanan tidak akan terganggu, aman dari celah, atau bebas dari kesalahan. Layanan dapat ditangguhkan sementara untuk pemeliharaan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Perubahan Ketentuan</h2>
            <p className="leading-relaxed">
              Journey Learning berhak memperbarui atau mengubah Ketentuan Layanan ini kapan saja. Perubahan akan berlaku segera setelah dipublikasikan di halaman ini. Penggunaan berkelanjutan Anda atas aplikasi ini setelah perubahan merupakan persetujuan Anda terhadap ketentuan yang baru.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Hubungi Kami</h2>
            <p className="leading-relaxed">
              Jika Anda memiliki pertanyaan tentang Ketentuan Layanan ini, silakan hubungi tim dukungan kami melalui fitur pelaporan bug atau hubungi administrator Journey Learning.
            </p>
          </section>
        </div>
        
        <div className="mt-12 pt-8 border-t border-white/10 text-sm text-center">
          Terakhir diperbarui: {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
    </div>
  )
}
