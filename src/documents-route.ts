import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  fetchFedexDocument,
  isFedexDocumentUrl,
  safeDocumentFilename,
} from './fedex/documents.js'
import { FedexApiError } from './fedex/errors.js'

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  response.end(payload)
}

/**
 * GET /documents?url=<fedex document url>&filename=label.pdf[&download=1]
 *
 * Fetches a temporary FedEx document and streams it back as a PDF/PNG/... so a
 * browser link opens the file instead of FedEx's XML/JSON error envelope.
 */
export async function handleDocumentsRoute(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, {
      allow: 'GET, HEAD',
      'content-type': 'text/plain; charset=utf-8',
    })
    response.end('Method Not Allowed\n')
    return
  }

  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const fedexUrl = requestUrl.searchParams.get('url')

  if (!fedexUrl || !isFedexDocumentUrl(fedexUrl)) {
    sendJson(response, 400, {
      error: 'Provide a valid HTTPS FedEx document URL in the url parameter.',
    })
    return
  }

  try {
    const document = await fetchFedexDocument(fedexUrl)
    const filename = safeDocumentFilename(
      requestUrl.searchParams.get('filename'),
      document.contentType,
    )
    const disposition =
      requestUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'

    response.writeHead(200, {
      'content-type': document.contentType,
      'content-length': document.bytes.length,
      'content-disposition': `${disposition}; filename="${filename}"`,
      'cache-control': 'private, max-age=300',
      'x-content-type-options': 'nosniff',
    })

    if (request.method === 'HEAD') {
      response.end()
    } else {
      response.end(document.bytes)
    }
  } catch (error) {
    const status =
      error instanceof FedexApiError && error.status >= 400 ? error.status : 502
    sendJson(response, status, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
