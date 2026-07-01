import { describe, expect, it } from 'vitest'
import { derive } from './derive'
import type { Category, Rule } from './category'
import type { Heartbeat } from './heartbeat'

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
  return { id: 1, categoryId: 1, position: 0, appPattern: null, titlePattern: null, urlPattern: null, ...overrides }
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
