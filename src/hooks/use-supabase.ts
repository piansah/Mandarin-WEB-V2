/**
 * Custom hook for Supabase client
 * Provides a centralized way to access Supabase client throughout the application
 * Makes it easier to add caching, error handling, or provider changes in the future
 */
import { createClient } from "@/lib/supabase/browser"

export function useSupabase() {
  return createClient()
}
