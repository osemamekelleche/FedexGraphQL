const GRAPHQL_OPERATION_PARAMS = [
  'query',
  'operationName',
  'variables',
  'extensions',
] as const

/**
 * GraphQL over HTTP allows queries in the URL, but mutations and sensitive
 * variables should travel in the POST body. Return true when a request is
 * trying to run a GraphQL operation via GET.
 */
export function isGraphQLGetOperation(
  method: string | undefined,
  url: URL,
  accept?: string | null,
): boolean {
  if (method !== 'GET') return false

  // GraphiQL itself is served over GET. Let the HTML page load (even from an
  // older ?query=... URL); the page script removes those parameters.
  if (accept?.toLowerCase().includes('text/html')) return false

  return GRAPHQL_OPERATION_PARAMS.some((param) => url.searchParams.has(param))
}
