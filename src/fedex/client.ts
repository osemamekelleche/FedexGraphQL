import { randomUUID } from 'node:crypto'
import { config, requireCredentials } from '../config.js'
import { FedexApiError, FedexAuthError, collectErrorMessages } from './errors.js'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface TokenCache {
  accessToken: string
  expiresAt: number
}

interface TokenResponse {
  access_token?: unknown
  expires_in?: unknown
}

/** Refresh a little before FedEx actually expires the token. */
const TOKEN_SAFETY_WINDOW_MS = 60_000

let tokenCache: TokenCache | null = null
let inFlightTokenRequest: Promise<string> | null = null

async function requestNewToken(): Promise<TokenCache> {
  const { clientId, clientSecret } = requireCredentials()

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    })
  } catch (error) {
    throw new FedexAuthError(
      `Could not reach FedEx OAuth endpoint at ${config.baseUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  const text = await response.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // Keep the raw text; the status/error handling below will surface it.
  }

  if (!response.ok) {
    const messages = collectErrorMessages(body)
    throw new FedexAuthError(
      `FedEx OAuth failed (HTTP ${response.status}): ${
        messages.join('; ') || response.statusText || 'no response body'
      }`,
    )
  }

  const token = (body ?? {}) as TokenResponse
  if (typeof token.access_token !== 'string' || token.access_token.length === 0) {
    throw new FedexAuthError('FedEx OAuth response did not contain an access_token.')
  }

  const lifetimeSeconds =
    typeof token.expires_in === 'number' && token.expires_in > 0 ? token.expires_in : 3600

  return {
    accessToken: token.access_token,
    expiresAt: Date.now() + lifetimeSeconds * 1000,
  }
}

export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && tokenCache && tokenCache.expiresAt - TOKEN_SAFETY_WINDOW_MS > Date.now()) {
    return tokenCache.accessToken
  }

  // Coalesce concurrent callers into a single token request.
  if (!inFlightTokenRequest) {
    inFlightTokenRequest = requestNewToken()
      .then((next) => {
        tokenCache = next
        return next.accessToken
      })
      .finally(() => {
        inFlightTokenRequest = null
      })
  }

  return inFlightTokenRequest
}

export function getTokenStatus(): { cached: boolean; expiresAt: string | null } {
  if (!tokenCache) return { cached: false, expiresAt: null }
  return { cached: true, expiresAt: new Date(tokenCache.expiresAt).toISOString() }
}

async function send(
  method: HttpMethod,
  path: string,
  body: unknown,
  accessToken: string,
): Promise<{ response: Response; parsed: unknown }> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    accept: 'application/json',
    'x-locale': config.locale,
    'x-customer-transaction-id': randomUUID(),
  }

  if (body !== undefined) {
    headers['content-type'] = 'application/json'
  }

  let response: Response
  try {
    response = await fetch(new URL(path, config.baseUrl), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    })
  } catch (error) {
    throw new FedexApiError(
      `FedEx request to ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
      0,
      null,
    )
  }

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  return { response, parsed }
}

/**
 * Call a FedEx REST endpoint with automatic OAuth token handling.
 * Retries once with a fresh token if FedEx rejects the cached one (HTTP 401).
 */
export async function fedexRequest<T = unknown>(
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  let accessToken = await getAccessToken()
  let result = await send(method, path, body, accessToken)

  if (result.response.status === 401) {
    accessToken = await getAccessToken(true)
    result = await send(method, path, body, accessToken)
  }

  if (!result.response.ok) {
    const messages = collectErrorMessages(result.parsed)
    const detail =
      messages.join('; ') ||
      result.response.statusText ||
      (typeof result.parsed === 'string' ? result.parsed : 'no response body')

    throw new FedexApiError(
      `FedEx ${method} ${path} failed (HTTP ${result.response.status}): ${detail}`,
      result.response.status,
      result.parsed,
    )
  }

  return result.parsed as T
}
