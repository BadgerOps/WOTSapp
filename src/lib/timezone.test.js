import { describe, it, expect } from 'vitest'
import { getActualShiftDate } from './timezone'

describe('getActualShiftDate', () => {
  it('returns the same date for shift1', () => {
    expect(getActualShiftDate('2026-01-25', 'shift1')).toBe('2026-01-25')
  })

  it('returns the next day for shift2', () => {
    expect(getActualShiftDate('2026-01-25', 'shift2')).toBe('2026-01-26')
  })

  it('handles month boundary for shift2', () => {
    expect(getActualShiftDate('2026-01-31', 'shift2')).toBe('2026-02-01')
  })

  it('handles year boundary for shift2', () => {
    expect(getActualShiftDate('2026-12-31', 'shift2')).toBe('2027-01-01')
  })
})
