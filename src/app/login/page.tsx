import { Metadata } from "next"
import { LoginForm } from "@/components/login-form"

export const metadata: Metadata = {
  title: "Login - Journey Learning",
  description: "Masuk ke akun Anda",
}

export default function LoginPage() {
  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0 bg-background">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-primary/90" />
        <div className="relative z-20 flex items-center text-lg font-medium gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30">
            <span className="text-white font-bold text-sm">JL</span>
          </div>
          Journey Learning
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-xl font-medium leading-relaxed">
              &ldquo;Belajar bahasa baru bukan hanya mempelajari kata-kata berbeda untuk hal yang sama, tetapi belajar cara lain memikirkan hal-hal tersebut.&rdquo;
            </p>
            <footer className="text-sm text-white/80">Flora Lewis</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8 p-4 flex items-center justify-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Masuk ke Akun
            </h1>
            <p className="text-sm text-muted-foreground">
              Gunakan akun Google Anda untuk melanjutkan belajar
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
