'use client'

import { useEffect, useRef, useCallback } from 'react'

interface UseIdleTimerOptions {
  /** Total inactivity duration before onTimeout fires (ms). */
  timeoutMs: number
  /** Fires when the idle duration is reached. */
  onTimeout: () => void
  /** Fires ~warningMs before timeout to warn the user (optional). */
  onWarning?: () => void
  /** Lead time before timeout to trigger onWarning (ms). Default: 60s before. */
  warningMs?: number
  /** Events that reset the idle clock. */
  events?: string[]
}

/**
 * useIdleTimer
 * ------------
 * Tracks user activity (mouse, keyboard, touch, scroll, visibility) and
 * fires `onTimeout` after `timeoutMs` of inactivity. Optionally fires
 * `onWarning` shortly before the timeout so the user can be prompted.
 *
 * Behaviour notes:
 * - No-op on SSR (server has no window/document).
 * - The timer resets on ANY tracked activity event.
 * - When the tab is hidden (visibilitychange), the clock keeps ticking;
 *   this is intentional so that a background tab still times out.
 * - Cross-tab logout sync is handled separately via a `storage` event
 *   listener (see app-shell.tsx), so if tab A logs out, tab B follows.
 */
export function useIdleTimer({
  timeoutMs,
  onTimeout,
  onWarning,
  warningMs = 60_000,
  events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel', 'click'],
}: UseIdleTimerOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedRef = useRef(false)
  // Keep latest callback in a ref so the timer doesn't need to be reset
  // whenever the parent re-renders with a new closure identity.
  const onTimeoutRef = useRef(onTimeout)
  const onWarningRef = useRef(onWarning)

  useEffect(() => {
    onTimeoutRef.current = onTimeout
    onWarningRef.current = onWarning
  }, [onTimeout, onWarning])

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current)
      warningRef.current = null
    }
  }, [])

  const scheduleTimers = useCallback(() => {
    clearTimers()
    warnedRef.current = false

    // Warning timer fires warningMs before the main timeout.
    const warningDelay = Math.max(0, timeoutMs - warningMs)
    if (onWarningRef.current && warningDelay > 0 && warningDelay < timeoutMs) {
      warningRef.current = setTimeout(() => {
        if (!warnedRef.current) {
          warnedRef.current = true
          onWarningRef.current?.()
        }
      }, warningDelay)
    }

    // Main timeout.
    timeoutRef.current = setTimeout(() => {
      onTimeoutRef.current?.()
    }, timeoutMs)
  }, [timeoutMs, warningMs, clearTimers])

  const handleActivity = useCallback(() => {
    scheduleTimers()
  }, [scheduleTimers])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Start the first timer when the hook mounts.
    scheduleTimers()

    // Attach passive listeners for all activity events.
    const opts: AddEventListenerOptions = { passive: true }
    events.forEach((evt) => {
      window.addEventListener(evt, handleActivity, opts)
    })

    // Reset the clock when the tab becomes visible again (so that the
    // time spent hidden doesn't immediately trigger a logout if it was
    // within threshold — but a hidden tab still counts as "inactive").
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleActivity()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimers()
      events.forEach((evt) => {
        window.removeEventListener(evt, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [timeoutMs, warningMs])
}
