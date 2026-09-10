"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Database, Table, FileText, Settings, BookOpen, List, Layers, Book, Flag, ClipboardCheck, ChevronDown, ChevronUp, MessageSquare } from "lucide-react"
import { createClient } from "@/lib/supabase/browser"

export default function AdminDatabasePage() {
  const router = useRouter()
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set(["daftar-kata"]))
  const [loading, setLoading] = React.useState(true)
  const [recordCounts, setRecordCounts] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    async function fetchRecordCounts() {
      try {
        const supa = createClient()
        
        const tables = [
          "flashcard_sets",
          "flashcard_cards", 
          "word_compounds",
          "word_examples",
          "cerita_vocab",
          "grammar_patterns",
          "grammar_questions",
          "hanzi_sets",
          "hanzi_items"
        ]

        const counts: Record<string, number> = {}
        
        for (const table of tables) {
          try {
            const { count, error } = await supa
              .from(table)
              .select("*", { count: "exact", head: true })
            
            if (!error && count !== null) {
              counts[table] = count
            } else {
              counts[table] = 0
            }
          } catch (err) {
            console.error(`Error fetching count for ${table}:`, err)
            counts[table] = 0
          }
        }

        setRecordCounts(counts)
      } catch (error) {
        console.error("Error fetching record counts:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecordCounts()
  }, [])

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const handleManage = (table: string) => {
    // Arahkan ke halaman CRUD yang sesuai
    switch (table) {
      case "flashcard_sets":
        router.push("/dashboard/admin/database/flashcard-sets")
        break
      case "flashcard_cards":
        router.push("/dashboard/admin/database/flashcard-cards")
        break
      case "word_compounds":
        router.push("/dashboard/admin/database/word-compounds")
        break
      case "word_examples":
        router.push("/dashboard/admin/database/word-examples")
        break
      case "grammar_patterns":
        router.push("/dashboard/admin/database/grammar-patterns")
        break
      case "grammar_questions":
        router.push("/dashboard/admin/database/grammar-questions")
        break
      case "hanzi_sets":
        router.push("/dashboard/admin/database/hanzi-sets")
        break
      case "hanzi_items":
        router.push("/dashboard/admin/database/hanzi-items")
        break
      default:
        alert("CRUD untuk table ini belum tersedia")
    }
  }

  const managementCategories = [
    {
      id: "modul",
      title: "Modul",
      description: "Kelola modul pembelajaran",
      icon: Book,
      color: "bg-blue-500",
      sections: [
        {
          title: "Modul Sets",
          description: "Kelola deck modul",
          icon: Table,
          table: "modul_sets",
          count: 0,
        },
        {
          title: "Modul Content",
          description: "Kelola konten modul",
          icon: FileText,
          table: "modul_content",
          count: 0,
        },
      ]
    },
    {
      id: "daftar-kata",
      title: "Daftar Kata",
      description: "Kelola vocabulary dan flashcard",
      icon: BookOpen,
      color: "bg-emerald-500",
      sections: [
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
          title: "Word Compounds",
          description: "Kelola kata majemuk",
          icon: Layers,
          table: "word_compounds",
          count: 0,
        },
        {
          title: "Word Examples",
          description: "Kelola contoh kalimat",
          icon: MessageSquare,
          table: "word_examples",
          count: 0,
        },
      ]
    },
    {
      id: "tata-bahasa",
      title: "Tata Bahasa",
      description: "Kelola grammar patterns dan soal",
      icon: Layers,
      color: "bg-purple-500",
      sections: [
        {
          title: "Grammar Patterns",
          description: "Kelola deck grammar patterns",
          icon: BookOpen,
          table: "grammar_patterns",
          count: 0,
        },
        {
          title: "Grammar Questions",
          description: "Kelola soal grammar",
          icon: Layers,
          table: "grammar_questions",
          count: 0,
        },
      ]
    },
    {
      id: "estafet",
      title: "Estafet",
      description: "Kelola hanzi relay/stafet",
      icon: Flag,
      color: "bg-orange-500",
      sections: [
        {
          title: "Hanzi Sets",
          description: "Kelola deck estafet",
          icon: Table,
          table: "hanzi_sets",
          count: 0,
        },
        {
          title: "Hanzi Items",
          description: "Kelola daftar kalimat estafet",
          icon: List,
          table: "hanzi_items",
          count: 0,
        },
      ]
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
          <p className="text-sm text-muted-foreground">Kelola data dan konten aplikasi berdasarkan kategori</p>
        </div>
      </div>

      {/* Management Categories */}
      <div className="flex flex-col gap-4">
        {managementCategories.map((category) => {
          const CategoryIcon = category.icon
          const isExpanded = expandedSections.has(category.id)
          
          return (
            <Card key={category.id} className="border-muted/50">
              <CardHeader 
                className="pb-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection(category.id)}
              >
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${category.color}`}>
                      <CategoryIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold">{category.title}</span>
                      <span className="text-xs text-muted-foreground font-normal">{category.description}</span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {category.sections.map((section, index) => {
                      const SectionIcon = section.icon
                      const count = loading ? 0 : (recordCounts[section.table] || 0)
                      return (
                        <Card key={`${section.title}-${index}`} className="border-border/50 bg-muted/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <SectionIcon className="w-4 h-4 text-muted-foreground" />
                              {section.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-muted-foreground mb-3">{section.description}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{loading ? "Loading..." : `${count} records`}</span>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-xs h-7"
                                onClick={() => handleManage(section.table)}
                              >
                                Kelola
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </CardContent>
              )}
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
            Klik tombol <strong>"Kelola"</strong> untuk mengelola data secara langsung di web. 
            CRUD interface sudah tersedia untuk <strong>Flashcard Sets</strong>, <strong>Flashcard Cards</strong>, 
            <strong>Word Compounds</strong>, <strong>Word Examples</strong>, <strong>Grammar Patterns</strong>, 
            <strong>Grammar Questions</strong>, <strong>Hanzi Sets</strong>, dan <strong>Hanzi Items</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
