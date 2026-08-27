/**
 * Custom hook for Supabase client
 * Provides a centralized way to access Supabase client throughout the application
 * Makes it easier to add caching, error handling, or provider changes in the future
 *
 * Returns a stable (memoized) client instance for the lifetime of the component,
 * so it's safe to depend on in `useEffect`/`useCallback` dependency arrays.
 *
 * IMPORTANT: like any React Hook, call this once at the top level of your
 * component (not inside effects, callbacks, or conditions) and reuse the
 * returned value inside effects/handlers.
 */
import * as React from "react"
import { createClient } from "@/lib/supabase/browser"

export function useSupabase() {
  return React.useMemo(() => createClient(), [])
}
