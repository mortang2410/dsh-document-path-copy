/**
 * Host half of `dsh-document-path-copy`: inert.
 *
 * The feature is entirely in the browser half (`client.js`), which DSH serves
 * from this package's `exports["./client"]`. This module exists only so the
 * bundle row has something to mount.
 *
 * The exported name is the bundle key, not the row id: the row id
 * (`document-path-copy`) identifies the mount, this name identifies the package
 * in every layer that reports a plugin by name.
 */
export const name = 'dsh-document-path-copy'

export function apply() {}
