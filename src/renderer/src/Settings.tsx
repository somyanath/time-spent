import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, ProductivityRating, Rule } from '../../shared/category'

const RATING_LABEL: Record<ProductivityRating, string> = {
  focus: 'Focus',
  neutral: 'Neutral',
  distracting: 'Distracting',
}

/**
 * Category and Rule management (#18). Rules and Categories are the only
 * inputs this slice's `derive()` categorization layer reads, so this is
 * where the user shapes it: define Categories with a Productivity Rating,
 * then author ordered Rules mapping app/title/url patterns to a Category.
 */
export function Settings(): JSX.Element {
  const api = typeof window !== 'undefined' ? window.timeTracker : undefined

  const [categories, setCategories] = useState<Category[]>([])
  const [rules, setRules] = useState<Rule[]>([])

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryRating, setNewCategoryRating] = useState<ProductivityRating>('neutral')

  const [newRuleCategoryId, setNewRuleCategoryId] = useState<number | ''>('')
  const [newRuleAppPattern, setNewRuleAppPattern] = useState('')
  const [newRuleTitlePattern, setNewRuleTitlePattern] = useState('')
  const [newRuleUrlPattern, setNewRuleUrlPattern] = useState('')

  async function refresh(): Promise<void> {
    if (!api) return
    const [nextCategories, nextRules] = await Promise.all([api.listCategories(), api.listRules()])
    setCategories(nextCategories)
    setRules(nextRules)
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (newRuleCategoryId === '' && categories.length > 0) {
      setNewRuleCategoryId(categories[0].id)
    }
  }, [categories, newRuleCategoryId])

  async function handleAddCategory(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api || newCategoryName.trim() === '') return
    await api.createCategory(newCategoryName.trim(), newCategoryRating)
    setNewCategoryName('')
    setNewCategoryRating('neutral')
    await refresh()
  }

  async function handleDeleteCategory(id: number): Promise<void> {
    if (!api) return
    await api.deleteCategory(id)
    await refresh()
  }

  async function handleAddRule(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!api || newRuleCategoryId === '') return
    const appPattern = newRuleAppPattern.trim() || null
    const titlePattern = newRuleTitlePattern.trim() || null
    const urlPattern = newRuleUrlPattern.trim() || null
    if (!appPattern && !titlePattern && !urlPattern) return

    await api.createRule({ categoryId: newRuleCategoryId, appPattern, titlePattern, urlPattern })
    setNewRuleAppPattern('')
    setNewRuleTitlePattern('')
    setNewRuleUrlPattern('')
    await refresh()
  }

  async function handleDeleteRule(id: number): Promise<void> {
    if (!api) return
    await api.deleteRule(id)
    await refresh()
  }

  async function handleMoveRule(index: number, direction: -1 | 1): Promise<void> {
    if (!api) return
    const target = index + direction
    if (target < 0 || target >= rules.length) return
    const reordered = [...rules]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    await api.reorderRules(reordered.map((rule) => rule.id))
    await refresh()
  }

  function categoryName(id: number): string {
    return categories.find((c) => c.id === id)?.name ?? 'Unknown'
  }

  return (
    <section className="settings" aria-labelledby="settings-heading">
      <header className="settings__header">
        <h1 id="settings-heading" className="settings__title">
          Settings
        </h1>
      </header>

      <section className="settings__section" aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="settings__section-title">
          Categories
        </h2>

        {categories.length > 0 && (
          <ul className="settings__list" aria-label="Categories">
            {categories.map((category) => (
              <li key={category.id} className="settings__list-item">
                <span className={`settings__rating-dot settings__rating-dot--${category.rating}`} aria-hidden="true" />
                <span className="settings__list-item-name">{category.name}</span>
                <span className="settings__list-item-meta">{RATING_LABEL[category.rating]}</span>
                <button type="button" className="settings__delete" onClick={() => handleDeleteCategory(category.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="settings__form" onSubmit={handleAddCategory}>
          <input
            type="text"
            placeholder="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            aria-label="New category name"
          />
          <select
            value={newCategoryRating}
            onChange={(e) => setNewCategoryRating(e.target.value as ProductivityRating)}
            aria-label="New category rating"
          >
            <option value="focus">Focus</option>
            <option value="neutral">Neutral</option>
            <option value="distracting">Distracting</option>
          </select>
          <button type="submit">Add Category</button>
        </form>
      </section>

      <section className="settings__section" aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="settings__section-title">
          Rules
        </h2>
        <p className="settings__section-hint">
          Matched in order, top to bottom — the first matching Rule assigns a Span's Category.
        </p>

        {rules.length > 0 && (
          <ol className="settings__list" aria-label="Rules">
            {rules.map((rule, index) => (
              <li key={rule.id} className="settings__list-item">
                <span className="settings__list-item-name">{categoryName(rule.categoryId)}</span>
                <span className="settings__list-item-meta">
                  {[
                    rule.appPattern && `app: "${rule.appPattern}"`,
                    rule.titlePattern && `title: "${rule.titlePattern}"`,
                    rule.urlPattern && `url: "${rule.urlPattern}"`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </span>
                <button
                  type="button"
                  className="settings__reorder"
                  onClick={() => handleMoveRule(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move rule for ${categoryName(rule.categoryId)} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="settings__reorder"
                  onClick={() => handleMoveRule(index, 1)}
                  disabled={index === rules.length - 1}
                  aria-label={`Move rule for ${categoryName(rule.categoryId)} down`}
                >
                  ↓
                </button>
                <button type="button" className="settings__delete" onClick={() => handleDeleteRule(rule.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ol>
        )}

        <form className="settings__form" onSubmit={handleAddRule}>
          <select
            value={newRuleCategoryId}
            onChange={(e) => setNewRuleCategoryId(Number(e.target.value))}
            aria-label="New rule category"
            disabled={categories.length === 0}
          >
            {categories.length === 0 && <option value="">Add a category first</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="App pattern (e.g. Code)"
            value={newRuleAppPattern}
            onChange={(e) => setNewRuleAppPattern(e.target.value)}
            aria-label="New rule app pattern"
          />
          <input
            type="text"
            placeholder="Title pattern"
            value={newRuleTitlePattern}
            onChange={(e) => setNewRuleTitlePattern(e.target.value)}
            aria-label="New rule title pattern"
          />
          <input
            type="text"
            placeholder="URL pattern"
            value={newRuleUrlPattern}
            onChange={(e) => setNewRuleUrlPattern(e.target.value)}
            aria-label="New rule url pattern"
          />
          <button type="submit" disabled={categories.length === 0}>
            Add Rule
          </button>
        </form>
      </section>
    </section>
  )
}
