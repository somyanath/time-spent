/**
 * The "what was this time for" dimension, orthogonal to Category (CONTEXT.md).
 * `client` is an attribute of the Project, not a separate level — group
 * Projects by client without a dedicated client entity.
 */
export interface Project {
  id: number
  name: string
  client: string | null
}
