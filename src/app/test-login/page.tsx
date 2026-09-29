"use client"

import { useState } from "react"
import { useSupabase } from "@/hooks/use-supabase"

export default function TestLogin() {
  const supabase = useSupabase()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Halaman ini HANYA boleh diakses jika flag test mode menyala
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") {
    return <div>Not Found</div>
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      alert("Error: " + error.message)
    } else {
      window.location.href = "/dashboard"
    }
  }

  return (
    <div style={{ padding: 50 }}>
      <h1>Test Login (E2E Only)</h1>
      <form onSubmit={handleLogin} id="test-login-form">
        <div>
          <label>Email</label>
          <input 
            type="email" 
            id="test-email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
          />
        </div>
        <div>
          <label>Password</label>
          <input 
            type="password" 
            id="test-password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
        </div>
        <button type="submit" id="test-submit">Login</button>
      </form>
    </div>
  )
}
