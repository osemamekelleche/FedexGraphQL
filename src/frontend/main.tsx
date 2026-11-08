import { createRoot } from 'react-dom/client'
import { GraphiQL } from 'graphiql'
import { createTransport } from '@graphiql/toolkit'
import 'graphiql/style.css'

interface GraphiQLWorkerUrls {
  editor: string
  json: string
  graphql: string
}

interface GraphiQLRuntimeConfig {
  endpoint: string
  workers: GraphiQLWorkerUrls
}

interface MonacoEnvironmentLike {
  getWorker(workerId: string, label: string): Worker
}

declare global {
  interface Window {
    __FEDEX_GRAPHIQL_CONFIG__?: GraphiQLRuntimeConfig
    MonacoEnvironment?: MonacoEnvironmentLike
  }
}

const runtime = window.__FEDEX_GRAPHIQL_CONFIG__
const endpoint = runtime?.endpoint ?? '/graphql'
const workers = runtime?.workers

if (workers) {
  window.MonacoEnvironment = {
    getWorker(_workerId, label) {
      const url =
        label === 'json'
          ? workers.json
          : label === 'graphql'
            ? workers.graphql
            : workers.editor

      return new Worker(url)
    },
  }
}

const container = document.getElementById('graphiql')

if (!container) {
  throw new Error('GraphiQL container element is missing.')
}

const transport = createTransport({
  url: endpoint,
  method: 'POST',
  supportedMethods: ['POST'],
})

createRoot(container).render(
  <GraphiQL transport={transport} defaultEditorToolsVisibility />,
)
