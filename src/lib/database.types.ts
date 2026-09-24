export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bug_reports: {
        Row: {
          created_at: string | null
          description: string
          device_info: Json | null
          id: number
          report_type: string | null
          status: string | null
          target_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          device_info?: Json | null
          id?: number
          report_type?: string | null
          status?: string | null
          target_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          device_info?: Json | null
          id?: number
          report_type?: string | null
          status?: string | null
          target_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cerita_paragraphs: {
        Row: {
          cerita_id: number
          cerita_key: string
          created_at: string | null
          hanzi_text: string
          id: number
          para_index: number
        }
        Insert: {
          cerita_id: number
          cerita_key: string
          created_at?: string | null
          hanzi_text: string
          id?: number
          para_index: number
        }
        Update: {
          cerita_id?: number
          cerita_key?: string
          created_at?: string | null
          hanzi_text?: string
          id?: number
          para_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "cerita_paragraphs_cerita_id_fkey"
            columns: ["cerita_id"]
            isOneToOne: false
            referencedRelation: "cerita_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      cerita_progress: {
        Row: {
          cerita_key: string
          id: number
          is_done: boolean | null
          scroll_pct: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cerita_key: string
          id?: number
          is_done?: boolean | null
          scroll_pct?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cerita_key?: string
          id?: number
          is_done?: boolean | null
          scroll_pct?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cerita_sets: {
        Row: {
          badge: string | null
          created_at: string | null
          description: string | null
          hsk_level: number
          id: number
          is_published: boolean | null
          key: string
          quiz_questions: Json | null
          sort_order: number | null
          title: string
          title_zh: string | null
          total_chars: number | null
        }
        Insert: {
          badge?: string | null
          created_at?: string | null
          description?: string | null
          hsk_level?: number
          id?: number
          is_published?: boolean | null
          key: string
          quiz_questions?: Json | null
          sort_order?: number | null
          title: string
          title_zh?: string | null
          total_chars?: number | null
        }
        Update: {
          badge?: string | null
          created_at?: string | null
          description?: string | null
          hsk_level?: number
          id?: number
          is_published?: boolean | null
          key?: string
          quiz_questions?: Json | null
          sort_order?: number | null
          title?: string
          title_zh?: string | null
          total_chars?: number | null
        }
        Relationships: []
      }
      daily_streaks: {
        Row: {
          date: string
          user_id: string
        }
        Insert: {
          date: string
          user_id: string
        }
        Update: {
          date?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_cards: {
        Row: {
          added_by: string | null
          arti: string
          catatan: string | null
          created_at: string | null
          hanzi: string
          id: string
          pinyin: string
          set_id: number
          word_class: string | null
        }
        Insert: {
          added_by?: string | null
          arti: string
          catatan?: string | null
          created_at?: string | null
          hanzi: string
          id?: string
          pinyin: string
          set_id: number
          word_class?: string | null
        }
        Update: {
          added_by?: string | null
          arti?: string
          catatan?: string | null
          created_at?: string | null
          hanzi?: string
          id?: string
          pinyin?: string
          set_id?: number
          word_class?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_cards_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "flashcard_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_sets: {
        Row: {
          badge: string
          created_by: string | null
          day_number: number
          description: string | null
          hsk_level: number
          id: number
          is_default: boolean | null
          sort_order: number
          title: string
        }
        Insert: {
          badge?: string
          created_by?: string | null
          day_number: number
          description?: string | null
          hsk_level?: number
          id?: number
          is_default?: boolean | null
          sort_order?: number
          title: string
        }
        Update: {
          badge?: string
          created_by?: string | null
          day_number?: number
          description?: string | null
          hsk_level?: number
          id?: number
          is_default?: boolean | null
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      grammar_patterns: {
        Row: {
          badge: string | null
          created_at: string | null
          example_json: Json | null
          hsk_level: number | null
          id: number
          slug: string
          sort_order: number | null
          sub_title: string | null
          theory_text: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          badge?: string | null
          created_at?: string | null
          example_json?: Json | null
          hsk_level?: number | null
          id?: number
          slug: string
          sort_order?: number | null
          sub_title?: string | null
          theory_text?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          badge?: string | null
          created_at?: string | null
          example_json?: Json | null
          hsk_level?: number | null
          id?: number
          slug?: string
          sort_order?: number | null
          sub_title?: string | null
          theory_text?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      grammar_questions: {
        Row: {
          alt_orders: Json | null
          correct_order: Json
          created_at: string | null
          explanation: string | null
          id: number
          pattern_id: number
          pinyin_word: Json | null
          sort_order: number | null
          translation: string
          updated_at: string | null
          words: Json
        }
        Insert: {
          alt_orders?: Json | null
          correct_order: Json
          created_at?: string | null
          explanation?: string | null
          id?: number
          pattern_id: number
          pinyin_word?: Json | null
          sort_order?: number | null
          translation: string
          updated_at?: string | null
          words: Json
        }
        Update: {
          alt_orders?: Json | null
          correct_order?: Json
          created_at?: string | null
          explanation?: string | null
          id?: number
          pattern_id?: number
          pinyin_word?: Json | null
          sort_order?: number | null
          translation?: string
          updated_at?: string | null
          words?: Json
        }
        Relationships: [
          {
            foreignKeyName: "grammar_questions_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "grammar_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      hanzi_items: {
        Row: {
          arti: string
          hanzi: string
          hanzi_key: string
          id: number
          pinyin: string
          section_label: string
          section_tag: string
          sort_order: number
          user_contribution: boolean | null
        }
        Insert: {
          arti: string
          hanzi: string
          hanzi_key: string
          id?: number
          pinyin: string
          section_label: string
          section_tag: string
          sort_order: number
          user_contribution?: boolean | null
        }
        Update: {
          arti?: string
          hanzi?: string
          hanzi_key?: string
          id?: number
          pinyin?: string
          section_label?: string
          section_tag?: string
          sort_order?: number
          user_contribution?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_hanzi_items_set"
            columns: ["hanzi_key"]
            isOneToOne: false
            referencedRelation: "hanzi_sets"
            referencedColumns: ["key"]
          },
        ]
      }
      hanzi_sets: {
        Row: {
          badge: string
          created_at: string
          description: string | null
          hsk_level: number
          id: number
          key: string
          sort_order: number
          sub: string
          title: string
          unlock_after: number
          updated_at: string
        }
        Insert: {
          badge: string
          created_at?: string
          description?: string | null
          hsk_level: number
          id?: number
          key: string
          sort_order?: number
          sub: string
          title: string
          unlock_after?: number
          updated_at?: string
        }
        Update: {
          badge?: string
          created_at?: string
          description?: string | null
          hsk_level?: number
          id?: number
          key?: string
          sort_order?: number
          sub?: string
          title?: string
          unlock_after?: number
          updated_at?: string
        }
        Relationships: []
      }
      kalimat_questions: {
        Row: {
          answer_index: number
          id: number
          kal_key: string
          options: Json
          question: string
          question_type: string
          section_index: number
          sort_order: number
        }
        Insert: {
          answer_index: number
          id?: number
          kal_key: string
          options: Json
          question: string
          question_type: string
          section_index: number
          sort_order: number
        }
        Update: {
          answer_index?: number
          id?: number
          kal_key?: string
          options?: Json
          question?: string
          question_type?: string
          section_index?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_kalimat_questions_set"
            columns: ["kal_key"]
            isOneToOne: false
            referencedRelation: "kalimat_sets"
            referencedColumns: ["key"]
          },
        ]
      }
      kalimat_sets: {
        Row: {
          created_at: string
          hsk_level: number
          id: number
          key: string
          sort_order: number
          sub: string
          title: string
          unlock_after: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          hsk_level: number
          id?: number
          key: string
          sort_order?: number
          sub: string
          title: string
          unlock_after?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          hsk_level?: number
          id?: number
          key?: string
          sort_order?: number
          sub?: string
          title?: string
          unlock_after?: number
          updated_at?: string
        }
        Relationships: []
      }
      modul_bookmarks: {
        Row: {
          created_at: string
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modul_bookmarks_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modul_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modul_levels: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          label: string
          order_index: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      modul_module_parts: {
        Row: {
          content: Json | null
          created_at: string
          id: string
          kalimat_parts: Json | null
          module_id: string
          order_index: number
          title: string
          updated_at: string
          vocab_parts: Json | null
        }
        Insert: {
          content?: Json | null
          created_at?: string
          id?: string
          kalimat_parts?: Json | null
          module_id: string
          order_index: number
          title: string
          updated_at?: string
          vocab_parts?: Json | null
        }
        Update: {
          content?: Json | null
          created_at?: string
          id?: string
          kalimat_parts?: Json | null
          module_id?: string
          order_index?: number
          title?: string
          updated_at?: string
          vocab_parts?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "modul_module_parts_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modul_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modul_module_tags: {
        Row: {
          module_id: string
          tag_id: string
        }
        Insert: {
          module_id: string
          tag_id: string
        }
        Update: {
          module_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modul_module_tags_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modul_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modul_module_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "modul_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      modul_modules: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          has_quiz: boolean
          id: string
          is_published: boolean
          level_id: string
          order_index: number
          part_count: number
          slug: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          has_quiz?: boolean
          id?: string
          is_published?: boolean
          level_id: string
          order_index?: number
          part_count?: number
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          has_quiz?: boolean
          id?: string
          is_published?: boolean
          level_id?: string
          order_index?: number
          part_count?: number
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modul_modules_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "modul_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      modul_quiz_questions: {
        Row: {
          correct_option_id: string
          id: string
          module_id: string
          options: Json
          order_index: number
          question_text: string
          question_type: string
        }
        Insert: {
          correct_option_id: string
          id?: string
          module_id: string
          options: Json
          order_index?: number
          question_text: string
          question_type?: string
        }
        Update: {
          correct_option_id?: string
          id?: string
          module_id?: string
          options?: Json
          order_index?: number
          question_text?: string
          question_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "modul_quiz_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modul_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modul_quizzes: {
        Row: {
          created_at: string
          id: string
          module_id: string
          passing_score: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          passing_score?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          passing_score?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modul_quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modul_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modul_tags: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      modul_user_module_progress: {
        Row: {
          completed_at: string | null
          current_part_id: string | null
          id: string
          module_id: string
          progress_percent: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          current_part_id?: string | null
          id?: string
          module_id: string
          progress_percent?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          current_part_id?: string | null
          id?: string
          module_id?: string
          progress_percent?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modul_user_module_progress_current_part_id_fkey"
            columns: ["current_part_id"]
            isOneToOne: false
            referencedRelation: "modul_module_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modul_user_module_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modul_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modul_videos: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          module_id: string | null
          order_index: number
          title: string
          video_url: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          module_id?: string | null
          order_index?: number
          title: string
          video_url: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          module_id?: string | null
          order_index?: number
          title?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "modul_videos_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modul_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string | null
          daily_enabled: boolean | null
          daily_hour: number | null
          srs_enabled: boolean | null
          srs_hour: number | null
          streak_enabled: boolean | null
          streak_hour: number | null
          updated_at: string | null
          user_id: string
          weekly_enabled: boolean | null
          weekly_hour: number | null
        }
        Insert: {
          created_at?: string | null
          daily_enabled?: boolean | null
          daily_hour?: number | null
          srs_enabled?: boolean | null
          srs_hour?: number | null
          streak_enabled?: boolean | null
          streak_hour?: number | null
          updated_at?: string | null
          user_id: string
          weekly_enabled?: boolean | null
          weekly_hour?: number | null
        }
        Update: {
          created_at?: string | null
          daily_enabled?: boolean | null
          daily_hour?: number | null
          srs_enabled?: boolean | null
          srs_hour?: number | null
          streak_enabled?: boolean | null
          streak_hour?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_enabled?: boolean | null
          weekly_hour?: number | null
        }
        Relationships: []
      }
      personal_cards: {
        Row: {
          added_by: string | null
          arti: string
          catatan: string | null
          created_at: string
          deck_id: number
          hanzi: string
          id: string
          pinyin: string
          word_class: string | null
        }
        Insert: {
          added_by?: string | null
          arti: string
          catatan?: string | null
          created_at?: string
          deck_id: number
          hanzi: string
          id?: string
          pinyin: string
          word_class?: string | null
        }
        Update: {
          added_by?: string | null
          arti?: string
          catatan?: string | null
          created_at?: string
          deck_id?: number
          hanzi?: string
          id?: string
          pinyin?: string
          word_class?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "personal_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_decks: {
        Row: {
          badge: string
          created_at: string
          created_by: string | null
          day_number: number
          description: string | null
          hsk_level: number
          id: number
          is_default: boolean | null
          sort_order: number
          theme_id: number
          title: string
        }
        Insert: {
          badge?: string
          created_at?: string
          created_by?: string | null
          day_number?: number
          description?: string | null
          hsk_level?: number
          id?: number
          is_default?: boolean | null
          sort_order?: number
          theme_id: number
          title: string
        }
        Update: {
          badge?: string
          created_at?: string
          created_by?: string | null
          day_number?: number
          description?: string | null
          hsk_level?: number
          id?: number
          is_default?: boolean | null
          sort_order?: number
          theme_id?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_decks_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "personal_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_favorites: {
        Row: {
          arti: string | null
          catatan: string | null
          created_at: string
          hanzi: string
          id: number
          pinyin: string
          source: string | null
          source_id: number | null
          user_id: string
          word_class: string | null
        }
        Insert: {
          arti?: string | null
          catatan?: string | null
          created_at?: string
          hanzi: string
          id?: number
          pinyin: string
          source?: string | null
          source_id?: number | null
          user_id: string
          word_class?: string | null
        }
        Update: {
          arti?: string | null
          catatan?: string | null
          created_at?: string
          hanzi?: string
          id?: number
          pinyin?: string
          source?: string | null
          source_id?: number | null
          user_id?: string
          word_class?: string | null
        }
        Relationships: []
      }
      personal_themes: {
        Row: {
          created_at: string
          icon: string
          id: number
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: number
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_card_progress: {
        Row: {
          card_id: string
          ease_factor: number
          id: number
          interval_days: number
          last_reviewed: string | null
          next_review: string | null
          session_id: string | null
          srs_level: number
          user_id: string
        }
        Insert: {
          card_id: string
          ease_factor?: number
          id?: number
          interval_days?: number
          last_reviewed?: string | null
          next_review?: string | null
          session_id?: string | null
          srs_level?: number
          user_id: string
        }
        Update: {
          card_id?: string
          ease_factor?: number
          id?: number
          interval_days?: number
          last_reviewed?: string | null
          next_review?: string | null
          session_id?: string | null
          srs_level?: number
          user_id?: string
        }
        Relationships: []
      }
      user_placement: {
        Row: {
          created_at: string | null
          goal: number
          hanzi_mode: number
          id: string
          level: number
          unlocked_count: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          goal: number
          hanzi_mode: number
          id?: string
          level: number
          unlocked_count: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          goal?: number
          hanzi_mode?: number
          id?: string
          level?: number
          unlocked_count?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          avatar_id: number
          badges: Json
          created_at: string
          custom_avatar_url: string | null
          daily_goal_minutes: number | null
          display_name: string | null
          hanzi_font: string | null
          has_seen_onboarding: boolean | null
          perfect_quiz_count: number
          role: string | null
          selected_avatar: string | null
          title_id: string | null
          unlocked_tiers: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_id?: number
          badges?: Json
          created_at?: string
          custom_avatar_url?: string | null
          daily_goal_minutes?: number | null
          display_name?: string | null
          hanzi_font?: string | null
          has_seen_onboarding?: boolean | null
          perfect_quiz_count?: number
          role?: string | null
          selected_avatar?: string | null
          title_id?: string | null
          unlocked_tiers?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: number
          badges?: Json
          created_at?: string
          custom_avatar_url?: string | null
          daily_goal_minutes?: number | null
          display_name?: string | null
          hanzi_font?: string | null
          has_seen_onboarding?: boolean | null
          perfect_quiz_count?: number
          role?: string | null
          selected_avatar?: string | null
          title_id?: string | null
          unlocked_tiers?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_scores: {
        Row: {
          id: string
          key: string
          meta: Json | null
          score: number
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          key: string
          meta?: Json | null
          score: number
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          key?: string
          meta?: Json | null
          score?: number
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_search_history: {
        Row: {
          created_at: string | null
          id: string
          is_archived: boolean | null
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          query: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      word_compounds: {
        Row: {
          arti: string | null
          badge: string
          frequency: number
          hanzi: string
          id: number
          pinyin: string
        }
        Insert: {
          arti?: string | null
          badge?: string
          frequency?: number
          hanzi: string
          id?: number
          pinyin: string
        }
        Update: {
          arti?: string | null
          badge?: string
          frequency?: number
          hanzi?: string
          id?: number
          pinyin?: string
        }
        Relationships: []
      }
      word_examples: {
        Row: {
          added_by: string | null
          arti: string | null
          created_at: string | null
          hanzi: string
          id: number
          pinyin: string | null
          word_hanzi: string
        }
        Insert: {
          added_by?: string | null
          arti?: string | null
          created_at?: string | null
          hanzi: string
          id?: never
          pinyin?: string | null
          word_hanzi: string
        }
        Update: {
          added_by?: string | null
          arti?: string | null
          created_at?: string | null
          hanzi?: string
          id?: never
          pinyin?: string | null
          word_hanzi?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_stats: {
        Args: never
        Returns: {
          active_today: number
          admin_users: number
          total_users: number
        }[]
      }
      get_all_users_admin: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          role: string
          updated_at: string
          user_id: string
        }[]
      }
      get_user_stats: { Args: never; Returns: Json }
      get_users_for_regular_admin: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          role: string
          updated_at: string
          user_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_user_role_admin: {
        Args: { new_role: string; target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
