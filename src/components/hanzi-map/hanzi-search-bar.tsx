"use client"

import * as React from "react"
import { Search, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isHanChar, extractFirstHan } from "@/lib/hanzi-map"

type HanziSearchBarProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: (char: string) => void
  onRandom: () => void
  loading?: boolean
}

export function HanziSearchBar({ value, onChange, onSubmit, onRandom, loading }: HanziSearchBarProps) {
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

  const handleRandom = () => {
    setHint(null)
    setError(null)
    onRandom()
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <form onSubmit={handleSubmit} className="relative flex-1 min-w-0">
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
            disabled={isLoading}
          >
            {isLoading ? "..." : "Cari"}
          </Button>
        </form>

        <Button
          type="button"
          variant="outline"
          onClick={handleRandom}
          disabled={isLoading}
          aria-label="Karakter acak"
          title="Karakter acak"
          className="shrink-0"
        >
          <Shuffle className="h-4 w-4" />
          <span className="hidden sm:inline ml-2">Karakter Acak</span>
        </Button>
      </div>

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      {hint && <p className="text-sm text-muted-foreground mt-2">{hint}</p>}
    </div>
  )
}