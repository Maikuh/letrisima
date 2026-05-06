export function timestamp(): string {
	return new Date().toISOString()
}

export function errBody(message: string, details?: string | Record<string, unknown>) {
	return {
		status: 'error' as const,
		error: { message, ...(details !== undefined ? { details } : {}), timestamp: timestamp() },
	}
}

export function jsonError(
	message: string,
	status: number,
	details?: string | Record<string, unknown>,
): Response {
	return new Response(JSON.stringify(errBody(message, details)), {
		status,
		headers: { 'Content-Type': 'application/json' },
	})
}
