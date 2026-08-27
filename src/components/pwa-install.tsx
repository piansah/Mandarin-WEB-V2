"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Download, X } from "lucide-react"
import { usePwaInstall } from "@/hooks/use-pwa-install"

export function PWAInstall() {
  const { status, installing, installPwa } = usePwaInstall()
  const [dismissed, setDismissed] = React.useState(true)

  React.useEffect(() => {
    setDismissed(localStorage.getItem("pwa-install-dismissed") === "true")
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem("pwa-install-dismissed", "true")
  }

  if (dismissed || status !== "installable") return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Install Aplikasi</CardTitle>
              <CardDescription className="text-sm">
                Install Mandarin Journey untuk pengalaman belajar yang lebih baik
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Button onClick={installPwa} disabled={installing} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            {installing ? "Menginstall..." : "Install Sekarang"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
