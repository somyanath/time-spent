import type Database from 'better-sqlite3'
import { computeWorkModeState } from '../../shared/workMode'
import type { WorkingHoursSchedule, WorkModeOverride, WorkModeState } from '../../shared/workMode'

export function getWorkingHours(db: Database.Database): WorkingHoursSchedule {
  const row = db.prepare('SELECT working_hours_json AS json FROM settings WHERE id = 1').get() as { json: string }
  return JSON.parse(row.json) as WorkingHoursSchedule
}

/** Replaces the whole schedule in one write, so "copy to all days" is just a client-side reshuffle before saving. */
export function setWorkingHours(db: Database.Database, schedule: WorkingHoursSchedule): WorkingHoursSchedule {
  db.prepare('UPDATE settings SET working_hours_json = ? WHERE id = 1').run(JSON.stringify(schedule))
  return getWorkingHours(db)
}

export function getWorkModeOverride(db: Database.Database): WorkModeOverride | null {
  const row = db.prepare('SELECT work_mode_override AS value, work_mode_override_set_at AS setAt FROM settings WHERE id = 1').get() as {
    value: number | null
    setAt: number | null
  }
  if (row.value === null || row.setAt === null) return null
  return { value: row.value === 1, setAt: row.setAt }
}

export function setWorkModeOverride(db: Database.Database, value: boolean, setAt: number): WorkModeOverride | null {
  db.prepare('UPDATE settings SET work_mode_override = ?, work_mode_override_set_at = ? WHERE id = 1').run(value ? 1 : 0, setAt)
  return getWorkModeOverride(db)
}

export function clearWorkModeOverride(db: Database.Database): void {
  db.prepare('UPDATE settings SET work_mode_override = NULL, work_mode_override_set_at = NULL WHERE id = 1').run()
}

/** The effective Work Mode right now — schedule plus any still-active manual override. */
export function getWorkModeState(db: Database.Database, now: number): WorkModeState {
  return computeWorkModeState(getWorkingHours(db), getWorkModeOverride(db), now)
}
