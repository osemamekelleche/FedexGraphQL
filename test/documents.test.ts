import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDocumentProxyUrl,
  documentExtension,
  extensionForContentType,
  isFedexDocumentUrl,
  safeDocumentFilename,
} from '../src/fedex/documents.js'

test('accepts only HTTPS FedEx document URLs', () => {
  assert.equal(
    isFedexDocumentUrl(
      'https://www.fedex.com/document/v2/document/retrieve/SH,123_SHIPPING_P?isLabel=true',
    ),
    true,
  )
  assert.equal(
    isFedexDocumentUrl(
      'https://wwwtest.fedex.com/document/v1/cache/retrieve/SH,123_SHIPPING_P',
    ),
    true,
  )

  assert.equal(isFedexDocumentUrl('http://www.fedex.com/document/retrieve/x'), false)
  assert.equal(isFedexDocumentUrl('https://evilfedex.com/document/retrieve/x'), false)
  assert.equal(isFedexDocumentUrl('https://fedex.com.evil.test/document/retrieve/x'), false)
  assert.equal(isFedexDocumentUrl('https://www.fedex.com/other/retrieve/x'), false)
  assert.equal(isFedexDocumentUrl('not a url'), false)
})

test('derives safe filenames from request or content type', () => {
  assert.equal(safeDocumentFilename('label-123.pdf', 'application/pdf'), 'label-123.pdf')
  assert.equal(safeDocumentFilename('../../etc/passwd', 'application/pdf'), '_.._etc_passwd')
  assert.equal(safeDocumentFilename('', 'application/pdf'), 'label.pdf')
  assert.equal(safeDocumentFilename(null, 'image/png'), 'label.png')
  assert.equal(safeDocumentFilename(undefined, 'application/octet-stream'), 'label.bin')
})

test('maps content types to file extensions', () => {
  assert.equal(extensionForContentType('application/pdf; charset=binary'), 'pdf')
  assert.equal(extensionForContentType('image/png'), 'png')
  assert.equal(extensionForContentType('image/jpeg'), 'jpg')
  assert.equal(extensionForContentType('application/octet-stream'), 'bin')
})

test('maps FedEx document types to file extensions', () => {
  assert.equal(documentExtension('PDF'), 'pdf')
  assert.equal(documentExtension('png'), 'png')
  assert.equal(documentExtension('ZPLII'), 'zpl')
  assert.equal(documentExtension('EPL2'), 'epl')
  assert.equal(documentExtension(undefined), 'bin')
})

test('builds a local proxy URL for a FedEx document', () => {
  const fedexUrl = 'https://www.fedex.com/document/v2/document/retrieve/SH,123?isLabel=true'
  const proxy = new URL(buildDocumentProxyUrl(fedexUrl, 'label-123.pdf'))

  assert.equal(proxy.pathname, '/documents')
  assert.equal(proxy.searchParams.get('url'), fedexUrl)
  assert.equal(proxy.searchParams.get('filename'), 'label-123.pdf')
})
