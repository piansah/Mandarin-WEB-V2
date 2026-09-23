import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calcCurrentStreak, calcBestStreak } from '../lib/stats-library'

describe('Stats Library Helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Streak Calculations', () => {
    it('calcCurrentStreak', () => {
      vi.setSystemTime(new Date('2023-10-05T12:00:00Z'))
      expect(calcCurrentStreak(new Set())).toBe(0)
      
      // Today is active
      expect(calcCurrentStreak(new Set(['2023-10-05']))).toBe(1)
      
      // Yesterday is active (streak still alive)
      expect(calcCurrentStreak(new Set(['2023-10-04']))).toBe(1)
      
      // Only 2 days ago is active (streak broken)
      expect(calcCurrentStreak(new Set(['2023-10-03']))).toBe(0)
      
      // 3 day streak
      expect(calcCurrentStreak(new Set(['2023-10-05', '2023-10-04', '2023-10-03']))).toBe(3)
    })

    it('calcBestStreak', () => {
      expect(calcBestStreak(new Set())).toBe(0)
      
      // One day streak
      expect(calcBestStreak(new Set(['2023-10-01']))).toBe(1)
      
      // Three consecutive days
      expect(calcBestStreak(new Set(['2023-10-01', '2023-10-02', '2023-10-03']))).toBe(3)
      
      // Disconnected streaks: 2 days vs 4 days
      const dates = new Set([
        '2023-10-01', '2023-10-02', 
        '2023-10-10', '2023-10-11', '2023-10-12', '2023-10-13'
      ])
      expect(calcBestStreak(dates)).toBe(4)
    })
  })
})
