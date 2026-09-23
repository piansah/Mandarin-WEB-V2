import { describe, it, expect } from 'vitest'

describe('Sample Test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle basic math', () => {
    expect(2 * 3).toBe(6)
    expect(10 - 4).toBe(6)
  })

  it('should handle string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO')
    expect('world'.length).toBe(5)
  })
})
