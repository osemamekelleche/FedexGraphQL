import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { getAsset, isSea } from 'node:sea'

export const ASSET_URL_PREFIX = '/assets/'

const CACHE_CONTROL = 'no-cache'
const cache = new Map<string, Buffer>()

let assetRoot: string | undefined

/**
 * Locate `public/assets` when the frontend files are not embedded in a single
 * executable. The server can be started from `src` (tsx), `dist` (tsc), or the
 * bundled CommonJS file in `build`, so check each plausible project layout.
 */
function resolveAssetRoot(): string {
  if (assetRoot) {
    return assetRoot
  }

  const candidates: string[] = []

  if (isSea()) {
    candidates.push(path.join(path.dirname(process.execPath), 'public', 'assets'))
  }

  const entry = process.argv[1]
  if (entry) {
    const entryDirectory = path.dirname(path.resolve(entry))
    candidates.push(path.join(entryDirectory, '..', 'public', 'assets'))
    candidates.push(path.join(entryDirectory, 'public', 'assets'))
  }

  candidates.push(path.resolve(process.cwd(), 'public', 'assets'))

  assetRoot = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
  return assetRoot
}

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.eot': 'application/vnd.ms-fontobject',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function contentType(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Turn `/assets/workers/editor.worker.js` into `workers/editor.worker.js`.
 * Anything that could escape the asset directory is rejected.
 */
function normalizeAssetPath(pathname: string): string | undefined {
  if (!pathname.startsWith(ASSET_URL_PREFIX)) {
    return undefined
  }

  const encoded = pathname.slice(ASSET_URL_PREFIX.length)

  if (!encoded) {
    return undefined
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(encoded)
  } catch {
    return undefined
  }

  if (!/^[A-Za-z0-9._/-]+$/.test(decoded)) {
    return undefined
  }

  const segments = decoded.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return undefined
  }

  return decoded
}

async function loadAsset(relativePath: string): Promise<Buffer | undefined> {
  const cached = cache.get(relativePath)
  if (cached) {
    return cached
  }

  let data: Buffer | undefined

  if (isSea()) {
    try {
      data = Buffer.from(getAsset(`public/assets/${relativePath}`))
    } catch {
      // Fall back to the filesystem below, which keeps the bundled CommonJS
      // build working when it is run outside a single executable application.
    }
  }

  if (!data) {
    try {
      data = await readFile(path.join(resolveAssetRoot(), relativePath))
    } catch {
      return undefined
    }
  }

  cache.set(relativePath, data)
  return data
}

export async function handleAssetsRoute(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  const method = request.method ?? 'GET'

  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, {
      allow: 'GET, HEAD',
      'content-type': 'text/plain; charset=utf-8',
    })
    response.end('Method Not Allowed\n')
    return
  }

  const relativePath = normalizeAssetPath(pathname)

  if (!relativePath) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not Found\n')
    return
  }

  const data = await loadAsset(relativePath)

  if (!data) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('Not Found\n')
    return
  }

  response.writeHead(200, {
    'content-type': contentType(relativePath),
    'content-length': data.length,
    'cache-control': CACHE_CONTROL,
    'x-content-type-options': 'nosniff',
  })

  if (method === 'HEAD') {
    response.end()
    return
  }

  response.end(data)
}
