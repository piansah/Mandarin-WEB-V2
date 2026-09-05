"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Database, Table, FileText, Settings, BookOpen, List, Layers } from "lucide-react"

export default function AdminDatabasePage() {
  const router = useRouter()

  const databaseSections = [
    {
      title: "Flashcard Sets",
      description: "Kelola deck flashcard",
      icon: Table,
      table: "flashcard_sets",
      count: 0,
    },
    {
      title: "Flashcard Cards",
      description: "Kelola kartu vocabulary",
      icon: FileText,
      table: "flashcard_cards",
      count: 0,
    },
    {
      title: "Deck Tata Bahasa",
      description: "Kelola deck grammar patterns",
      icon: BookOpen,
      table: "grammar_decks",
      count: 0,
    },
    {
      title: "Pola Tata Bahasa",
      description: "Kelola pola grammar",
      icon: Layers,
      table: "grammar_patterns",
      count: 0,
    },
    {
      title: "Deck Estafet",
      description: "Kelola deck relay/stafet",
      icon: Table,
      table: "relay_decks",
      count: 0,
    },
    {
      title: "Daftar Estafet",
      description: "Kelola list relay/stafet",
      icon: List,
      table: "relay_cards",
      count: 0,
    },
    {
      title: "User Progress",
      description: "Kelola progress user",
      icon: Settings,
      table: "user_card_progress",
      count: 0,
    },
    {
      title: "User Scores",
      description: "Kelola skor user",
      icon: Table,
      table: "user_scores",
      count: 0,
    },
  ]

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Database Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">Kelola data dan konten aplikasi</p>
        </div>
      </div>

      {/* Database Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {databaseSections.map((section, index) => {
          const Icon = section.icon
          return (
            <Card key={`${section.title}-${index}`} className="border-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{section.count} records</span>
                  <Button size="sm" variant="outline">
                    Kelola
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Info Card */}
      <Card className="border-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Informasi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Fitur database management akan dikembangkan lebih lanjut. 
            Untuk saat ini, Anda dapat mengelola database langsung melalui Supabase Dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
