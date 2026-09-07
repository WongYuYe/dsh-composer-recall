/**
 * Host half. Behavior is browser-only; the Loader still needs this entry so
 * the package can appear as a cordis.yml row and `dsh.client` can join the
 * web boot graph.
 */
export const name = 'dsh-composer-recall'
export const inject = []

export function apply() {}
