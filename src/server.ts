import { createServer } from 'node:http'
import { createYoga } from 'graphql-yoga'
import { ASSET_URL_PREFIX, handleAssetsRoute } from './assets.js'
import { config, credentialsConfigured } from './config.js'
import { handleDocumentsRoute } from './documents-route.js'
import { renderGraphiQLPage } from './graphiql.js'
import { schema } from './graphql/schema.js'
import { isGraphQLGetOperation } from './http.js'

const GRAPHQL_ENDPOINT = '/graphql'

const yoga = createYoga({
  schema,
  graphqlEndpoint: GRAPHQL_ENDPOINT,
  graphiql: { title: 'FedEx GraphQL' },
  renderGraphiQL: renderGraphiQLPage,
})

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const pathname = requestUrl.pathname.replace(/\/+$/, '') || '/'

  if (pathname.startsWith(ASSET_URL_PREFIX)) {
    void handleAssetsRoute(request, response, pathname).catch((error: unknown) => {
      console.error('Asset request failed:', error)
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      }
      response.end('Internal Server Error\n')
    })
    return
  }

  if (pathname === '/documents') {
    void handleDocumentsRoute(request, response).catch((error: unknown) => {
      console.error('Document request failed:', error)
      if (!response.headersSent) {
        response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
      }
      response.end(JSON.stringify({ error: 'Unable to download the FedEx document.' }))
    })
    return
  }

  if (
    pathname === GRAPHQL_ENDPOINT &&
    isGraphQLGetOperation(request.method, requestUrl, request.headers.accept)
  ) {
    const body = JSON.stringify({
      errors: [
        {
          message:
            'GraphQL operations must be sent as a POST body, not in the URL query string.',
        },
      ],
    })

    response.writeHead(405, {
      allow: 'POST, OPTIONS',
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store',
    })
    response.end(body)
    return
  }

  void Promise.resolve(yoga(request, response)).catch((error: unknown) => {
    console.error('Unhandled request error:', error)
    if (!response.headersSent) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    }
    response.end('Internal Server Error\n')
  })
})

server.listen(config.port, () => {
  console.log(`FedEx GraphQL wrapper running in ${config.environment} mode`)
  console.log(`FedEx REST base URL: ${config.baseUrl}`)
  console.log(`GraphiQL: http://localhost:${config.port}${GRAPHQL_ENDPOINT}`)

  if (!credentialsConfigured()) {
    console.warn(
      'FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET are not set. The schema is browsable, but FedEx calls will fail until they are configured.',
    )
  }
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
