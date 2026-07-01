import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Category } from '../../shared/category'
import type { FocusQualityScoreBreakdown } from '../../shared/derive'
import type { Span } from '../../shared/heartbeat'
import type { Project } from '../../shared/project'

/**
 * The Today surface — the daily review home. Renders the Focus Quality Score
 * with its component breakdown (#25), the category-colored timeline of
 * derived Spans plus a category split summary (#18), and lets the user
 * correct the day inline (#20): Override a span's Category/Project, Discard
 * a falsely-tracked span, or add a Manual Entry for time the tracker
 * couldn't observe.
 */
export function Today(): JSX.Element {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const api = typeof window !== 'undefined' ? window.timeTracker : undefined

  const [spans, setSpans] = useState<Span[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [focusQuality, setFocusQuality] = useState<{ score: number; breakdown: FocusQualityScoreBreakdown } | null>(
    null,
  )

  async function refresh(): Promise<void> {
    if (!api) return
    const [nextSpans, nextCategories, nextProjects, nextFocusQuality] = await Promise.all([
      api.getTodaySpans(),
      api.listCategories(),
      api.listProjects(),
      api.getTodayFocusQuality(),
    ])
    setSpans(nextSpans)
    setCategories(nextCategories)
    setProjects(nextProjects)
    setFocusQuality(nextFocusQuality)
  }

  useEffect(() => {
    refresh()
  }, [])

  const versions = typeof window !== 'undefined' ? window.timeTracker?.versions : undefined

  const categorySplit = useMemo(() => summarizeCategorySplit(spans ?? []), [spans])

  return (
    <section className="today" aria-labelledby="today-heading">
      <header className="today__header">
        <h1 id="today-heading" className="today__title">
          Today
        </h1>
        <p className="today__date">{today}</p>
      </header>

      {focusQuality && (
        <section className="today__focus-quality" aria-label="Focus Quality Score">
          <div className="today__focus-quality-number">{focusQuality.score}</div>
          <ul className="today__focus-quality-breakdown">
            <li>Focus ratio: {formatPercent(focusQuality.breakdown.focusRatio)}</li>
            <li>Distraction penalty: {formatPercent(focusQuality.breakdown.distractionPenalty)}</li>
            <li>Focus continuity: {formatPercent(focusQuality.breakdown.focusContinuity)}</li>
          </ul>
        </section>
      )}

      {spans && spans.length > 0 ? (
        <>
          <ul className="today__category-split" aria-label="Category split">
            {categorySplit.map((entry) => (
              <li key={entry.categoryName} className="today__category-split-item">
                <span className={`today__rating-dot today__rating-dot--${entry.rating}`} aria-hidden="true" />
                <span className="today__category-split-name">{entry.categoryName}</span>
                <span className="today__category-split-duration">{formatDuration(entry.durationMs)}</span>
              </li>
            ))}
          </ul>

          <ol className="today__timeline" aria-label="Today's timeline">
            {spans.map((span) => (
              <TimelineItem
                key={spanKey(span)}
                span={span}
                categories={categories}
                projects={projects}
                onChange={refresh}
              />
            ))}
          </ol>

          <ManualEntryForm categories={categories} projects={projects} onChange={refresh} />
        </>
      ) : (
        <div className="today__empty" role="status">
          <div className="today__empty-glyph" aria-hidden="true" />
          <h2 className="today__empty-title">Nothing tracked yet</h2>
          <p className="today__empty-body">
            Once heartbeats start flowing, your Focus Quality Score, category
            split, and timeline will appear here.
          </p>
        </div>
      )}

      {versions && (
        <footer className="today__footer">
          Electron {versions.electron} · Chromium {versions.chrome} · Node{' '}
          {versions.node}
        </footer>
      )}
    </section>
  )
}

function spanKey(span: Span): string {
  return `${span.startedAt}-${span.endedAt}-${span.manualEntryId ?? 'derived'}`
}

interface TimelineItemProps {
  span: Span
  categories: Category[]
  projects: Project[]
  onChange: () => Promise<void>
}

/** One row of the editable timeline: Override or Discard a derived span, or Remove a Manual Entry. */
function TimelineItem({ span, categories, projects, onChange }: TimelineItemProps): JSX.Element {
  const api = typeof window !== 'undefined' ? window.timeTracker : undefined
  const [overriding, setOverriding] = useState(false)
  const [categoryId, setCategoryId] = useState<number | ''>(span.categoryId ?? '')
  const [projectId, setProjectId] = useState<number | ''>(span.projectId ?? '')

  async function handleSaveOverride(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api || categoryId === '') return
    await api.createOverride({
      startedAt: span.startedAt,
      endedAt: span.endedAt,
      categoryId,
      projectId: projectId === '' ? null : projectId,
    })
    setOverriding(false)
    await onChange()
  }

  async function handleClearOverride(): Promise<void> {
    if (!api || span.overrideId === null) return
    await api.deleteOverride(span.overrideId)
    await onChange()
  }

  async function handleDiscard(): Promise<void> {
    if (!api) return
    await api.createDiscardedSpan({ startedAt: span.startedAt, endedAt: span.endedAt })
    await onChange()
  }

  async function handleRemoveManualEntry(): Promise<void> {
    if (!api || span.manualEntryId === null) return
    await api.deleteManualEntry(span.manualEntryId)
    await onChange()
  }

  return (
    <li className="today__timeline-item">
      <div className="today__timeline-row">
        <span className={`today__rating-dot today__rating-dot--${span.rating}`} aria-hidden="true" />
        <span className="today__timeline-app">{span.appName}</span>
        <span className="today__timeline-category">
          {span.categoryName}
          {span.projectName && ` · ${span.projectName}`}
          {span.overrideId !== null && ' (overridden)'}
        </span>
        <span className="today__timeline-time">
          {formatTime(span.startedAt)} – {formatTime(span.endedAt)}
        </span>
        <div className="today__timeline-actions">
          {span.manualEntryId !== null ? (
            <button type="button" className="settings__delete" onClick={handleRemoveManualEntry}>
              Remove
            </button>
          ) : (
            <>
              {span.overrideId !== null ? (
                <button type="button" className="settings__delete" onClick={handleClearOverride}>
                  Clear override
                </button>
              ) : (
                <button type="button" className="settings__delete" onClick={() => setOverriding((v) => !v)}>
                  Override
                </button>
              )}
              <button type="button" className="settings__delete" onClick={handleDiscard}>
                Discard
              </button>
            </>
          )}
        </div>
      </div>

      {overriding && (
        <form className="settings__form today__timeline-override-form" onSubmit={handleSaveOverride}>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="Override category"
            disabled={categories.length === 0}
          >
            {categories.length === 0 && <option value="">Add a category first</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value === '' ? '' : Number(e.target.value))}
            aria-label="Override project"
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={categoryId === ''}>
            Save
          </button>
        </form>
      )}
    </li>
  )
}

interface ManualEntryFormProps {
  categories: Category[]
  projects: Project[]
  onChange: () => Promise<void>
}

/** Adds a stored Span for time the tracker couldn't observe (offline meetings, calls, a paper notebook). */
function ManualEntryForm({ categories, projects, onChange }: ManualEntryFormProps): JSX.Element {
  const api = typeof window !== 'undefined' ? window.timeTracker : undefined
  const [label, setLabel] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [projectId, setProjectId] = useState<number | ''>('')

  useEffect(() => {
    if (categoryId === '' && categories.length > 0) {
      setCategoryId(categories[0].id)
    }
  }, [categories, categoryId])

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api || label.trim() === '' || categoryId === '') return
    const startedAt = timeStringToMs(startTime)
    const endedAt = timeStringToMs(endTime)
    if (startedAt === null || endedAt === null || endedAt <= startedAt) return

    await api.createManualEntry({
      startedAt,
      endedAt,
      label: label.trim(),
      categoryId,
      projectId: projectId === '' ? null : projectId,
    })
    setLabel('')
    setStartTime('')
    setEndTime('')
    setProjectId('')
    await onChange()
  }

  return (
    <form className="settings__form today__manual-entry-form" onSubmit={handleSubmit} aria-label="Add manual entry">
      <input
        type="text"
        placeholder="What was this time for?"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        aria-label="Manual entry description"
      />
      <input
        type="time"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
        aria-label="Manual entry start time"
      />
      <input
        type="time"
        value={endTime}
        onChange={(e) => setEndTime(e.target.value)}
        aria-label="Manual entry end time"
      />
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
        aria-label="Manual entry category"
        disabled={categories.length === 0}
      >
        {categories.length === 0 && <option value="">Add a category first</option>}
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value === '' ? '' : Number(e.target.value))}
        aria-label="Manual entry project"
      >
        <option value="">No project</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={categories.length === 0}>
        Add Manual Entry
      </button>
    </form>
  )
}

/** Resolves an `<input type="time">` value ("HH:MM") against today's local calendar date. */
function timeStringToMs(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return null
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  return dayStart.getTime() + Number(match[1]) * 3_600_000 + Number(match[2]) * 60_000
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

interface CategorySplitEntry {
  categoryName: string
  rating: Span['rating']
  durationMs: number
}

/** Total tracked time per Category, largest first. */
function summarizeCategorySplit(spans: readonly Span[]): CategorySplitEntry[] {
  const byCategory = new Map<string, CategorySplitEntry>()

  for (const span of spans) {
    const durationMs = span.endedAt - span.startedAt
    const existing = byCategory.get(span.categoryName)
    if (existing) {
      existing.durationMs += durationMs
    } else {
      byCategory.set(span.categoryName, { categoryName: span.categoryName, rating: span.rating, durationMs })
    }
  }

  return [...byCategory.values()].sort((a, b) => b.durationMs - a.durationMs)
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}
