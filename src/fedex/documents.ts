import { config } from '../config.js'
import { getAccessToken } from './client.js'
import { FedexApiError } from './errors.js'

/**
 * FedEx label/document URLs are temporary (about 24 hours), sometimes point at
 * an internal host, and cannot be relied on to render as a PDF in a browser.
 * These helpers let the GraphQL server fetch the document and hand the bytes
 * back, turning FedEx's XML/JSON error envelope into a readable failure.
 */

const FEDEX_DOCUMENT_HOSTS = ['fedex.com']

function isFedexHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return FEDEX_DOCUMENT_HOSTS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  )
}

/** Only allow HTTPS FedEx document URLs so the proxy cannot be used for SSRF. */
export function isFedexDocumentUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  return (
    url.protocol === 'https:' &&
    isFedexHost(url.hostname) &&
    url.pathname.toLowerCase().startsWith('/document/')
  )
}

export function extensionForContentType(contentType: string): string {
  const lower = contentType.toLowerCase()
  if (lower.includes('pdf')) return 'pdf'
  if (lower.includes('png')) return 'png'
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg'
  return 'bin'
}

/** Keep user-supplied filenames from becoming paths or header injection. */
export function safeDocumentFilename(
  filename: string | null | undefined,
  contentType: string,
): string {
  const cleaned = (filename ?? '')
    .replace(/[^\w.-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120)

  return cleaned || `label.${extensionForContentType(contentType)}`
}

export function documentExtension(docType: string | null | undefined): string {
  switch (docType?.toUpperCase()) {
    case 'PDF':
      return 'pdf'
    case 'PNG':
      return 'png'
    case 'ZPLII':
      return 'zpl'
    case 'EPL2':
      return 'epl'
    default:
      return 'bin'
  }
}

/** Build the URL clients should use instead of the raw FedEx document URL. */
export function buildDocumentProxyUrl(
  fedexUrl: string,
  filename = 'label.pdf',
): string {
  const base = config.publicBaseUrl.replace(/\/+$/, '')
  const query = new URLSearchParams({ url: fedexUrl, filename })
  return `${base}/documents?${query.toString()}`
}

function summarizeDocumentError(text: string): string {
  const match =
    /<Message>([\s\S]*?)<\/Message>/i.exec(text)?.[1] ??
    /"message"\s*:\s*"([^"]+)"/i.exec(text)?.[1] ??
    text

  const clean = match
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return clean.slice(0, 500) || 'no response body'
}

/**
 * Some sandbox responses use a host that only resolves inside FedEx's network.
 * Fall back to the publicly reachable test/production document hosts.
 */
function documentCandidateUrls(fedexUrl: string): string[] {
  const url = new URL(fedexUrl)
  const candidates = [url.toString()]

  if (url.hostname.toLowerCase() === 'wwwdev.idev.fedex.com') {
    for (const hostname of ['wwwtest.fedex.com', 'www.fedex.com']) {
      const candidate = new URL(url)
      candidate.hostname = hostname
      candidates.push(candidate.toString())
    }
  }

  return candidates
}

async function requestDocument(
  url: string,
  accessToken?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    accept: 'application/pdf,image/png,application/octet-stream,*/*',
    'x-locale': config.locale,
  }
  if (accessToken) headers.authorization = `Bearer ${accessToken}`

  try {
    return await fetch(url, {
      headers,
      signal: AbortSignal.timeout(config.timeoutMs),
    })
  } catch (error) {
    throw new FedexApiError(
      `Could not reach the FedEx document URL: ${
        error instanceof Error ? error.message : String(error)
      }`,
      0,
      null,
    )
  }
}

export interface FedexDocument {
  bytes: Buffer
  contentType: string
}

/**
 * Download a FedEx document. The URL itself is the credential, but some
 * environments still expect the OAuth token, so retry with one on 401/403.
 */
export async function fetchFedexDocument(fedexUrl: string): Promise<FedexDocument> {
  if (!isFedexDocumentUrl(fedexUrl)) {
    throw new FedexApiError(
      'Refusing to download a document that is not an HTTPS FedEx document URL.',
      400,
      null,
    )
  }

  let lastError: FedexApiError | null = null

  for (const candidate of documentCandidateUrls(fedexUrl)) {
    try {
      let response = await requestDocument(candidate)

      if (response.status === 401 || response.status === 403) {
        const accessToken = await getAccessToken()
        response = await requestDocument(candidate, accessToken)
      }

      const bytes = Buffer.from(await response.arrayBuffer())
      const contentType = response.headers.get('content-type') ?? ''

      if (!response.ok) {
        const text = bytes.toString('utf8')
        lastError = new FedexApiError(
          `FedEx document download failed (HTTP ${response.status}): ${summarizeDocumentError(text)}`,
          response.status,
          text.slice(0, 2000),
        )
        // A real FedEx response means the key/host is wrong, not unreachable;
        // trying the other hosts would just repeat the same error.
        break
      }

      // FedEx sometimes answers a document request with an XML/JSON error
      // envelope and HTTP 200. Treat that as a failure instead of serving it.
      if (/^(application|text)\/(xml|json|html)\b/i.test(contentType)) {
        const text = bytes.toString('utf8')
        lastError = new FedexApiError(
          `FedEx returned an error instead of a document: ${summarizeDocumentError(text)}`,
          502,
          text.slice(0, 2000),
        )
        break
      }

      return {
        bytes,
        contentType: contentType || 'application/pdf',
      }
    } catch (error) {
      if (error instanceof FedexApiError) {
        lastError = error
        continue
      }
      throw error
    }
  }

  throw (
    lastError ??
    new FedexApiError('Unable to download the FedEx document.', 502, null)
  )
}
