import pino from 'pino'
import { LOG_LEVEL } from './config'

const pinoLevel = LOG_LEVEL === 'WARNING' ? 'warn' : LOG_LEVEL.toLowerCase()

export const root = pino({
	level: pinoLevel,
	transport:
		process.env.NODE_ENV !== 'production'
			? { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } }
			: undefined,
})

export function getLogger(name: string) {
	const child = root.child({ name })
	return {
		debug: (msg: string) => child.debug(msg),
		info: (msg: string) => child.info(msg),
		warning: (msg: string) => child.warn(msg),
		error: (msg: string) => child.error(msg),
	}
}
