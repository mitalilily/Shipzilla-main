import { type ComponentType, lazy } from 'react'

const RETRY_STORAGE_PREFIX = 'shipzilla:lazy-retry:'

type LazyModule<T extends ComponentType<any>> = Promise<{ default: T }>

const isChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '')

  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
    message,
  )
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importFunc: () => LazyModule<T>,
  cacheKey: string,
) {
  return lazy(async () => {
    const retryKey = `${RETRY_STORAGE_PREFIX}${cacheKey}`

    try {
      const moduleExports = await importFunc()

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(retryKey)
      }

      return moduleExports
    } catch (error) {
      if (
        typeof window !== 'undefined' &&
        isChunkLoadError(error) &&
        window.sessionStorage.getItem(retryKey) !== 'reloaded'
      ) {
        window.sessionStorage.setItem(retryKey, 'reloaded')
        window.location.reload()

        return new Promise<never>(() => {})
      }

      throw error
    }
  })
}
