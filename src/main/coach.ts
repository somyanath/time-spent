import type Database from 'better-sqlite3'
import { Notification } from 'electron'
import { getLocalDayRange } from './dayRange'
import { listCategories } from './db/categories'
import { listDiscardedSpansForRange } from './db/discardedSpans'
import { getHeartbeatsForRange } from './db/heartbeats'
import { listManualEntriesForRange } from './db/manualEntries'
import { listOverridesForRange } from './db/overrides'
import { listProjects } from './db/projects'
import { listRules } from './db/rules'
import { getWorkingHours, getWorkModeOverride } from './db/workMode'
import { derive } from '../shared/derive'

const POLL_INTERVAL_MS = 30_000
const BREAK_REMINDER_SNOOZE_MS = 15 * 60_000

export interface CoachController {
  stop(): void
}

/**
 * The thin effectful layer for the Nudge and Break Reminder (#26): on a
 * timer, re-derives today's `dueSignals` and fires the actual OS
 * notification, remembering when it did so the pure core can enforce its
 * own cooldown / once-per-block rules on the next tick. Last-fired state
 * lives in memory only — a restart just forgets it, which is harmless since
 * `dueSignals` is re-derived from scratch every tick anyway.
 */
export function startCoach(db: Database.Database): CoachController {
  let lastNudgeFiredAt: number | null = null
  let lastBreakReminderFiredAt: number | null = null
  let breakReminderSnoozedUntil: number | null = null

  function tick(): void {
    const now = Date.now()
    const { startMs, endMs } = getLocalDayRange(now)
    const heartbeats = getHeartbeatsForRange(db, startMs, endMs)
    const categories = listCategories(db)
    const projects = listProjects(db)
    const rules = listRules(db)
    const overrides = listOverridesForRange(db, startMs, endMs)
    const manualEntries = listManualEntriesForRange(db, startMs, endMs)
    const discardedSpans = listDiscardedSpansForRange(db, startMs, endMs)
    const workingHours = getWorkingHours(db)
    const workModeOverride = getWorkModeOverride(db)

    const { dueSignals } = derive({
      heartbeats,
      categories,
      projects,
      rules,
      overrides,
      manualEntries,
      discardedSpans,
      workingHours,
      workModeOverride,
      lastNudgeFiredAt,
      lastBreakReminderFiredAt,
      breakReminderSnoozedUntil,
      now,
    })

    if (dueSignals.nudge) {
      lastNudgeFiredAt = now
      new Notification({
        title: 'Drifting off-task',
        body: "You've spent a while in Distracting apps — want to get back to it?",
      }).show()
    }

    if (dueSignals.breakReminder) {
      lastBreakReminderFiredAt = now
      const notification = new Notification({
        title: 'Time for a break?',
        body: "You've been heads-down for a while — stretch your legs.",
        actions: [{ type: 'button', text: 'Snooze' }],
      })
      notification.on('action', () => {
        breakReminderSnoozedUntil = Date.now() + BREAK_REMINDER_SNOOZE_MS
      })
      notification.show()
    }
  }

  const timer = setInterval(tick, POLL_INTERVAL_MS)

  return {
    stop(): void {
      clearInterval(timer)
    },
  }
}
