// Silence logs in tests. Set TEST_LOG_LEVEL=debug (or any pino level) to re-enable.
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? 'silent'
