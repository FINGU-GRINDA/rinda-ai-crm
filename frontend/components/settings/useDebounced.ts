import { useEffect, useMemo, useRef } from 'react';

type AnyFn = (...args: unknown[]) => void;

export interface DebouncedFn<T extends AnyFn> {
  (...args: Parameters<T>): void;
  flush: () => void;
  cancel: () => void;
}

export function useDebounced<T extends AnyFn>(fn: T, ms = 600): DebouncedFn<T> {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const debounced = useMemo<DebouncedFn<T>>(() => {
    const wrapped = ((...args: Parameters<T>) => {
      lastArgsRef.current = args;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const a = lastArgsRef.current;
        if (a) fnRef.current(...a);
      }, ms);
    }) as DebouncedFn<T>;

    wrapped.flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const a = lastArgsRef.current;
      if (a) fnRef.current(...a);
    };

    wrapped.cancel = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lastArgsRef.current = null;
    };

    return wrapped;
  }, [ms]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debounced;
}
