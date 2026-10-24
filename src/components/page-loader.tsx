"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

function Block({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-muted/45", className)} />
}

function PageFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-label="Memuat halaman" className={cn("w-full min-h-[calc(100dvh-4rem)] p-4 md:p-6", className)}>
      <span className="sr-only">Memuat halaman</span>
      {children}
    </div>
  )
}

function Heading({ compact = false }: { compact?: boolean }) {
  return (
    <div className="mb-6 space-y-2">
      <Block className={cn("h-7", compact ? "w-40" : "w-52")} />
      <Block className="h-4 w-64 max-w-full rounded-md bg-muted/30" />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="mb-2 space-y-2">
        <div className="flex items-center gap-2">
          <Block className="h-5 w-5 rounded-full" />
          <Block className="h-4 w-28 rounded-md" />
        </div>
        <Block className="h-9 w-72 max-w-full rounded-md" />
        <Block className="h-5 w-96 max-w-full rounded-md bg-muted/30" />
        <div className="flex gap-2 pt-1">
          <Block className="h-5 w-28 rounded-full" />
          <Block className="h-5 w-16 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[6fr_4fr]">
        <Block className="h-[15.8rem] rounded-2xl" />
        <Block className="h-[15.8rem] rounded-2xl" />
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/20 p-4 sm:p-6">
        <div className="mb-6 flex items-center gap-3 border-b border-border/40 pb-5">
          <Block className="h-9 w-9 rounded-xl" />
          <div className="space-y-2">
            <Block className="h-5 w-36 rounded-md" />
            <Block className="h-3.5 w-48 max-w-full rounded-md bg-muted/30" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex h-[4.6rem] items-center gap-4 rounded-xl border border-border/40 bg-card/30 px-4">
              <Block className="h-8 w-8 shrink-0 rounded-lg" />
              <div className="space-y-2">
                <Block className="h-4 w-52 max-w-[55vw] rounded-md" />
                <Block className="h-3 w-64 max-w-[65vw] rounded-md bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
        <Block className="mt-8 h-[3.4rem] w-full rounded-full" />
        <div className="mt-5 space-y-2">
          <Block className="mx-auto h-3 w-64 max-w-full rounded-md bg-muted/30" />
          <Block className="mx-auto h-3 w-72 max-w-full rounded-md bg-muted/30" />
        </div>
      </div>
    </div>
  )
}

function AdminDashboardSkeleton() {
  return (
    <>
      <Heading />
      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Block className="h-28 rounded-2xl" />
        <Block className="h-28 rounded-2xl" />
        <Block className="h-28 rounded-2xl" />
        <Block className="h-28 rounded-2xl" />
      </div>
      <Block className="h-28 rounded-2xl" />
    </>
  )
}

function StatisticsSkeleton() {
  return (
    <>
      <Heading />
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Block className="h-80 rounded-2xl" />
        <Block className="h-80 rounded-2xl" />
        <Block className="h-64 rounded-2xl xl:col-span-2" />
      </div>
    </>
  )
}

function ProfileSkeleton() {
  return (
    <>
      <div className="mx-auto mb-5 h-56 max-w-4xl rounded-3xl border border-border/40 bg-card/30 p-6">
        <div className="flex h-full flex-col items-center justify-center gap-3 md:flex-row md:justify-start">
          <Block className="h-24 w-24 shrink-0 rounded-full" />
          <div className="space-y-3 text-center md:text-left">
            <Block className="mx-auto h-6 w-44 md:mx-0" />
            <Block className="mx-auto h-4 w-56 max-w-full md:mx-0" />
            <Block className="mx-auto h-3 w-32 md:mx-0" />
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
        <Block className="h-40 rounded-2xl" />
        <Block className="h-40 rounded-2xl" />
      </div>
    </>
  )
}

function FlashcardSessionSkeleton() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-5xl flex-col">
      <div className="mb-4 border-b border-border/40 px-1 pb-4">
        <Block className="mb-2 h-6 w-52" />
        <Block className="h-4 w-32" />
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-14 rounded-xl" />)}
        </div>
      </div>
      <Block className="mb-4 h-2 w-full rounded-full" />
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <Block className="h-[min(48vh,26rem)] w-full max-w-3xl rounded-3xl" />
        <div className="grid w-full max-w-3xl grid-cols-3 gap-2">
          {Array.from({ length: 3 }, (_, i) => <Block key={i} className="h-11 rounded-xl" />)}
        </div>
        <div className="grid w-full max-w-3xl grid-cols-4 gap-2">
          {Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-14 rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}

function EstafetSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl pb-20">
      <div className="mb-5 border-b border-border/40 pb-4">
        <div className="mb-2 flex items-center justify-between"><Block className="h-6 w-44" /><Block className="h-5 w-14" /></div>
        <Block className="mb-3 h-4 w-32" />
        <Block className="h-2 w-full rounded-full" />
      </div>
      <Block className="mb-6 h-28 rounded-2xl" />
      <Block className="mb-3 h-5 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-border/40 bg-card/30 p-5">
            <Block className="mb-4 h-7 w-3/4" />
            <Block className="mb-3 h-4 w-1/2" />
            <Block className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-border/40 bg-background/90 p-3 backdrop-blur md:static md:mt-5 md:border-0 md:bg-transparent md:p-0">
        <Block className="mx-auto h-11 w-full max-w-5xl rounded-xl" />
      </div>
    </div>
  )
}

function DeckGridSkeleton() {
  return (
    <>
      <Heading />
      <div className="mb-5 flex gap-2">
        <Block className="h-10 w-36 rounded-xl" />
        <Block className="h-10 w-40 rounded-xl" />
      </div>
      <div className="mb-5 flex items-center justify-between">
        <Block className="h-5 w-44" />
        <Block className="h-9 w-24 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-border/40 bg-card/30 p-5">
            <div className="mb-8 flex justify-between"><Block className="h-5 w-14 rounded-full" /><Block className="h-5 w-12 rounded-full" /></div>
            <Block className="mb-2 h-5 w-3/4" />
            <Block className="mb-6 h-4 w-1/2" />
            <Block className="h-8 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </>
  )
}

function DeckDetailSkeleton() {
  return (
    <>
      <Heading compact />
      <Block className="mb-5 h-36 rounded-2xl" />
      <div className="mb-4 flex items-center justify-between">
        <Block className="h-5 w-40" />
        <Block className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => <Block key={i} className="h-24 rounded-xl" />)}
      </div>
    </>
  )
}

function ContentDetailSkeleton() {
  return (
    <>
      <Heading compact />
      <Block className="mb-5 h-40 rounded-2xl md:h-52" />
      <Block className="mb-3 h-5 w-48" />
      <Block className="mb-6 h-4 w-3/4 max-w-full rounded-md bg-muted/30" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-20 rounded-xl" />)}
      </div>
    </>
  )
}

function WordDetailSkeleton() {
  return (
    <>
      <Heading compact />
      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Block className="h-64 rounded-3xl" />
        <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
          <Block className="mb-5 h-7 w-2/3" />
          <Block className="mb-3 h-4 w-1/2" />
          <Block className="mb-6 h-4 w-3/4" />
          <Block className="h-10 w-full rounded-lg" />
        </div>
      </div>
      <div className="mb-4 flex gap-2">{Array.from({ length: 3 }, (_, i) => <Block key={i} className="h-9 w-28 rounded-full" />)}</div>
      <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Block key={i} className="h-24 rounded-xl" />)}</div>
    </>
  )
}

function ContentListSkeleton() {
  return (
    <>
      <Heading />
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-9 w-24 rounded-full" />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-border/40 bg-card/30 p-4">
            <Block className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2"><Block className="h-5 w-2/3" /><Block className="h-4 w-1/3" /></div>
            <Block className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </>
  )
}

function TableSkeleton() {
  return (
    <>
      <Heading />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Block className="h-10 w-64 max-w-full rounded-lg" />
        <Block className="h-10 w-32 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/40">
        <Block className="h-12 rounded-none" />
        {Array.from({ length: 8 }, (_, i) => <Block key={i} className="h-14 rounded-none border-t border-border/30" />)}
      </div>
    </>
  )
}

function PracticeSkeleton() {
  return (
    <>
      <Heading compact />
      <div className="mx-auto w-full max-w-4xl">
        <Block className="mb-4 h-2 w-full rounded-full" />
        <Block className="mb-5 h-56 rounded-2xl md:h-64" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => <Block key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    </>
  )
}

function SettingsSkeleton() {
  return (
    <>
      <Heading />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Block key={i} className="h-10 rounded-lg" />)}</div>
        <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
          <Block className="mb-6 h-6 w-48" />
          <div className="space-y-5">{Array.from({ length: 4 }, (_, i) => <div key={i}><Block className="mb-2 h-4 w-28" /><Block className="h-10 w-full rounded-lg" /></div>)}</div>
        </div>
      </div>
    </>
  )
}

function resolveSkeleton(pathname: string) {
  if (pathname === "/dashboard") return <DashboardSkeleton />
  if (pathname.startsWith("/dashboard/statistik")) return <StatisticsSkeleton />
  if (pathname.startsWith("/dashboard/profile")) return <ProfileSkeleton />
  if (pathname === "/dashboard/admin/database") return <ContentListSkeleton />
  if (pathname.startsWith("/dashboard/admin/users") || pathname.startsWith("/dashboard/admin/bug-reports") || pathname.startsWith("/dashboard/admin/database")) return <TableSkeleton />
  if (pathname.startsWith("/dashboard/admin")) return <AdminDashboardSkeleton />
  if (pathname.startsWith("/dashboard/settings")) return <SettingsSkeleton />
  if (pathname.includes("/flashcard/cumulative/") && pathname.endsWith("/speaking")) return <PracticeSkeleton />
  if (pathname.includes("/flashcard/cumulative/")) return <EstafetSkeleton />
  if (pathname.startsWith("/dashboard/review") || pathname.includes("/practice/flashcard/")) return <FlashcardSessionSkeleton />
  if (pathname.includes("/flashcard/") && pathname.includes("/word/")) return <WordDetailSkeleton />
  if (pathname.startsWith("/dashboard/personal-cards/") && pathname.split("/").filter(Boolean).length >= 4) return <DeckDetailSkeleton />
  if (pathname === "/dashboard/flashcard" || pathname === "/dashboard/personal-cards" || pathname.startsWith("/dashboard/personal-cards/") || pathname === "/dashboard/favorit" || pathname === "/dashboard/flashcard/cumulative") return <DeckGridSkeleton />
  if (pathname.startsWith("/dashboard/flashcard/")) return <DeckDetailSkeleton />
  if (pathname.startsWith("/dashboard/modul/") || pathname.startsWith("/dashboard/cerita/")) return <ContentDetailSkeleton />
  if (pathname.startsWith("/dashboard/modul") || pathname.startsWith("/dashboard/grammar") || pathname.startsWith("/dashboard/cerita") || pathname.startsWith("/dashboard/games") || pathname.startsWith("/dashboard/path") || pathname.startsWith("/dashboard/peta-hanzi")) return <ContentListSkeleton />
  if (pathname.startsWith("/dashboard/practice/") || pathname.startsWith("/dashboard/simulasi-hsk") || pathname.startsWith("/dashboard/quiz")) return <PracticeSkeleton />
  return <ContentListSkeleton />
}

export function PageLoader({ className }: { className?: string }) {
  const pathname = usePathname() ?? "/dashboard"
  return <PageFrame className={className}>{resolveSkeleton(pathname)}</PageFrame>
}

export function FullscreenLoader() {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-background">
      <PageLoader className="min-h-screen" />
    </div>
  )
}
