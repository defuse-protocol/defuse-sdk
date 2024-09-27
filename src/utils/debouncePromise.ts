interface FunctionWithArguments {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any): any
}

interface DebouncedFunction<F extends FunctionWithArguments> {
  (...args: Parameters<F>): Promise<ReturnType<F>>
}

type DebounceReturn<F extends FunctionWithArguments> = (
  ...args: Parameters<F>
) => Promise<ReturnType<F>>

export function debouncePromise<F extends FunctionWithArguments>(
  fn: F,
  ms: number
): DebounceReturn<F> {
  let timer: ReturnType<typeof setTimeout>

  const debouncedFunc: DebouncedFunction<F> = (...args) =>
    new Promise((resolve) => {
      if (timer) {
        clearTimeout(timer)
      }

      timer = setTimeout(() => {
        resolve(fn(...(args as unknown[])))
      }, ms)
    })

  return debouncedFunc
}
