import { GraphQLError } from 'graphql'

/** Thrown when FedEx credentials are missing or the OAuth token cannot be obtained. */
export class FedexAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FedexAuthError'
  }
}

/** Thrown when FedEx responds with a non-2xx HTTP status or the request cannot be made. */
export class FedexApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'FedexApiError'
    this.status = status
    this.body = body
  }
}

/** Pull the human-readable messages out of a FedEx errors envelope. */
export function collectErrorMessages(body: unknown): string[] {
  if (!body || typeof body !== 'object') return []

  const record = body as Record<string, unknown>
  const output =
    record.output && typeof record.output === 'object'
      ? (record.output as Record<string, unknown>)
      : undefined

  const errors = [
    ...(Array.isArray(record.errors) ? record.errors : []),
    ...(output && Array.isArray(output.errors) ? output.errors : []),
  ]

  const messages = errors
    .map((error) => {
      if (error && typeof error === 'object') {
        const message = (error as Record<string, unknown>).message
        return message == null ? '' : String(message)
      }
      return error == null ? '' : String(error)
    })
    .filter((message) => message.length > 0)

  return [...new Set(messages)]
}

/**
 * Convert any thrown value into a GraphQLError so clients get structured
 * transport/auth failures instead of a generic "Unexpected error".
 */
export function asGraphQLError(error: unknown): GraphQLError {
  if (error instanceof GraphQLError) return error

  if (error instanceof FedexAuthError) {
    return new GraphQLError(error.message, {
      extensions: { code: 'FEDEX_AUTH_ERROR' },
    })
  }

  if (error instanceof FedexApiError) {
    return new GraphQLError(error.message, {
      extensions: {
        code: 'FEDEX_API_ERROR',
        status: error.status,
        fedex: error.body,
      },
    })
  }

  const message = error instanceof Error ? error.message : String(error)
  return new GraphQLError(`Unexpected FedEx wrapper error: ${message}`, {
    extensions: { code: 'FEDEX_WRAPPER_ERROR' },
  })
}
