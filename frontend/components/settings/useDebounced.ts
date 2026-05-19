import { useEffect, useMemo, useRef } from "react"

type AnyFn = (...args: unknown[]) => void

export interface DebouncedFn<T extends AnyFn> {
  (...args: Parameters<T>): void
  flush: () => void
  cancel: () => void
}

export function useDebounced<T extends AnyFn>(fn: T, ms = 600): DebouncedFn<T> {
  const fnRef = useRef(fn)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastArgsRef = useRef<Parameters<T> | null>(null)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  const debounced = useMemo<DebouncedFn<T>>(() => {
    const wrapped = ((...args: Parameters<T>) => {
      lastArgsRef.current = args
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        const a = lastArgsRef.current
        if (a) fnRef.current(...a)
      }, ms)
    }) as DebouncedFn<T>

    // Flush only when an invocation is actually pending (timer still armed).
    // Without this guard, calling flush() after the debounced fn already fired
    // on its own would replay the last args and trigger duplicate side effects.
    wrapped.flush = () => {
      if (!timerRef.current) return
      clearTimeout(timerRef.current)
      timerRef.current = null
      const a = lastArgsRef.current
      lastArgsRef.current = null
      if (a) fnRef.current(...a)
    }

    wrapped.cancel = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      lastArgsRef.current = null
    }

    return wrapped
  }, [ms])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return debounced
}
