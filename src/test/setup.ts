import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

process.env.TZ = 'Asia/Jakarta'

afterEach(() => {
  cleanup()
})
