import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { GRAPHIQL_URL_CLEANUP_SCRIPT, renderGraphiQLPage } from '../src/graphiql.js'

test('renders local GraphiQL assets without CDN modules', () => {
  const html = renderGraphiQLPage({ title: 'Test', endpoint: '/graphql' })

  assert.match(html, /<link rel="stylesheet" href="\/assets\/graphiql\.css" \/>/)
  assert.match(html, /<script type="module" src="\/assets\/graphiql\.js"><\/script>/)
  assert.match(html, /\/assets\/workers\/editor\.worker\.js/)
  assert.match(html, /\/assets\/workers\/json\.worker\.js/)
  assert.match(html, /\/assets\/workers\/graphql\.worker\.js/)
  assert.doesNotMatch(html, /esm\.sh/)
  assert.doesNotMatch(html, /<script type="importmap">/)
})

test('defaults to an inline favicon so the browser does not request /favicon.ico', () => {
  const html = renderGraphiQLPage({ title: 'Test', endpoint: '/graphql' })

  assert.match(html, /<link rel="icon" href="data:," \/>/)
})

test('uses a favicon when one is provided', () => {
  const html = renderGraphiQLPage({ favicon: '/assets/favicon.png' })

  assert.match(html, /<link rel="icon" href="\/assets\/favicon\.png" \/>/)
  assert.doesNotMatch(html, /<link rel="icon" href="data:," \/>/)
})

test('sends every operation with POST and uses the configured endpoint', () => {
  const html = renderGraphiQLPage({ endpoint: '/custom-graphql' })

  assert.match(html, /window\.__FEDEX_GRAPHIQL_CONFIG__ = /)
  assert.match(html, /"endpoint":"\/custom-graphql"/)
  assert.doesNotMatch(html, /onEditQuery/)
  assert.doesNotMatch(html, /YogaGraphiQL/)
})

test('escapes the page title', () => {
  const html = renderGraphiQLPage({ title: '<script>alert(1)</script>' })

  assert.ok(html.includes('<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>'))
  assert.ok(!html.includes('<title><script>'))
})

test('cleanup script removes legacy operation params from the URL', () => {
  let replacedUrl = ''
  const context: Record<string, unknown> = {
    URL,
    location: {
      href: 'http://localhost:4000/graphql?query=abc&variables=%7B%7D&extensions=%7B%7D&keep=1',
    },
    history: {
      replaceState: (_state: unknown, _title: string, url: string) => {
        replacedUrl = url
      },
    },
  }

  vm.runInNewContext(GRAPHIQL_URL_CLEANUP_SCRIPT, context)

  assert.equal(replacedUrl, 'http://localhost:4000/graphql?keep=1')
})

test('cleanup script leaves clean URLs untouched', () => {
  let calls = 0
  const context: Record<string, unknown> = {
    URL,
    location: { href: 'http://localhost:4000/graphql?keep=1' },
    history: {
      replaceState: () => {
        calls += 1
      },
    },
  }

  vm.runInNewContext(GRAPHIQL_URL_CLEANUP_SCRIPT, context)

  assert.equal(calls, 0)
})
