"use client"

import * as React from "react"
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock3,
  FileWarning,
  Lightbulb,
  LoaderCircle,
  Search,
} from "lucide-react"
import { createClient } from "@/lib/supabase/browser"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Json } from "@/lib/database.types"

type ReportStatus = "open" | "in-progress" | "fixed" | "closed"
type ReportType = "bug" | "content" | "suggestion"

type BugReport = {
  id: number
  user_id: string | null
  title: string
  description: string
  detail: string | null
  reason: string | null
  device_info: Json | null
  status: string | null
  created_at: string | null
  report_type: string | null
  target_id: string | null
}

type StatusCount = Record<ReportStatus, number>

const PAGE_SIZE = 25
const REPORT_COLUMNS = "id,user_id,title,description,detail,reason,device_info,status,created_at,report_type,target_id"

const STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: "open", label: "Terbuka" },
  { value: "in-progress", label: "Sedang diproses" },
  { value: "fixed", label: "Selesai diperbaiki" },
  { value: "closed", label: "Ditutup" },
]

const TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "bug", label: "Bug aplikasi" },
  { value: "content", label: "Kesalahan konten" },
  { value: "suggestion", label: "Saran" },
]

const statusStyles: Record<ReportStatus, string> = {
  open: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  "in-progress": "border-sky-500/30 bg-sky-500/10 text-sky-300",
  fixed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  closed: "border-muted-foreground/30 bg-muted text-muted-foreground",
}

function isReportStatus(value: string | null): value is ReportStatus {
  return STATUS_OPTIONS.some((option) => option.value === value)
}

function getStatusLabel(value: string | null) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? "Status tidak dikenal"
}

function getTypeLabel(value: string | null) {
  return TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Laporan lain"
}

function getTypeIcon(value: string | null) {
  if (value === "content") return FileWarning
  if (value === "suggestion") return Lightbulb
  return Bug
}

function formatDate(value: string | null) {
  if (!value) return "Waktu tidak tersedia"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Waktu tidak tersedia"
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function safeSearchTerm(value: string) {
  return value.replace(/[%,()]/g, " ").replace(/\\/g, "").trim().slice(0, 100)
}

function isJsonObject(value: Json | null): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export default function AdminBugReportsPage() {
  const supabase = React.useMemo(() => createClient(), [])
  const [reports, setReports] = React.useState<BugReport[]>([])
  const [counts, setCounts] = React.useState<StatusCount>({
    open: 0,
    "in-progress": 0,
    fixed: 0,
    closed: 0,
  })
  const [allReportCount, setAllReportCount] = React.useState(0)
  const [reportCount, setReportCount] = React.useState(0)
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [typeFilter, setTypeFilter] = React.useState("all")
  const [page, setPage] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [updatingId, setUpdatingId] = React.useState<number | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [reporterNames, setReporterNames] = React.useState<Record<string, string>>({})
  const [expandedReports, setExpandedReports] = React.useState<Set<number>>(new Set())

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(0)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  React.useEffect(() => {
    let cancelled = false

    async function loadCounts() {
      const results = await Promise.all([
        supabase.from("bug_reports").select("id", { count: "exact", head: true }),
        ...STATUS_OPTIONS.map(({ value }) =>
          supabase
            .from("bug_reports")
            .select("id", { count: "exact", head: true })
            .eq("status", value)
        ),
      ])

      if (cancelled) return
      const firstError = results.find((result) => result.error)?.error
      if (firstError) {
        setErrorMessage(firstError.message)
        return
      }

      setCounts({
        open: results[1].count ?? 0,
        "in-progress": results[2].count ?? 0,
        fixed: results[3].count ?? 0,
        closed: results[4].count ?? 0,
      })
      setAllReportCount(results[0].count ?? 0)
    }

    void loadCounts()
    return () => {
      cancelled = true
    }
  }, [supabase])

  React.useEffect(() => {
    let cancelled = false

    async function loadReports() {
      setLoading(true)
      setErrorMessage(null)

      let query = supabase
        .from("bug_reports")
        .select(REPORT_COLUMNS, { count: "exact" })
        .order("created_at", { ascending: false })

      if (statusFilter !== "all" && isReportStatus(statusFilter)) {
        query = query.eq("status", statusFilter)
      }
      if (typeFilter !== "all" && TYPE_OPTIONS.some((option) => option.value === typeFilter)) {
        query = query.eq("report_type", typeFilter)
      }

      const term = safeSearchTerm(search)
      if (term) {
        const pattern = `%${term}%`
        query = query.or(
          `title.ilike.${pattern},description.ilike.${pattern},detail.ilike.${pattern},reason.ilike.${pattern},target_id.ilike.${pattern}`
        )
      }

      const from = page * PAGE_SIZE
      const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)

      if (cancelled) return
      if (error) {
        setErrorMessage(error.message)
        setReports([])
        setReportCount(0)
        setLoading(false)
        return
      }

      const nextReports = (data ?? []) as BugReport[]
      setReports(nextReports)
      setReportCount(count ?? 0)

      const userIds = Array.from(
        new Set(nextReports.map((report) => report.user_id).filter((id): id is string => Boolean(id)))
      )
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profile")
          .select("user_id,display_name")
          .in("user_id", userIds)

        if (!cancelled && profiles) {
          setReporterNames((current) => ({
            ...current,
            ...Object.fromEntries(
              profiles
                .filter((profile) => profile.display_name)
                .map((profile) => [profile.user_id, profile.display_name as string])
            ),
          }))
        }
      }

      if (!cancelled) setLoading(false)
    }

    void loadReports()
    return () => {
      cancelled = true
    }
  }, [page, search, statusFilter, supabase, typeFilter])

  async function updateStatus(reportId: number, nextStatus: ReportStatus) {
    setUpdatingId(reportId)
    setErrorMessage(null)

    const { data, error } = await supabase
      .from("bug_reports")
      .update({ status: nextStatus })
      .eq("id", reportId)
      .select("id")
      .maybeSingle()

    if (error || !data) {
      setErrorMessage(error?.message ?? "Status tidak berubah. Periksa izin akses tabel bug_reports.")
      setUpdatingId(null)
      return
    }

    setReports((current) =>
      current.map((report) => report.id === reportId ? { ...report, status: nextStatus } : report)
    )
    setCounts((current) => {
      const oldReport = reports.find((report) => report.id === reportId)
      const oldStatusValue = oldReport?.status ?? null
      const oldStatus = isReportStatus(oldStatusValue) ? oldStatusValue : null
      if (!oldStatus || oldStatus === nextStatus) return current
      const nextCounts: StatusCount = { ...current }
      nextCounts[oldStatus] = Math.max(0, nextCounts[oldStatus] - 1)
      nextCounts[nextStatus] += 1
      return nextCounts
    })
    setUpdatingId(null)
  }

  function toggleReportDetails(reportId: number) {
    setExpandedReports((current) => {
      const next = new Set(current)
      if (next.has(reportId)) next.delete(reportId)
      else next.add(reportId)
      return next
    })
  }

  const totalPages = Math.max(1, Math.ceil(reportCount / PAGE_SIZE))

  return (
    <main className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Laporan Pengguna</h1>
        </div>
        <p className="text-sm text-muted-foreground">Tinjau laporan bug, kesalahan konten, dan saran yang dikirim pengguna.</p>
      </header>

      <section aria-label="Ringkasan status laporan" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Card className="border-muted/50">
          <CardContent className="flex items-center gap-3 p-4">
            <ClipboardList className="h-5 w-5 text-primary" />
            <div><p className="text-xs text-muted-foreground">Total laporan</p><p className="text-xl font-semibold">{allReportCount}</p></div>
          </CardContent>
        </Card>
        {STATUS_OPTIONS.map(({ value, label }) => {
          const Icon = value === "open" ? AlertCircle : value === "in-progress" ? Clock3 : CheckCircle2
          return (
            <Card key={value} className="border-muted/50">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{counts[value]}</p></div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card/50 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Cari judul, isi laporan, alasan, atau ID konten..."
            className="h-10 pl-9"
            aria-label="Cari laporan pengguna"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => { if (value) { setStatusFilter(value); setPage(0) } }}>
          <SelectTrigger className="h-10 w-full sm:w-48"><SelectValue placeholder="Semua status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(value) => { if (value) { setTypeFilter(value); setPage(0) } }}>
          <SelectTrigger className="h-10 w-full sm:w-48"><SelectValue placeholder="Semua jenis" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua jenis</SelectItem>
            {TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      {errorMessage && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><p className="font-medium">Gagal memuat atau memperbarui laporan.</p><p className="mt-1 break-words text-destructive/80">{errorMessage}</p></div>
        </div>
      )}

      <section aria-label="Daftar laporan" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <h2 className="text-sm font-semibold">{loading ? "Memuat laporan…" : `${reportCount} laporan ditemukan`}</h2>
          <span className="text-xs text-muted-foreground">Terbaru ditampilkan lebih dulu</span>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center rounded-xl border bg-card/50 text-sm text-muted-foreground">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Memuat laporan…
          </div>
        ) : reports.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed bg-card/30 px-4 text-center">
            <ClipboardList className="mb-2 h-8 w-8 text-muted-foreground/60" />
            <p className="font-medium">Belum ada laporan yang cocok</p>
            <p className="mt-1 text-sm text-muted-foreground">Coba ubah kata pencarian atau filter.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card/50">
            <Table className="min-w-[1050px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead className="w-44">Jenis</TableHead>
                  <TableHead>Laporan</TableHead>
                  <TableHead className="w-44">Pelapor</TableHead>
                  <TableHead className="w-52">Status</TableHead>
                  <TableHead className="w-44">Tanggal</TableHead>
                  <TableHead className="w-32 text-right">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => {
                  const TypeIcon = getTypeIcon(report.report_type)
                  const status = isReportStatus(report.status) ? report.status : "open"
                  const deviceInfo = isJsonObject(report.device_info) ? report.device_info : null
                  const reporter = report.user_id
                    ? reporterNames[report.user_id] ?? `Pengguna ${report.user_id.slice(0, 8)}`
                    : "Pengguna dihapus"
                  const isExpanded = expandedReports.has(report.id)

                  return (
                    <React.Fragment key={report.id}>
                      <TableRow>
                        <TableCell className="font-medium text-muted-foreground">#{report.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1.5 whitespace-nowrap">
                            <TypeIcon className="h-3.5 w-3.5" />{getTypeLabel(report.report_type)}
                          </Badge>
                      </TableCell>
                      <TableCell className="max-w-[420px]">
                        <p className="truncate font-medium" title={report.title}>{report.title}</p>
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{report.description}</p>
                        {report.target_id && <p className="mt-1 text-xs text-muted-foreground">ID konten: {report.target_id}</p>}
                      </TableCell>
                      <TableCell className="max-w-44 truncate text-sm" title={reporter}>{reporter}</TableCell>
                      <TableCell>
                        <Select
                          value={status}
                          onValueChange={(value) => { if (value && isReportStatus(value)) void updateStatus(report.id, value) }}
                          disabled={updatingId === report.id}
                        >
                          <SelectTrigger aria-label={`Ubah status laporan ${report.id}`} className="h-9">
                            {updatingId === report.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SelectValue />}
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(report.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-expanded={isExpanded}
                          onClick={() => toggleReportDetails(report.id)}
                        >
                          {isExpanded ? "Tutup" : "Lihat"}
                          {isExpanded ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
                        </Button>
                      </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/20">
                            <div className="grid gap-4 py-1 text-sm sm:grid-cols-2">
                              <div>
                                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deskripsi</h4>
                                <p className="whitespace-pre-wrap break-words">{report.description}</p>
                              </div>
                              {report.reason && <div><h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alasan</h4><p className="whitespace-pre-wrap break-words">{report.reason}</p></div>}
                              {report.detail && <div><h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail tambahan</h4><p className="whitespace-pre-wrap break-words">{report.detail}</p></div>}
                              {deviceInfo && <div className="sm:col-span-2"><h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informasi perangkat</h4><pre className="max-h-48 overflow-auto rounded-lg bg-background/70 p-3 text-xs whitespace-pre-wrap break-words">{JSON.stringify(deviceInfo, null, 2)}</pre></div>}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {!loading && reportCount > PAGE_SIZE && (
        <nav aria-label="Halaman laporan" className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Halaman {page + 1} dari {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Sebelumnya
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}>
              Berikutnya <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </nav>
      )}
    </main>
  )
}
