import assert from 'node:assert/strict'
import test from 'node:test'
import { isGraphQLGetOperation } from '../src/http.js'

function url(value: string): URL {
  return new URL(value, 'http://localhost')
}

test('blocks GraphQL operations sent over GET', () => {
  assert.equal(isGraphQLGetOperation('GET', url('/graphql?query=%7BfedexHealth%7Benvironment%7D%7D')), true)
  assert.equal(isGraphQLGetOperation('GET', url('/graphql?operationName=Health')), true)
  assert.equal(isGraphQLGetOperation('GET', url('/graphql?variables=%7B%7D')), true)
  assert.equal(isGraphQLGetOperation('GET', url('/graphql?extensions=%7B%7D')), true)
})

test('allows GraphiQL and POST operations', () => {
  assert.equal(isGraphQLGetOperation('GET', url('/graphql')), false)
  assert.equal(isGraphQLGetOperation('POST', url('/graphql?query=%7BfedexHealth%7Benvironment%7D%7D')), false)
  assert.equal(isGraphQLGetOperation('OPTIONS', url('/graphql?query=x')), false)
  assert.equal(
    isGraphQLGetOperation(
      'GET',
      url('/graphql?query=mutation%20CreateShipment%20%7B%20__typename%20%7D'),
      'text/html,application/xhtml+xml',
    ),
    false,
  )
})
