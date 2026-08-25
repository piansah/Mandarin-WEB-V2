const STORAGE_KEY = "cerita_progress"

export type CeritaProgressMap = Record<string, number>

export function getCeritaProgress(): CeritaProgressMap {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as CeritaProgressMap
  } catch {
    return {}
  }
}

export function setCeritaProgress(key: string, pct: number) {
  if (typeof window === "undefined") return
  const current = getCeritaProgress()
  current[key] = pct
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
}

export function clearCeritaProgress(key: string) {
  if (typeof window === "undefined") return
  const current = getCeritaProgress()
  delete current[key]
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
}
