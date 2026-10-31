/**
 * Host half of `dsh-document-path-copy`: inert.
 *
 * The feature is entirely in the browser half (`client.js`), which DSH serves
 * from this package's `exports["./client"]`. This module exists only so the
 * bundle row has something to mount.
 */
export const name = 'document-path-copy'

export function apply() {}
