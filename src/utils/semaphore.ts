export class Semaphore {
  private queue: (() => void)[] = []
  private currentRequests = 0

  constructor(
    private maxConcurrent: number,
    private delayMs: number
  ) {}

  async acquire(): Promise<void> {
    if (this.currentRequests < this.maxConcurrent) {
      this.currentRequests++
      return
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    this.currentRequests--

    if (this.queue.length > 0) {
      const next = this.queue.shift()
      setTimeout(() => {
        this.currentRequests++
        // @ts-ignore: next is guaranteed to be defined here
        next()
      }, this.delayMs)
    }
  }
}
