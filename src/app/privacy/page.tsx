import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Kebijakan Privasi - Journey Learning",
  description: "Kebijakan Privasi penggunaan aplikasi Journey Learning.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#05070A] text-[#9AA7B5] py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 mt-4">Kebijakan Privasi</h1>
        
        <div className="space-y-8 prose prose-invert max-w-none">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Informasi yang Kami Kumpulkan</h2>
            <p className="leading-relaxed mb-3">
              Journey Learning hanya mengumpulkan informasi yang diperlukan untuk memberikan pengalaman belajar terbaik bagi kamu. Saat kamu menggunakan aplikasi kami, kami dapat mengumpulkan:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Informasi Profil Akun:</strong> Nama, alamat email, dan foto profil (diperoleh melalui autentikasi Google).</li>
              <li><strong>Data Pembelajaran:</strong> Progres belajar, riwayat flashcard (kartu yang diingat/lupa), statistik streak, dan preferensi akun kamu.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Penggunaan Informasi</h2>
            <p className="leading-relaxed mb-3">
              Informasi yang kami kumpulkan digunakan semata-mata untuk:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Menyediakan, memelihara, dan meningkatkan kualitas aplikasi pembelajaran.</li>
              <li>Menyesuaikan algoritma <em>spaced repetition</em> dengan histori belajar kamu sehingga kartu yang muncul akurat.</li>
              <li>Menyimpan progres harian (streak) dan pengalaman yang dipersonalisasi.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Keamanan Data</h2>
            <p className="leading-relaxed">
              Kami mengambil langkah-langkah keamanan yang wajar untuk melindungi informasi kamu dari akses, perubahan, pengungkapan, atau penghancuran yang tidak sah. Data otentikasi ditangani dengan aman, dan sandi/kredensial Google kamu tidak pernah disimpan di server kami secara langsung (menggunakan sistem OAuth yang aman).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Berbagi Informasi Pihak Ketiga</h2>
            <p className="leading-relaxed">
              Kami <strong>tidak menjual, memperdagangkan, atau menyewakan</strong> informasi identitas pribadi kamu kepada pihak ketiga. Kami hanya dapat membagikan data anonim secara agregat untuk keperluan analitik demi meningkatkan layanan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Hak Akses dan Penghapusan</h2>
            <p className="leading-relaxed">
              Kamu berhak mengakses, memperbaiki, atau meminta penghapusan data pribadi kamu kapan saja. Jika kamu ingin menghapus akun dan seluruh progres pembelajaran, kamu dapat melakukannya melalui menu Pengaturan di dalam aplikasi.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Perubahan Kebijakan</h2>
            <p className="leading-relaxed">
              Kebijakan Privasi ini dapat diperbarui dari waktu ke waktu. Kami menyarankan kamu untuk meninjau halaman ini secara berkala untuk mengetahui perubahan apa pun. Penggunaan aplikasi ini menunjukkan bahwa kamu setuju dengan kebijakan yang berlaku.
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
