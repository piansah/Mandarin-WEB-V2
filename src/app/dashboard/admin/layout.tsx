"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { isAdmin } from "@/lib/auth-roles"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function checkAuth() {
      try {
        const adminStatus = await isAdmin()
        setIsAuthorized(adminStatus)
      } catch (error) {
        console.error("Error checking admin status:", error)
        setIsAuthorized(false)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  // Redirect to dashboard if not authorized (must be in useEffect to avoid render-phase state update)
  React.useEffect(() => {
    if (!loading && !isAuthorized) {
      router.push("/dashboard")
    }
  }, [loading, isAuthorized, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
