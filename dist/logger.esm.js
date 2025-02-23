/**
 * This should be a separate file, so SDK logging could be set up without loading all other modules
 */
const noopLogger = {
    verbose: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
};
let logger = { ...noopLogger };
function setLogger(newLogger) {
    logger = newLogger;
}

export { logger, setLogger };
//# sourceMappingURL=logger.esm.js.map
