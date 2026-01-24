import { describe, it, expect } from 'vitest'
import { CQ_SHIFT_TIMES } from './useCQSchedule'

/**
 * Tests for CQ Schedule constants and utilities
 *
 * Note: Hook tests for useCQSchedule, useCQRoster, useMyCQShift, and useCQScheduleActions
 * require special mocking setup due to Firebase and context dependencies.
 * See useCQShifts.test.js and useCQNotes.test.js for examples of hook testing patterns.
 */

describe('CQ_SHIFT_TIMES', () => {
  describe('Shift 1 (2000-0100)', () => {
    it('should have start time of 20:00', () => {
      expect(CQ_SHIFT_TIMES.shift1.start).toBe('20:00')
    })

    it('should have end time of 01:00', () => {
      expect(CQ_SHIFT_TIMES.shift1.end).toBe('01:00')
    })

    it('should have correct label', () => {
      expect(CQ_SHIFT_TIMES.shift1.label).toBe('2000–0100')
    })
  })

  describe('Shift 2 (0100-0600)', () => {
    it('should have start time of 01:00', () => {
      expect(CQ_SHIFT_TIMES.shift2.start).toBe('01:00')
    })

    it('should have end time of 06:00', () => {
      expect(CQ_SHIFT_TIMES.shift2.end).toBe('06:00')
    })

    it('should have correct label', () => {
      expect(CQ_SHIFT_TIMES.shift2.label).toBe('0100–0600')
    })
  })

  describe('Shift configuration', () => {
    it('should have both shifts defined', () => {
      expect(CQ_SHIFT_TIMES).toHaveProperty('shift1')
      expect(CQ_SHIFT_TIMES).toHaveProperty('shift2')
    })

    it('should have consecutive shift times (shift1 ends when shift2 starts)', () => {
      expect(CQ_SHIFT_TIMES.shift1.end).toBe(CQ_SHIFT_TIMES.shift2.start)
    })

    it('should cover night hours (2000-0600)', () => {
      // Shift 1 covers 2000-0100 (5 hours)
      // Shift 2 covers 0100-0600 (5 hours)
      // Total: 10 hours of CQ coverage
      expect(CQ_SHIFT_TIMES.shift1.start).toBe('20:00') // 8 PM
      expect(CQ_SHIFT_TIMES.shift2.end).toBe('06:00')   // 6 AM
    })
  })
})
