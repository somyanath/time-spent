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
