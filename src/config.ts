import path from 'node:path'
import { isSea } from 'node:sea'
import { config as loadEnv } from 'dotenv'
import { FedexAuthError } from './fedex/errors.js'

/**
 * Load `.env` from:
 * 1. `DOTENV_CONFIG_PATH` when explicitly set
 * 2. the current working directory (normal Node usage)
 * 3. the executable's directory (so a standalone .exe works when launched
 *    from a shortcut or another directory)
 */
function loadEnvironment(): void {
  const paths: string[] = []
  const explicitPath = process.env.DOTENV_CONFIG_PATH?.trim()

  if (explicitPath) {
    paths.push(explicitPath)
  }

  paths.push(path.resolve(process.cwd(), '.env'))

  if (isSea()) {
    paths.push(path.join(path.dirname(process.execPath), '.env'))
  }

  loadEnv({ path: paths, quiet: true })
}

loadEnvironment()

export type FedexEnvironment = 'sandbox' | 'production'

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

const environment: FedexEnvironment =
  optional('FEDEX_ENVIRONMENT')?.toLowerCase() === 'production' ? 'production' : 'sandbox'

const defaultBaseUrl =
  environment === 'production' ? 'https://apis.fedex.com' : 'https://apis-sandbox.fedex.com'

const configuredTimeout = Number(optional('FEDEX_TIMEOUT_MS') ?? 30_000)
const port = Number(optional('PORT') ?? 4000)

export const config = {
  environment,
  baseUrl: (optional('FEDEX_BASE_URL') ?? defaultBaseUrl).replace(/\/+$/, ''),
  locale: optional('FEDEX_LOCALE') ?? 'en_US',
  accountNumber: optional('FEDEX_ACCOUNT_NUMBER'),
  port,
  /**
   * Public origin used to build clickable document links. Override this when
   * the server is reached through a host other than localhost (LAN, tunnel,
   * reverse proxy).
   */
  publicBaseUrl: (optional('PUBLIC_BASE_URL') ?? `http://localhost:${port}`).replace(/\/+$/, ''),
  timeoutMs:
    Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 30_000,
}

export function credentialsConfigured(): boolean {
  return Boolean(optional('FEDEX_CLIENT_ID') && optional('FEDEX_CLIENT_SECRET'))
}

export function requireCredentials(): { clientId: string; clientSecret: string } {
  const clientId = optional('FEDEX_CLIENT_ID')
  const clientSecret = optional('FEDEX_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    const missing = [
      ...(clientId ? [] : ['FEDEX_CLIENT_ID']),
      ...(clientSecret ? [] : ['FEDEX_CLIENT_SECRET']),
    ]
    throw new FedexAuthError(
      `Missing FedEx credentials: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in your FedEx developer project key and secret.',
    )
  }

  return { clientId, clientSecret }
}
