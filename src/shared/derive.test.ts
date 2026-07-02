import { describe, expect, it } from 'vitest'
import { derive } from './derive'
import type { Category, Rule } from './category'
import type { DiscardedSpan } from './discardedSpan'
import type { Heartbeat } from './heartbeat'
import type { ManualEntry } from './manualEntry'
import type { Override } from './override'
import type { Project } from './project'

function heartbeat(overrides: Partial<Heartbeat>): Heartbeat {
  return {
    startedAt: 0,
    endedAt: 1_000,
    appName: 'Code',
    bundleId: 'com.microsoft.VSCode',
    windowTitle: null,
    url: null,
    idleSeconds: 0,
    ...overrides,
  }
}

function category(overrides: Partial<Category>): Category {
  return { id: 1, name: 'Code', rating: 'focus', ...overrides }
}

function rule(overrides: Partial<Rule>): Rule {
  return {
    id: 1,
    categoryId: 1,
    projectId: null,
    position: 0,
    appPattern: null,
    titlePattern: null,
    urlPattern: null,
    ...overrides,
  }
}

function project(overrides: Partial<Project>): Project {
  return { id: 1, name: 'Acme Website', client: null, ...overrides }
}

function override(overrides: Partial<Override>): Override {
  return { id: 1, startedAt: 0, endedAt: 1_000, categoryId: 1, projectId: null, ...overrides }
}

function manualEntry(overrides: Partial<ManualEntry>): ManualEntry {
  return { id: 1, startedAt: 0, endedAt: 1_000, label: 'Offline meeting', categoryId: 1, projectId: null, ...overrides }
}

function discardedSpan(overrides: Partial<DiscardedSpan>): DiscardedSpan {
  return { id: 1, startedAt: 0, endedAt: 1_000, ...overrides }
}

describe('derive', () => {
  it('returns no spans for no heartbeats', () => {
    const result = derive({ heartbeats: [], now: 0 })

    expect(result.spans).toEqual([])
  })

  it('merges consecutive like-heartbeats into a single span', () => {
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
      heartbeat({ startedAt: 3_000, endedAt: 6_000 }),
      heartbeat({ startedAt: 6_000, endedAt: 9_000 }),
    ]

    const { spans } = derive({ heartbeats, now: 9_000 })

    expect(spans).toEqual([
      expect.objectContaining({ startedAt: 0, endedAt: 9_000, appName: 'Code' }),
    ])
  })

  it('bridges a small gap left by a periodic tracker flush (within the merge tolerance)', () => {
    // A flush closes the open heartbeat a little before the next poll opens
    // a fresh one for the same still-active app — this is expected, not a
    // real interruption, so derive() should still merge them into one span.
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
      heartbeat({ startedAt: 3_500, endedAt: 6_500 }),
    ]

    const { spans } = derive({ heartbeats, now: 6_500 })

    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 6_500 })])
  })

  it('does not merge across a gap larger than the configured tolerance', () => {
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
      heartbeat({ startedAt: 20_000, endedAt: 23_000 }),
    ]

    const { spans } = derive({ heartbeats, now: 23_000, config: { mergeGapToleranceMs: 3_000 } })

    expect(spans).toHaveLength(2)
    expect(spans[0]).toEqual(expect.objectContaining({ startedAt: 0, endedAt: 3_000 }))
    expect(spans[1]).toEqual(expect.objectContaining({ startedAt: 20_000, endedAt: 23_000 }))
  })

  it('does not merge heartbeats from different apps even when contiguous', () => {
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000, appName: 'Code' }),
      heartbeat({ startedAt: 3_000, endedAt: 6_000, appName: 'Slack' }),
    ]

    const { spans } = derive({ heartbeats, now: 6_000 })

    expect(spans).toHaveLength(2)
    expect(spans.map((s) => s.appName)).toEqual(['Code', 'Slack'])
  })

  it('does not merge heartbeats with a different window title or url', () => {
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000, windowTitle: 'PR #17' }),
      heartbeat({ startedAt: 3_000, endedAt: 6_000, windowTitle: 'PR #18' }),
    ]

    const { spans } = derive({ heartbeats, now: 6_000 })

    expect(spans).toHaveLength(2)
  })

  it('sorts out-of-order heartbeats before merging', () => {
    const heartbeats = [
      heartbeat({ startedAt: 3_000, endedAt: 6_000 }),
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
    ]

    const { spans } = derive({ heartbeats, now: 6_000 })

    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 6_000 })])
  })

  it('excludes heartbeats that start after the injected clock', () => {
    const heartbeats = [
      heartbeat({ startedAt: 0, endedAt: 3_000 }),
      heartbeat({ startedAt: 100_000, endedAt: 103_000 }),
    ]

    const { spans } = derive({ heartbeats, now: 3_000 })

    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 3_000 })])
  })
})

describe('derive categorization', () => {
  it('assigns the Uncategorized default when no rules are given', () => {
    const heartbeats = [heartbeat({ appName: 'Code' })]

    const { spans } = derive({ heartbeats, now: 1_000 })

    expect(spans[0]).toEqual(
      expect.objectContaining({ categoryId: null, categoryName: 'Uncategorized', rating: 'neutral' }),
    )
  })

  it('assigns the Uncategorized default when no rule matches', () => {
    const heartbeats = [heartbeat({ appName: 'Code' })]
    const categories = [category({ id: 1, name: 'Social Media', rating: 'distracting' })]
    const rules = [rule({ id: 1, categoryId: 1, appPattern: 'Twitter' })]

    const { spans } = derive({ heartbeats, categories, rules, now: 1_000 })

    expect(spans[0]).toEqual(
      expect.objectContaining({ categoryId: null, categoryName: 'Uncategorized', rating: 'neutral' }),
    )
  })

  it('categorizes a span whose app matches a rule app pattern', () => {
    const heartbeats = [heartbeat({ appName: 'Visual Studio Code' })]
    const categories = [category({ id: 1, name: 'Code', rating: 'focus' })]
    const rules = [rule({ id: 1, categoryId: 1, appPattern: 'Code' })]

    const { spans } = derive({ heartbeats, categories, rules, now: 1_000 })

    expect(spans[0]).toEqual(expect.objectContaining({ categoryId: 1, categoryName: 'Code', rating: 'focus' }))
  })

  it('matches app patterns case-insensitively', () => {
    const heartbeats = [heartbeat({ appName: 'Visual Studio Code' })]
    const categories = [category({ id: 1, name: 'Code', rating: 'focus' })]
    const rules = [rule({ id: 1, categoryId: 1, appPattern: 'code' })]

    const { spans } = derive({ heartbeats, categories, rules, now: 1_000 })

    expect(spans[0]).toEqual(expect.objectContaining({ categoryId: 1 }))
  })

  it('matches on window title and url patterns', () => {
    const categories = [
      category({ id: 1, name: 'Reviews', rating: 'focus' }),
      category({ id: 2, name: 'Email', rating: 'neutral' }),
    ]
    const rules = [
      rule({ id: 1, categoryId: 1, titlePattern: 'Pull Request' }),
      rule({ id: 2, categoryId: 2, urlPattern: 'mail.google.com', position: 1 }),
    ]

    const byTitle = derive({
      heartbeats: [heartbeat({ appName: 'Chrome', windowTitle: 'Pull Request #18' })],
      categories,
      rules,
      now: 1_000,
    })
    expect(byTitle.spans[0]).toEqual(expect.objectContaining({ categoryId: 1 }))

    const byUrl = derive({
      heartbeats: [heartbeat({ appName: 'Chrome', url: 'https://mail.google.com/mail/u/0' })],
      categories,
      rules,
      now: 1_000,
    })
    expect(byUrl.spans[0]).toEqual(expect.objectContaining({ categoryId: 2 }))
  })

  it('requires every non-null pattern on a rule to match', () => {
    const categories = [category({ id: 1, name: 'Code Reviews', rating: 'focus' })]
    const rules = [rule({ id: 1, categoryId: 1, appPattern: 'Chrome', titlePattern: 'Pull Request' })]

    const { spans } = derive({
      heartbeats: [heartbeat({ appName: 'Chrome', windowTitle: 'Inbox' })],
      categories,
      rules,
      now: 1_000,
    })

    expect(spans[0]).toEqual(expect.objectContaining({ categoryId: null }))
  })

  it('applies the first matching rule in position order (lowest position wins)', () => {
    const categories = [
      category({ id: 1, name: 'Distraction', rating: 'distracting' }),
      category({ id: 2, name: 'Code', rating: 'focus' }),
    ]
    // Both rules match "Code" — position 0 must win regardless of array order.
    const rules = [
      rule({ id: 2, categoryId: 2, appPattern: 'Code', position: 0 }),
      rule({ id: 1, categoryId: 1, appPattern: 'Code', position: 1 }),
    ]

    const { spans } = derive({ heartbeats: [heartbeat({ appName: 'Code' })], categories, rules, now: 1_000 })

    expect(spans[0]).toEqual(expect.objectContaining({ categoryId: 2, categoryName: 'Code' }))
  })

  it('is unaffected by the order rules are passed in, only by position', () => {
    const categories = [
      category({ id: 1, name: 'Distraction', rating: 'distracting' }),
      category({ id: 2, name: 'Code', rating: 'focus' }),
    ]
    const rules = [
      rule({ id: 1, categoryId: 1, appPattern: 'Code', position: 1 }),
      rule({ id: 2, categoryId: 2, appPattern: 'Code', position: 0 }),
    ]

    const { spans } = derive({ heartbeats: [heartbeat({ appName: 'Code' })], categories, rules, now: 1_000 })

    expect(spans[0]).toEqual(expect.objectContaining({ categoryId: 2 }))
  })

  it('re-derives with an edited rule set, reflecting the new categorization for the same heartbeats', () => {
    const heartbeats = [heartbeat({ appName: 'Code' })]
    const categories = [
      category({ id: 1, name: 'Code', rating: 'focus' }),
      category({ id: 2, name: 'Distraction', rating: 'distracting' }),
    ]

    const before = derive({
      heartbeats,
      categories,
      rules: [rule({ id: 1, categoryId: 1, appPattern: 'Code' })],
      now: 1_000,
    })
    expect(before.spans[0]).toEqual(expect.objectContaining({ categoryId: 1, rating: 'focus' }))

    // The user edits the rule to point at a different category — no migration,
    // the same stored heartbeats just re-derive differently (ADR-0001).
    const after = derive({
      heartbeats,
      categories,
      rules: [rule({ id: 1, categoryId: 2, appPattern: 'Code' })],
      now: 1_000,
    })
    expect(after.spans[0]).toEqual(expect.objectContaining({ categoryId: 2, rating: 'distracting' }))
  })
})

describe('derive project attribution', () => {
  it('assigns a null project when no rules are given', () => {
    const heartbeats = [heartbeat({ appName: 'Code' })]

    const { spans } = derive({ heartbeats, now: 1_000 })

    expect(spans[0]).toEqual(expect.objectContaining({ projectId: null, projectName: null }))
  })

  it('assigns a null project when the winning rule does not set one', () => {
    const heartbeats = [heartbeat({ appName: 'Code' })]
    const categories = [category({ id: 1, name: 'Code', rating: 'focus' })]
    const rules = [rule({ id: 1, categoryId: 1, projectId: null, appPattern: 'Code' })]

    const { spans } = derive({ heartbeats, categories, rules, now: 1_000 })

    expect(spans[0]).toEqual(expect.objectContaining({ projectId: null, projectName: null }))
  })

  it('attributes a span to the project assigned by the winning rule, independent of its category', () => {
    const heartbeats = [heartbeat({ appName: 'Figma' })]
    const categories = [category({ id: 1, name: 'Design', rating: 'focus' })]
    const projects = [project({ id: 1, name: 'Acme Website', client: 'Acme Corp' })]
    const rules = [rule({ id: 1, categoryId: 1, projectId: 1, appPattern: 'Figma' })]

    const { spans } = derive({ heartbeats, categories, projects, rules, now: 1_000 })

    expect(spans[0]).toEqual(
      expect.objectContaining({
        categoryId: 1,
        categoryName: 'Design',
        projectId: 1,
        projectName: 'Acme Website',
      }),
    )
  })

  it('re-derives project attribution when the winning rule is edited', () => {
    const heartbeats = [heartbeat({ appName: 'Figma' })]
    const categories = [category({ id: 1, name: 'Design', rating: 'focus' })]
    const projects = [
      project({ id: 1, name: 'Acme Website', client: 'Acme Corp' }),
      project({ id: 2, name: 'Personal Site', client: null }),
    ]

    const before = derive({
      heartbeats,
      categories,
      projects,
      rules: [rule({ id: 1, categoryId: 1, projectId: 1, appPattern: 'Figma' })],
      now: 1_000,
    })
    expect(before.spans[0]).toEqual(expect.objectContaining({ projectId: 1, projectName: 'Acme Website' }))

    // No migration — the same stored heartbeats just re-derive with the edited Rule (ADR-0001).
    const after = derive({
      heartbeats,
      categories,
      projects,
      rules: [rule({ id: 1, categoryId: 1, projectId: 2, appPattern: 'Figma' })],
      now: 1_000,
    })
    expect(after.spans[0]).toEqual(expect.objectContaining({ projectId: 2, projectName: 'Personal Site' }))
  })
})

describe('derive overrides', () => {
  it('wins over a conflicting rule for the overlapping span', () => {
    const heartbeats = [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 1_000 })]
    const categories = [
      category({ id: 1, name: 'Code', rating: 'focus' }),
      category({ id: 2, name: 'Distraction', rating: 'distracting' }),
    ]
    const rules = [rule({ id: 1, categoryId: 1, appPattern: 'Code' })]
    const overrides = [override({ id: 9, startedAt: 0, endedAt: 1_000, categoryId: 2 })]

    const { spans } = derive({ heartbeats, categories, rules, overrides, now: 1_000 })

    expect(spans).toEqual([
      expect.objectContaining({ categoryId: 2, categoryName: 'Distraction', rating: 'distracting', overrideId: 9 }),
    ])
  })

  it('survives a rule edit — the sticky override still wins after the rule changes', () => {
    const heartbeats = [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 1_000 })]
    const categories = [
      category({ id: 1, name: 'Code', rating: 'focus' }),
      category({ id: 2, name: 'Distraction', rating: 'distracting' }),
    ]
    const overrides = [override({ startedAt: 0, endedAt: 1_000, categoryId: 2 })]

    const before = derive({
      heartbeats,
      categories,
      rules: [rule({ id: 1, categoryId: 1, appPattern: 'Code' })],
      overrides,
      now: 1_000,
    })
    expect(before.spans[0]).toEqual(expect.objectContaining({ categoryId: 2 }))

    // The user edits the rule; the sticky Override for this exact time range still wins (ADR-0001).
    const after = derive({
      heartbeats,
      categories,
      rules: [rule({ id: 1, categoryId: 1, appPattern: 'Code', titlePattern: 'Anything' })],
      overrides,
      now: 1_000,
    })
    expect(after.spans[0]).toEqual(expect.objectContaining({ categoryId: 2 }))
  })

  it('does not affect spans outside its time range', () => {
    const heartbeats = [
      heartbeat({ appName: 'Code', startedAt: 0, endedAt: 1_000 }),
      heartbeat({ appName: 'Slack', startedAt: 5_000, endedAt: 6_000 }),
    ]
    const categories = [category({ id: 1, name: 'Code', rating: 'focus' })]
    const overrides = [override({ startedAt: 0, endedAt: 1_000, categoryId: 1 })]

    const { spans } = derive({ heartbeats, categories, overrides, now: 6_000 })

    expect(spans[1]).toEqual(
      expect.objectContaining({ appName: 'Slack', categoryId: null, categoryName: 'Uncategorized', overrideId: null }),
    )
  })

  it('overrides the project independently of the category', () => {
    const heartbeats = [heartbeat({ appName: 'Figma', startedAt: 0, endedAt: 1_000 })]
    const categories = [category({ id: 1, name: 'Design', rating: 'focus' })]
    const projects = [
      project({ id: 1, name: 'Acme Website', client: null }),
      project({ id: 2, name: 'Personal', client: null }),
    ]
    const rules = [rule({ id: 1, categoryId: 1, projectId: 1, appPattern: 'Figma' })]
    const overrides = [override({ startedAt: 0, endedAt: 1_000, categoryId: 1, projectId: 2 })]

    const { spans } = derive({ heartbeats, categories, projects, rules, overrides, now: 1_000 })

    expect(spans[0]).toEqual(expect.objectContaining({ projectId: 2, projectName: 'Personal' }))
  })
})

describe('derive manual entries', () => {
  it('inserts a manual entry as a span merged with derived spans', () => {
    const categories = [category({ id: 1, name: 'Meetings', rating: 'neutral' })]
    const entries = [manualEntry({ id: 7, startedAt: 10_000, endedAt: 13_000, label: 'Client call', categoryId: 1 })]

    const { spans } = derive({ heartbeats: [], categories, manualEntries: entries, now: 13_000 })

    expect(spans).toEqual([
      expect.objectContaining({
        startedAt: 10_000,
        endedAt: 13_000,
        appName: 'Client call',
        categoryId: 1,
        categoryName: 'Meetings',
        manualEntryId: 7,
        overrideId: null,
      }),
    ])
  })

  it('sorts a manual entry into position among derived spans', () => {
    const heartbeats = [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 1_000 })]
    const categories = [category({ id: 1, name: 'Meetings', rating: 'neutral' })]
    const entries = [manualEntry({ startedAt: 5_000, endedAt: 6_000, label: 'Call', categoryId: 1 })]

    const { spans } = derive({ heartbeats, categories, manualEntries: entries, now: 6_000 })

    expect(spans.map((s) => s.appName)).toEqual(['Code', 'Call'])
  })

  it('leaves manualEntryId null on heartbeat-derived spans', () => {
    const heartbeats = [heartbeat({ appName: 'Code' })]

    const { spans } = derive({ heartbeats, now: 1_000 })

    expect(spans[0].manualEntryId).toBeNull()
  })

  it('attributes a manual entry to a project', () => {
    const categories = [category({ id: 1, name: 'Meetings', rating: 'neutral' })]
    const projects = [project({ id: 1, name: 'Acme Website', client: null })]
    const entries = [manualEntry({ startedAt: 0, endedAt: 1_000, categoryId: 1, projectId: 1 })]

    const { spans } = derive({ heartbeats: [], categories, projects, manualEntries: entries, now: 1_000 })

    expect(spans[0]).toEqual(expect.objectContaining({ projectId: 1, projectName: 'Acme Website' }))
  })
})

describe('derive discard', () => {
  it('excludes a span overlapping a discarded time range', () => {
    const heartbeats = [
      heartbeat({ appName: 'Code', startedAt: 0, endedAt: 1_000 }),
      heartbeat({ appName: 'Slack', startedAt: 2_000, endedAt: 3_000 }),
    ]
    const discardedSpans = [discardedSpan({ startedAt: 0, endedAt: 1_000 })]

    const { spans } = derive({ heartbeats, discardedSpans, now: 3_000 })

    expect(spans).toHaveLength(1)
    expect(spans[0]).toEqual(expect.objectContaining({ appName: 'Slack' }))
  })

  it('does not touch the underlying heartbeats — discard only affects derived output', () => {
    const heartbeats = [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 1_000 })]
    const discardedSpans = [discardedSpan({ startedAt: 0, endedAt: 1_000 })]

    derive({ heartbeats, discardedSpans, now: 1_000 })

    expect(heartbeats).toHaveLength(1)
  })

  it('discards a manual entry the same way as a derived span', () => {
    const categories = [category({ id: 1, name: 'Meetings', rating: 'neutral' })]
    const entries = [manualEntry({ startedAt: 0, endedAt: 1_000, categoryId: 1 })]
    const discardedSpans = [discardedSpan({ startedAt: 0, endedAt: 1_000 })]

    const { spans } = derive({ heartbeats: [], categories, manualEntries: entries, discardedSpans, now: 1_000 })

    expect(spans).toEqual([])
  })

  it('does not exclude a span that merely abuts a discarded range', () => {
    const heartbeats = [heartbeat({ appName: 'Code', startedAt: 1_000, endedAt: 2_000 })]
    const discardedSpans = [discardedSpan({ startedAt: 0, endedAt: 1_000 })]

    const { spans } = derive({ heartbeats, discardedSpans, now: 2_000 })

    expect(spans).toHaveLength(1)
  })
})

const MIN = 60_000

describe('derive idle and breaks', () => {
  it('leaves a span untouched when idleSeconds is under the threshold', () => {
    const heartbeats = [heartbeat({ startedAt: 0, endedAt: 10 * MIN, idleSeconds: 4 * 60 })]

    const { spans, breaks } = derive({ heartbeats, now: 10 * MIN })

    expect(breaks).toEqual([])
    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 10 * MIN })])
  })

  it('turns a 5-60 minute idle tail into a Break and trims the active span', () => {
    // 20 minutes of activity, idle for the trailing 10 minutes.
    const heartbeats = [heartbeat({ startedAt: 0, endedAt: 20 * MIN, idleSeconds: 10 * 60 })]

    const { spans, breaks } = derive({ heartbeats, now: 20 * MIN })

    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 10 * MIN })])
    expect(breaks).toEqual([{ startedAt: 10 * MIN, endedAt: 20 * MIN }])
  })

  it('discards an idle tail over 60 minutes instead of forming a Break', () => {
    // 5 active minutes followed by a 65-minute idle tail (over the 60-min Break cap).
    const heartbeats = [heartbeat({ startedAt: 0, endedAt: 70 * MIN, idleSeconds: 65 * 60 })]

    const { spans, breaks } = derive({ heartbeats, now: 70 * MIN })

    expect(breaks).toEqual([])
    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 5 * MIN })])
  })

  it('discards a gap between heartbeats (sleep/lock) without forming a Break, regardless of length', () => {
    // The tracker closes the open heartbeat on suspend and only resumes on
    // wake, so a real gap between heartbeats represents sleep/lock — even a
    // short nap must never become a Break.
    const heartbeats = [
      heartbeat({ appName: 'Code', startedAt: 0, endedAt: 5 * MIN, idleSeconds: 0 }),
      heartbeat({ appName: 'Code', startedAt: 15 * MIN, endedAt: 20 * MIN, idleSeconds: 0 }),
    ]

    const { spans, breaks } = derive({ heartbeats, now: 20 * MIN })

    expect(breaks).toEqual([])
    expect(spans).toEqual([
      expect.objectContaining({ startedAt: 0, endedAt: 5 * MIN }),
      expect.objectContaining({ startedAt: 15 * MIN, endedAt: 20 * MIN }),
    ])
  })

  it('suppresses idle-to-gap for a Presence-without-input category', () => {
    const heartbeats = [heartbeat({ appName: 'Zoom', startedAt: 0, endedAt: 20 * MIN, idleSeconds: 10 * 60 })]
    const categories = [category({ id: 1, name: 'Video Conferencing', rating: 'neutral' })]
    const rules = [rule({ id: 1, categoryId: 1, appPattern: 'Zoom' })]

    const { spans, breaks } = derive({
      heartbeats,
      categories,
      rules,
      config: { presenceWithoutInputCategoryIds: [1] },
      now: 20 * MIN,
    })

    expect(breaks).toEqual([])
    expect(spans).toEqual([expect.objectContaining({ startedAt: 0, endedAt: 20 * MIN })])
  })
})

describe('derive focus sessions', () => {
  it('forms a Focus Session once the rolling window hits exactly the purity threshold', () => {
    const focusCategory = category({ id: 1, name: 'Code', rating: 'focus' })
    const neutralCategory = category({ id: 2, name: 'Email', rating: 'neutral' })
    const categories = [focusCategory, neutralCategory]
    const rules = [
      rule({ id: 1, categoryId: 1, appPattern: 'Code' }),
      rule({ id: 2, categoryId: 2, appPattern: 'Email', position: 1 }),
    ]
    // 11.25 focus-rated minutes followed by 3.75 neutral minutes = exactly
    // 75% of the default 15-minute window.
    const heartbeats = [
      heartbeat({ appName: 'Code', startedAt: 0, endedAt: 11.25 * MIN }),
      heartbeat({ appName: 'Email', startedAt: 11.25 * MIN, endedAt: 15 * MIN }),
    ]

    const { focusSessions } = derive({ heartbeats, categories, rules, now: 15 * MIN })

    expect(focusSessions).toEqual([{ startedAt: 0, endedAt: 15 * MIN }])
  })

  it('does not form a Focus Session just under the purity threshold', () => {
    const categories = [category({ id: 1, name: 'Code', rating: 'focus' }), category({ id: 2, name: 'Email', rating: 'neutral' })]
    const rules = [
      rule({ id: 1, categoryId: 1, appPattern: 'Code' }),
      rule({ id: 2, categoryId: 2, appPattern: 'Email', position: 1 }),
    ]
    // 11 focus minutes + 4 neutral minutes = 73.3%, just short of 75%.
    const heartbeats = [
      heartbeat({ appName: 'Code', startedAt: 0, endedAt: 11 * MIN }),
      heartbeat({ appName: 'Email', startedAt: 11 * MIN, endedAt: 15 * MIN }),
    ]

    const { focusSessions } = derive({ heartbeats, categories, rules, now: 15 * MIN })

    expect(focusSessions).toEqual([])
  })

  it('does not break a session when switching among Focus-rated apps', () => {
    const categories = [category({ id: 1, name: 'Focus', rating: 'focus' })]
    const rules = [rule({ id: 1, categoryId: 1, appPattern: 'Focus' })]
    // Six 5-minute blocks (30 min total), alternating app identity, all Focus-rated.
    const heartbeats = Array.from({ length: 6 }, (_, i) =>
      heartbeat({ appName: `Focus App ${i}`, startedAt: i * 5 * MIN, endedAt: (i + 1) * 5 * MIN }),
    )

    const { focusSessions } = derive({ heartbeats, categories, rules, now: 30 * MIN })

    expect(focusSessions).toHaveLength(1)
    expect(focusSessions[0].endedAt).toBe(30 * MIN)
  })

  it('returns no focus sessions when there are no spans', () => {
    const { focusSessions } = derive({ heartbeats: [], now: 0 })

    expect(focusSessions).toEqual([])
  })

  it('computes workModeState from the Working Hours schedule (#24)', () => {
    // Mon Jan 5 2026 is a Monday (Date#getDay() === 1).
    const workingHours = { 1: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] }

    const duringHours = derive({ heartbeats: [], workingHours, now: new Date(2026, 0, 5, 10).getTime() })
    expect(duringHours.workModeState.isOn).toBe(true)

    const outsideHours = derive({ heartbeats: [], workingHours, now: new Date(2026, 0, 5, 18).getTime() })
    expect(outsideHours.workModeState.isOn).toBe(false)
  })

  it('lets a manual Work Mode override win over the schedule (#24)', () => {
    const workingHours = { 1: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] }
    const workModeOverride = { value: true, setAt: new Date(2026, 0, 5, 18).getTime() }

    const { workModeState } = derive({
      heartbeats: [],
      workingHours,
      workModeOverride,
      now: new Date(2026, 0, 5, 19).getTime(),
    })

    expect(workModeState.isOn).toBe(true)
    expect(workModeState.overridden).toBe(true)
  })
})

describe('derive Focus Quality Score', () => {
  const focusCategory = category({ id: 1, name: 'Code', rating: 'focus' })
  const neutralCategory = category({ id: 2, name: 'Email', rating: 'neutral' })
  const distractingCategory = category({ id: 3, name: 'Social Media', rating: 'distracting' })
  const categories = [focusCategory, neutralCategory, distractingCategory]
  const rules = [
    rule({ id: 1, categoryId: 1, appPattern: 'Code' }),
    rule({ id: 2, categoryId: 2, appPattern: 'Email', position: 1 }),
    rule({ id: 3, categoryId: 3, appPattern: 'Twitter', position: 2 }),
  ]
  // Work Mode gates the score (like every other judgment feature), so tests
  // that aren't specifically about the work-hours boundary open every day
  // around the clock.
  const ALL_DAY_RANGE = [{ startMinute: 0, endMinute: 24 * 60 }]
  const ALL_DAY_WORKING_HOURS = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [day, ALL_DAY_RANGE]))

  it('is 0 with a zeroed breakdown when there is no active time', () => {
    const { focusQualityScore, focusQualityBreakdown } = derive({ heartbeats: [], now: 0 })

    expect(focusQualityScore).toBe(0)
    expect(focusQualityBreakdown).toEqual({ focusRatio: 0, distractionPenalty: 0, focusContinuity: 0 })
  })

  it('raises the score as the focus ratio rises, holding distraction and continuity fixed', () => {
    // A single continuous block, all-Focus vs. half-Focus/half-Neutral —
    // neither forms a real Focus Session distinction since both are pure
    // ratings throughout, isolating the ratio's own contribution.
    const mostlyFocus = derive({
      heartbeats: [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 20 * MIN })],
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      now: 20 * MIN,
    })
    const halfFocus = derive({
      heartbeats: [
        heartbeat({ appName: 'Code', startedAt: 0, endedAt: 10 * MIN }),
        heartbeat({ appName: 'Email', startedAt: 10 * MIN, endedAt: 20 * MIN }),
      ],
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      now: 20 * MIN,
    })

    expect(mostlyFocus.focusQualityBreakdown.focusRatio).toBe(1)
    expect(halfFocus.focusQualityBreakdown.focusRatio).toBe(0.5)
    expect(mostlyFocus.focusQualityScore).toBeGreaterThan(halfFocus.focusQualityScore)
  })

  it('lowers the score as the distraction penalty rises, holding the focus ratio fixed', () => {
    const noDistraction = derive({
      heartbeats: [
        heartbeat({ appName: 'Code', startedAt: 0, endedAt: 10 * MIN }),
        heartbeat({ appName: 'Email', startedAt: 10 * MIN, endedAt: 20 * MIN }),
      ],
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      now: 20 * MIN,
    })
    const withDistraction = derive({
      heartbeats: [
        heartbeat({ appName: 'Code', startedAt: 0, endedAt: 10 * MIN }),
        heartbeat({ appName: 'Twitter', startedAt: 10 * MIN, endedAt: 20 * MIN }),
      ],
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      now: 20 * MIN,
    })

    expect(noDistraction.focusQualityBreakdown.focusRatio).toBe(withDistraction.focusQualityBreakdown.focusRatio)
    expect(noDistraction.focusQualityBreakdown.distractionPenalty).toBe(0)
    expect(withDistraction.focusQualityBreakdown.distractionPenalty).toBe(0.5)
    expect(withDistraction.focusQualityScore).toBeLessThan(noDistraction.focusQualityScore)
  })

  it('raises the score as focus continuity rises, holding ratio and distraction penalty fixed', () => {
    // Both scenarios spend 15 focus-minutes and 10 neutral-minutes (ratio
    // 0.6, no distraction) over 25 minutes. Continuous: one 15-min Focus
    // block then Neutral — the rolling window hits 100% purity and a Focus
    // Session forms, capturing all 15 focus-minutes. Fragmented: alternating
    // 3-min Focus / 2-min Neutral blocks hold a steady 60% rolling purity —
    // always under the 75% threshold, so no Focus Session ever forms.
    const continuous = derive({
      heartbeats: [
        heartbeat({ appName: 'Code', startedAt: 0, endedAt: 15 * MIN }),
        heartbeat({ appName: 'Email', startedAt: 15 * MIN, endedAt: 25 * MIN }),
      ],
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      now: 25 * MIN,
    })

    const fragmentedHeartbeats: Heartbeat[] = []
    for (let unit = 0; unit < 5; unit++) {
      const unitStart = unit * 5 * MIN
      fragmentedHeartbeats.push(heartbeat({ appName: 'Code', startedAt: unitStart, endedAt: unitStart + 3 * MIN }))
      fragmentedHeartbeats.push(
        heartbeat({ appName: 'Email', startedAt: unitStart + 3 * MIN, endedAt: unitStart + 5 * MIN }),
      )
    }
    const fragmented = derive({ heartbeats: fragmentedHeartbeats, categories, rules, workingHours: ALL_DAY_WORKING_HOURS, now: 25 * MIN })

    expect(continuous.focusQualityBreakdown.focusRatio).toBe(0.6)
    expect(fragmented.focusQualityBreakdown.focusRatio).toBe(0.6)
    expect(continuous.focusQualityBreakdown.distractionPenalty).toBe(0)
    expect(fragmented.focusQualityBreakdown.distractionPenalty).toBe(0)

    expect(continuous.focusQualityBreakdown.focusContinuity).toBe(1)
    expect(fragmented.focusQualityBreakdown.focusContinuity).toBe(0)
    expect(continuous.focusQualityScore).toBe(80)
    expect(fragmented.focusQualityScore).toBe(60)
  })

  it('does not penalize a switch-heavy-but-focused day — continuity matches a single-app equivalent', () => {
    const singleApp = derive({
      heartbeats: [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 45 * MIN })],
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      now: 45 * MIN,
    })
    // Three 15-minute blocks (45 min total), alternating window identity, all Focus-rated.
    const switchHeavy = derive({
      heartbeats: Array.from({ length: 3 }, (_, i) =>
        heartbeat({ appName: 'Code', windowTitle: `File ${i}`, startedAt: i * 15 * MIN, endedAt: (i + 1) * 15 * MIN }),
      ),
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      now: 45 * MIN,
    })

    expect(switchHeavy.focusQualityBreakdown).toEqual(singleApp.focusQualityBreakdown)
    expect(switchHeavy.focusQualityScore).toBe(singleApp.focusQualityScore)
  })

  it('scopes the score to Work Mode hours, excluding activity outside them', () => {
    // Mon Jan 5 2026 is a Monday; Working Hours are 9:00-17:00.
    const workingHours = { 1: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] }
    const heartbeats = [
      heartbeat({ appName: 'Code', startedAt: new Date(2026, 0, 5, 10).getTime(), endedAt: new Date(2026, 0, 5, 10, 10).getTime() }),
      heartbeat({ appName: 'Twitter', startedAt: new Date(2026, 0, 5, 20).getTime(), endedAt: new Date(2026, 0, 5, 20, 10).getTime() }),
    ]

    const { focusQualityBreakdown, focusQualityScore } = derive({
      heartbeats,
      categories,
      rules,
      workingHours,
      now: new Date(2026, 0, 5, 21).getTime(),
    })

    // Only the in-hours Focus span counts; the off-hours Distracting span is excluded entirely.
    expect(focusQualityBreakdown.focusRatio).toBe(1)
    expect(focusQualityBreakdown.distractionPenalty).toBe(0)
    expect(focusQualityScore).toBe(80)
  })
})

describe('derive Distraction Nudge (#26)', () => {
  const focusCategory = category({ id: 1, name: 'Code', rating: 'focus' })
  const neutralCategory = category({ id: 2, name: 'Email', rating: 'neutral' })
  const distractingCategory = category({ id: 3, name: 'Social Media', rating: 'distracting' })
  const categories = [focusCategory, neutralCategory, distractingCategory]
  const rules = [
    rule({ id: 1, categoryId: 1, appPattern: 'Code' }),
    rule({ id: 2, categoryId: 2, appPattern: 'Email', position: 1 }),
    rule({ id: 3, categoryId: 3, appPattern: 'Twitter', position: 2 }),
  ]
  const ALL_DAY_RANGE = [{ startMinute: 0, endMinute: 24 * 60 }]
  const ALL_DAY_WORKING_HOURS = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [day, ALL_DAY_RANGE]))

  it('is eligible at exactly the 75%/15-min boundary, while Work Mode is on', () => {
    // 11.25 distracting minutes + 3.75 neutral minutes = exactly 75% of the default 15-minute window.
    const heartbeats = [
      heartbeat({ appName: 'Twitter', startedAt: 0, endedAt: 11.25 * MIN }),
      heartbeat({ appName: 'Email', startedAt: 11.25 * MIN, endedAt: 15 * MIN }),
    ]

    const { dueSignals } = derive({ heartbeats, categories, rules, workingHours: ALL_DAY_WORKING_HOURS, now: 15 * MIN })

    expect(dueSignals.nudge).toBe(true)
  })

  it('is not eligible just under the 75% boundary', () => {
    // 11 distracting minutes + 4 neutral minutes = 73.3%, just short of 75%.
    const heartbeats = [
      heartbeat({ appName: 'Twitter', startedAt: 0, endedAt: 11 * MIN }),
      heartbeat({ appName: 'Email', startedAt: 11 * MIN, endedAt: 15 * MIN }),
    ]

    const { dueSignals } = derive({ heartbeats, categories, rules, workingHours: ALL_DAY_WORKING_HOURS, now: 15 * MIN })

    expect(dueSignals.nudge).toBe(false)
  })

  it('is never eligible while Work Mode is off', () => {
    const heartbeats = [heartbeat({ appName: 'Twitter', startedAt: 0, endedAt: 15 * MIN })]

    const { dueSignals } = derive({ heartbeats, categories, rules, now: 15 * MIN })

    expect(dueSignals.nudge).toBe(false)
  })

  it('excludes idle time from counting as Distracting, diluting the window instead of tripping it', () => {
    // 5 distracting minutes, then a 10-minute idle tail (carved into a Break, not a Span).
    const heartbeats = [heartbeat({ appName: 'Twitter', startedAt: 0, endedAt: 15 * MIN, idleSeconds: 10 * 60 })]

    const { dueSignals } = derive({ heartbeats, categories, rules, workingHours: ALL_DAY_WORKING_HOURS, now: 15 * MIN })

    expect(dueSignals.nudge).toBe(false)
  })

  it('respects the ~10-minute cooldown since it last fired', () => {
    const heartbeats = [heartbeat({ appName: 'Twitter', startedAt: 0, endedAt: 30 * MIN })]

    const withinCooldown = derive({
      heartbeats,
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      lastNudgeFiredAt: 25 * MIN,
      now: 30 * MIN,
    })
    const afterCooldown = derive({
      heartbeats,
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      lastNudgeFiredAt: 19 * MIN,
      now: 30 * MIN,
    })

    expect(withinCooldown.dueSignals.nudge).toBe(false)
    expect(afterCooldown.dueSignals.nudge).toBe(true)
  })
})

describe('derive Break Reminder (#26)', () => {
  const focusCategory = category({ id: 1, name: 'Code', rating: 'focus' })
  const neutralCategory = category({ id: 2, name: 'Email', rating: 'neutral' })
  const categories = [focusCategory, neutralCategory]
  const rules = [rule({ id: 1, categoryId: 1, appPattern: 'Code' }), rule({ id: 2, categoryId: 2, appPattern: 'Email', position: 1 })]
  const ALL_DAY_RANGE = [{ startMinute: 0, endMinute: 24 * 60 }]
  const ALL_DAY_WORKING_HOURS = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [day, ALL_DAY_RANGE]))

  it('is eligible once accumulated Focus-rated time reaches the default 120-minute block', () => {
    const heartbeats = [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 120 * MIN })]

    const { dueSignals } = derive({ heartbeats, categories, rules, workingHours: ALL_DAY_WORKING_HOURS, now: 120 * MIN })

    expect(dueSignals.breakReminder).toBe(true)
  })

  it('is not eligible just under the 120-minute block', () => {
    const heartbeats = [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 119 * MIN })]

    const { dueSignals } = derive({ heartbeats, categories, rules, workingHours: ALL_DAY_WORKING_HOURS, now: 119 * MIN })

    expect(dueSignals.breakReminder).toBe(false)
  })

  it('does not let Neutral time count toward the accumulator, but does not reset it either', () => {
    // 60 Focus minutes, 10 Neutral minutes, 60 more Focus minutes — no gap, so Neutral just doesn't add.
    const heartbeats = [
      heartbeat({ appName: 'Code', startedAt: 0, endedAt: 60 * MIN }),
      heartbeat({ appName: 'Email', startedAt: 60 * MIN, endedAt: 70 * MIN }),
      heartbeat({ appName: 'Code', startedAt: 70 * MIN, endedAt: 130 * MIN }),
    ]

    const { dueSignals } = derive({ heartbeats, categories, rules, workingHours: ALL_DAY_WORKING_HOURS, now: 130 * MIN })

    expect(dueSignals.breakReminder).toBe(true)
  })

  it('resets the accumulator to zero after an Idle gap ≥5 min', () => {
    const config = { breakReminderThresholdMs: 20 * MIN }
    const heartbeats = [
      heartbeat({ appName: 'Code', startedAt: 0, endedAt: 15 * MIN }),
      // A different identity so it doesn't merge with the Focus spans either
      // side of it; fully idle, so it carves out a Break resetting the accumulator.
      heartbeat({ appName: 'Idle Screen', startedAt: 15 * MIN, endedAt: 20 * MIN, idleSeconds: 5 * 60 }),
      heartbeat({ appName: 'Code', startedAt: 20 * MIN, endedAt: 40 * MIN }),
    ]

    // Only 15 of the last 20 minutes (since the reset) are Focus-rated — under the threshold,
    // even though 30 Focus-rated minutes exist across the whole history.
    const stillAccumulating = derive({ heartbeats, categories, rules, workingHours: ALL_DAY_WORKING_HOURS, config, now: 35 * MIN })
    expect(stillAccumulating.dueSignals.breakReminder).toBe(false)

    const afterReset = derive({ heartbeats, categories, rules, workingHours: ALL_DAY_WORKING_HOURS, config, now: 40 * MIN })
    expect(afterReset.dueSignals.breakReminder).toBe(true)
  })

  it('is never eligible while Work Mode is off', () => {
    const heartbeats = [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 120 * MIN })]

    const { dueSignals } = derive({ heartbeats, categories, rules, now: 120 * MIN })

    expect(dueSignals.breakReminder).toBe(false)
  })

  it('stays ineligible while snoozed', () => {
    const heartbeats = [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 120 * MIN })]

    const { dueSignals } = derive({
      heartbeats,
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      breakReminderSnoozedUntil: 130 * MIN,
      now: 120 * MIN,
    })

    expect(dueSignals.breakReminder).toBe(false)
  })

  it('does not re-signal within the same accumulation block once it has already fired', () => {
    const heartbeats = [heartbeat({ appName: 'Code', startedAt: 0, endedAt: 130 * MIN })]

    const { dueSignals } = derive({
      heartbeats,
      categories,
      rules,
      workingHours: ALL_DAY_WORKING_HOURS,
      lastBreakReminderFiredAt: 120 * MIN,
      now: 130 * MIN,
    })

    expect(dueSignals.breakReminder).toBe(false)
  })
})
