"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isHanChar, extractFirstHan } from "@/lib/hanzi-map"

type HanziSearchBarProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: (char: string) => void
  loading?: boolean
}

const QUICK_PICKS = ["学", "人", "大", "中"]

export function HanziSearchBar({ value, onChange, onSubmit, loading }: HanziSearchBarProps) {
  const [hint, setHint] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const isLoading = loading === true

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setHint(null)
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return

    if (!isHanChar(value)) {
      setError("Masukkan satu karakter Hanzi")
      return
    }

    const firstHan = extractFirstHan(value)
    if (!firstHan) {
      setError("Masukkan satu karakter Hanzi")
      return
    }

    if (value.length > 1 && isHanChar(value)) {
      setHint("Hanya 1 karakter yang dipakai")
    }

    onSubmit(firstHan)
  }

  const handleQuickPick = (char: string) => {
    onChange(char)
    onSubmit(char)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Masukkan satu karakter Hanzi..."
          value={value}
          onChange={handleChange}
          maxLength={10}
          className="pl-9 pr-24"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2"
          disabled={isLoading || !value.trim()}
        >
          {isLoading ? "..." : "Cari"}
        </Button>
      </form>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {hint && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground">Coba:</span>
        {QUICK_PICKS.map((char) => (
          <Button
            key={char}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleQuickPick(char)}
            disabled={loading === true}
            className="font-hanzi"
          >
            {char}
          </Button>
        ))}
      </div>
    </div>
  )
}
