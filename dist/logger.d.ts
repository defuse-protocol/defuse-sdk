/**
 * This should be a separate file, so SDK logging could be set up without loading all other modules
 */
type Context = Record<string, unknown>;
type Contexts = Record<string, Context | undefined>;
interface ILogger {
    /**
     * Use verbose for detailed execution flow tracking
     * Example: verbose('Preparing transaction', { amount: 100 })
     */
    verbose: (message: string, data?: Record<string, unknown>) => void;
    /**
     * Use info for significant operations
     * Example: info('Transaction sent successfully')
     */
    info: (message: string, context?: Contexts) => void;
    warn: (message: string, context?: Contexts) => void;
    error: (message: string | Error | unknown, context?: Contexts) => void;
}
declare let logger: ILogger;
declare function setLogger(newLogger: ILogger): void;

export { type Context, type Contexts, type ILogger, logger, setLogger };
