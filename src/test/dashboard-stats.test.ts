import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  xpFromQuizScore,
  xpFromKalScore,
  calcXPForItem,
  calcCurrentStreak,
  calcBestStreak,
  calcConsistency,
  timeAgo
} from '../lib/dashboard-stats'

describe('Dashboard Stats Helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('XP Calculations', () => {
    it('xpFromQuizScore', () => {
      expect(xpFromQuizScore(100)).toBe(36)
      expect(xpFromQuizScore(80)).toBe(36)
      expect(xpFromQuizScore(79)).toBe(18)
      expect(xpFromQuizScore(60)).toBe(18)
      expect(xpFromQuizScore(59)).toBe(9)
      expect(xpFromQuizScore(0)).toBe(9)
    })

    it('xpFromKalScore', () => {
      expect(xpFromKalScore(50)).toBe(36)
      expect(xpFromKalScore(48)).toBe(36)
      expect(xpFromKalScore(47)).toBe(18)
      expect(xpFromKalScore(36)).toBe(18)
      expect(xpFromKalScore(35)).toBe(9)
      expect(xpFromKalScore(0)).toBe(9)
    })

    it('calcXPForItem', () => {
      expect(calcXPForItem('quiz', 100)).toBe(36)
      expect(calcXPForItem('kal', 50)).toBe(36)
      expect(calcXPForItem('hanzi', 100)).toBe(36)
      expect(calcXPForItem('hanzi', 99)).toBe(0)
      expect(calcXPForItem('cerita', 95)).toBe(36)
      expect(calcXPForItem('cerita', 94)).toBe(0)
      expect(calcXPForItem('fc_session', 30)).toBe(30)
      expect(calcXPForItem('fc_session', 50)).toBe(36)
      expect(calcXPForItem('nada_session', 20)).toBe(20)
      expect(calcXPForItem('nada_session', 50)).toBe(24)
      expect(calcXPForItem('lesson', 0)).toBe(10)
      expect(calcXPForItem('cerita_quiz', 80)).toBe(20)
      expect(calcXPForItem('cerita_quiz', 60)).toBe(12)
      expect(calcXPForItem('cerita_quiz', 59)).toBe(6)
      expect(calcXPForItem('unknown', 100)).toBe(0)
    })
  })

  describe('Streak & Consistency', () => {
    it('calcCurrentStreak', () => {
      vi.setSystemTime(new Date('2023-10-05T12:00:00Z'))
      expect(calcCurrentStreak(new Set())).toBe(0)
      
      expect(calcCurrentStreak(new Set(['2023-10-05']))).toBe(1)
      expect(calcCurrentStreak(new Set(['2023-10-04']))).toBe(1)
      expect(calcCurrentStreak(new Set(['2023-10-03']))).toBe(0)
      
      expect(calcCurrentStreak(new Set(['2023-10-05', '2023-10-04', '2023-10-03']))).toBe(3)
      // Missing 10-04 breaks streak
      expect(calcCurrentStreak(new Set(['2023-10-05', '2023-10-03']))).toBe(1) 
    })

    it('calcBestStreak', () => {
      expect(calcBestStreak(new Set())).toBe(0)
      expect(calcBestStreak(new Set(['2023-10-01']))).toBe(1)
      
      // 3 days consecutive
      expect(calcBestStreak(new Set(['2023-10-01', '2023-10-02', '2023-10-03']))).toBe(3)
      
      // Two streaks: 3 days and 4 days
      const dates = new Set([
        '2023-10-01', '2023-10-02', '2023-10-03', // 3
        '2023-10-05', '2023-10-06', '2023-10-07', '2023-10-08' // 4
      ])
      expect(calcBestStreak(dates)).toBe(4)
    })

    it('calcConsistency', () => {
      vi.setSystemTime(new Date('2023-10-10T12:00:00Z'))
      expect(calcConsistency(new Set())).toBe(0)
      
      // Started 10-01, today is 10-10 (10 days). 5 days active = 50%
      expect(calcConsistency(new Set(['2023-10-01', '2023-10-02', '2023-10-04', '2023-10-05', '2023-10-06']))).toBe(50)
      
      // Started 10-09, today is 10-10 (2 days). 1 day active = 50%
      expect(calcConsistency(new Set(['2023-10-09']))).toBe(50)
    })
  })

  describe('Time Formatting', () => {
    it('timeAgo', () => {
      const now = new Date('2023-10-10T12:00:00Z').getTime()
      vi.setSystemTime(now)
      
      // seconds ago -> "baru saja"
      expect(timeAgo(new Date(now - 30 * 1000).toISOString())).toBe('baru saja')
      
      // minutes ago -> "X menit lalu"
      expect(timeAgo(new Date(now - 5 * 60 * 1000).toISOString())).toBe('5 menit lalu')
      
      // hours ago -> "X jam lalu"
      expect(timeAgo(new Date(now - 3 * 60 * 60 * 1000).toISOString())).toBe('3 jam lalu')
      
      // yesterday -> "kemarin"
      expect(timeAgo(new Date(now - 25 * 60 * 60 * 1000).toISOString())).toBe('kemarin')
      
      // days ago -> "X hari lalu"
      expect(timeAgo(new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString())).toBe('3 hari lalu')
    })
  })
})
