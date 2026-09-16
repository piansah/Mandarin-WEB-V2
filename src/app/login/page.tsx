import { Metadata } from "next"
import { LoginClient } from "./login-client"

export const metadata: Metadata = {
  title: "Login - Journey Learning",
  description: "Masuk ke akun Anda",
}

export default function LoginPage() {
  return <LoginClient />
}