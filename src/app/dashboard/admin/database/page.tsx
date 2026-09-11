"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Database, Table, FileText, Settings, BookOpen, List, Layers, Book, Flag, ClipboardCheck, ChevronDown, ChevronUp, MessageSquare, HelpCircle, Tag } from "lucide-react"
import { createClient } from "@/lib/supabase/browser"

export default function AdminDatabasePage() {
  const router = useRouter()
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set(["modul", "daftar-kata"]))
  const [loading, setLoading] = React.useState(true)
  const [recordCounts, setRecordCounts] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    async function fetchRecordCounts() {
      try {
        const supa = createClient()
        
        const tables = [
          "modul_levels",
          "modul_modules",
          "modul_module_parts",
          "modul_quizzes",
          "modul_quiz_questions",
          "modul_vocab_cards",
          "modul_tags",
          "flashcard_sets",
          "flashcard_cards", 
          "word_compounds",
          "word_examples",
          "grammar_patterns",
          "grammar_questions",
          "hanzi_sets",
          "hanzi_items"
        ]

        // Fetch all counts in parallel using Promise.all
        const countPromises = tables.map(async (table) => {
          try {
            const { count, error } = await supa
              .from(table)
              .select("*", { count: "exact", head: true })
            
            if (!error && count !== null) {
              return { table, count }
            } else {
              return { table, count: 0 }
            }
          } catch (err) {
            console.error(`Error fetching count for ${table}:`, err)
            return { table, count: 0 }
          }
        })

        const results = await Promise.all(countPromises)
        const counts: Record<string, number> = {}
        results.forEach(({ table, count }) => {
          counts[table] = count
        })

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
      case "modul_levels":
        router.push("/dashboard/admin/database/modul-levels")
        break
      case "modul_modules":
        router.push("/dashboard/admin/database/modul-modules")
        break
      case "modul_module_parts":
        router.push("/dashboard/admin/database/modul-module-parts")
        break
      case "modul_quizzes":
        router.push("/dashboard/admin/database/modul-quizzes")
        break
      case "modul_quiz_questions":
        router.push("/dashboard/admin/database/modul-quiz-questions")
        break
      case "modul_vocab_cards":
        router.push("/dashboard/admin/database/modul-vocab-cards")
        break
      case "modul_tags":
        router.push("/dashboard/admin/database/modul-tags")
        break
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
          title: "Modul Levels",
          description: "Kelola level HSK",
          icon: Layers,
          table: "modul_levels",
          count: 0,
        },
        {
          title: "Modul Modules",
          description: "Kelola modul pembelajaran",
          icon: BookOpen,
          table: "modul_modules",
          count: 0,
        },
        {
          title: "Modul Parts",
          description: "Kelola bagian modul (content/practice/quiz)",
          icon: FileText,
          table: "modul_module_parts",
          count: 0,
        },
        {
          title: "Modul Quizzes",
          description: "Kelola quiz untuk modul",
          icon: ClipboardCheck,
          table: "modul_quizzes",
          count: 0,
        },
        {
          title: "Quiz Questions",
          description: "Kelola pertanyaan quiz",
          icon: HelpCircle,
          table: "modul_quiz_questions",
          count: 0,
        },
        {
          title: "Vocab Cards",
          description: "Kelola vocabulary per part",
          icon: Layers,
          table: "modul_vocab_cards",
          count: 0,
        },
        {
          title: "Tags",
          description: "Kelola tags modul",
          icon: Tag,
          table: "modul_tags",
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
                  {/* Guide Section for Modul Category */}
                  {category.id === "modul" && (
                    <div className="mb-6 p-5 bg-muted/50 rounded-xl border border-border">
                      <div className="flex items-center gap-2 mb-4">
                        <BookOpen className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold">Panduan: Cara Membuat Modul Baru</h3>
                      </div>
                      
                      {/* Visual Diagram */}
                      <div className="flex flex-col items-center gap-2 p-4 bg-card rounded-lg border border-border mb-4">
                        {/* Level 1: Modul Levels */}
                        <div className="flex items-center gap-2 w-full">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-primary-foreground font-bold text-xs">1</span>
                          </div>
                          <div className="flex-1 p-2 bg-muted rounded-lg border border-border">
                            <div className="flex items-center gap-1">
                              <Layers className="w-3 h-3 text-foreground" />
                              <span className="text-xs font-semibold">Modul Levels</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">HSK 1-6</p>
                          </div>
                        </div>
                        
                        {/* Arrow down */}
                        <div className="w-0.5 h-4 bg-border"></div>
                        
                        {/* Level 2: Modul Modules */}
                        <div className="flex items-center gap-2 w-full">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-primary-foreground font-bold text-xs">2</span>
                          </div>
                          <div className="flex-1 p-2 bg-muted rounded-lg border border-border">
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-foreground" />
                              <span className="text-xs font-semibold">Modul Modules</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">konten modul</p>
                          </div>
                        </div>
                        
                        {/* Arrow down */}
                        <div className="w-0.5 h-4 bg-border"></div>
                        
                        {/* Level 3: Modul Parts */}
                        <div className="flex items-center gap-2 w-full">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <span className="text-primary-foreground font-bold text-xs">3</span>
                          </div>
                          <div className="flex-1 p-2 bg-muted rounded-lg border border-border">
                            <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3 text-foreground" />
                              <span className="text-xs font-semibold">Modul Parts</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">content/practice/quiz</p>
                          </div>
                        </div>
                        
                        {/* Optional items */}
                        <div className="flex gap-2 mt-1">
                          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-lg border border-border">
                            <ClipboardCheck className="w-2 h-2 text-foreground" />
                            <span className="text-[10px] font-medium">Quizzes</span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-lg border border-border">
                            <HelpCircle className="w-2 h-2 text-foreground" />
                            <span className="text-[10px] font-medium">Questions</span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-lg border border-border">
                            <MessageSquare className="w-2 h-2 text-foreground" />
                            <span className="text-[10px] font-medium">Vocab</span>
                          </div>
                        </div>
                      </div>

                      {/* 6 Points Explanation */}
                      <div className="space-y-2 text-xs">
                        <div className="flex gap-2 items-start">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-foreground font-bold text-[10px]">1</span>
                          </div>
                          <div className="flex-1">
                            <p><strong>Buat Level HSK:</strong> Masuk ke <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Modul Levels</span>, tambahkan level (HSK 1-6)</p>
                          </div>
                        </div>
                        <div className="flex gap-2 items-start">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-foreground font-bold text-[10px]">2</span>
                          </div>
                          <div className="flex-1">
                            <p><strong>Buat Modul:</strong> Masuk ke <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Modul Modules</span>, buat modul dengan level yang sudah dibuat</p>
                          </div>
                        </div>
                        <div className="flex gap-2 items-start">
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-foreground font-bold text-[10px]">3</span>
                          </div>
                          <div className="flex-1">
                            <p><strong>Buat Bagian Modul:</strong> Masuk ke <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Modul Parts</span>, tambahkan content/practice/quiz dengan JSON editor</p>
                          </div>
                        </div>
                        <div className="flex gap-2 items-start">
                          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                            <span className="text-secondary-foreground font-bold text-[10px]">4</span>
                          </div>
                          <div className="flex-1">
                            <p><strong>Opsional - Buat Quiz:</strong> Masuk ke <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Modul Quizzes</span>, buat quiz untuk modul tersebut</p>
                          </div>
                        </div>
                        <div className="flex gap-2 items-start">
                          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                            <span className="text-secondary-foreground font-bold text-[10px]">5</span>
                          </div>
                          <div className="flex-1">
                            <p><strong>Opsional - Buat Pertanyaan Quiz:</strong> Masuk ke <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Quiz Questions</span>, tambahkan pertanyaan dengan JSON options</p>
                          </div>
                        </div>
                        <div className="flex gap-2 items-start">
                          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                            <span className="text-secondary-foreground font-bold text-[10px]">6</span>
                          </div>
                          <div className="flex-1">
                            <p><strong>Opsional - Tambah Vocabulary:</strong> Masuk ke <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">Vocab Cards</span>, tambahkan vocabulary per part</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-2 bg-muted rounded-lg border border-border mt-3">
                        <p className="text-[10px] flex items-center gap-1">
                          <span>💡</span>
                          <span className="font-medium">Tips:</span> Ikuti urutan hierarki dari atas ke bawah untuk menghindari error referensi data!
                        </p>
                      </div>
                    </div>
                  )}
                  
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
