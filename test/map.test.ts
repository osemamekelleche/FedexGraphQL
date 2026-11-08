import assert from 'node:assert/strict'
import test from 'node:test'
import {
  toAddressValidationResult,
  toCancelShipmentResult,
  toPostalValidationResult,
  toShipmentResult,
  toTagResult,
} from '../src/graphql/map.js'

test('maps a create shipment response including labels and amounts', () => {
  const raw = {
    transactionId: 'tx-1',
    customerTransactionId: 'order-1',
    output: {
      jobId: 'job-9',
      alerts: [{ alertType: 'NOTE', code: 'SHIPMENT.VALIDATION.SUCCESS', message: 'ok' }],
      transactionShipments: [
        {
          serviceType: 'FEDEX_GROUND',
          serviceName: 'FedEx Ground',
          serviceCategory: 'GROUND',
          shipDatestamp: '2026-11-07',
          masterTrackingNumber: '794953535000',
          completedShipmentDetail: { carrierCode: 'FDXG', usDomestic: true },
          shipmentAdvisoryDetails: { regulatoryAdvisory: [] },
          pieceResponses: [
            {
              trackingNumber: '794953535000',
              packageSequenceNumber: 1,
              serviceCategory: 'GROUND',
              acceptanceTrackingNumber: '794953535001',
              acceptanceType: 'ACTUAL',
              deliveryTimestamp: '2026-11-10T12:00:00Z',
              netChargeAmount: { amount: 12.34, currency: 'USD' },
              additionalChargesDiscount: 1.5,
              listCustomerTotalCharge: '15.25',
              customerReferences: [
                { customerReferenceType: 'P_O_NUMBER', value: 'PO-42' },
              ],
              packageDocuments: [
                {
                  contentKey: 'SH,123',
                  contentType: 'LABEL',
                  docType: 'PDF',
                  copiesToPrint: 1,
                  encodedLabel: 'JVBERi0xLjQK',
                  trackingNumber: '794953535000',
                  alerts: [{ alertType: 'NOTE', code: 'LABEL.OK', message: 'ok' }],
                  url: 'https://www.fedex.com/document/v2/document/retrieve/SH,123?isLabel=true',
                },
              ],
            },
          ],
          shipmentDocuments: [{ contentType: 'COMMERCIAL_INVOICE', docType: 'PDF' }],
        },
      ],
    },
  }

  const result = toShipmentResult(raw)

  assert.equal(result.transactionId, 'tx-1')
  assert.equal(result.jobId, 'job-9')
  assert.equal(result.shipments.length, 1)
  assert.equal(result.alerts[0].code, 'SHIPMENT.VALIDATION.SUCCESS')

  const shipment = result.shipments[0]
  assert.equal(shipment.masterTrackingNumber, '794953535000')
  assert.deepEqual(shipment.completedShipmentDetail, { carrierCode: 'FDXG', usDomestic: true })
  assert.deepEqual(shipment.shipmentAdvisoryDetails, { regulatoryAdvisory: [] })
  assert.equal(shipment.pieces[0].packageSequenceNumber, 1)
  assert.equal(shipment.pieces[0].serviceCategory, 'GROUND')
  assert.equal(shipment.pieces[0].acceptanceTrackingNumber, '794953535001')
  assert.equal(shipment.pieces[0].acceptanceType, 'ACTUAL')
  assert.equal(shipment.pieces[0].deliveryTimestamp, '2026-11-10T12:00:00Z')
  assert.equal(shipment.pieces[0].netChargeAmount, 12.34)
  assert.equal(shipment.pieces[0].additionalChargesDiscount, 1.5)
  assert.equal(shipment.pieces[0].listCustomerTotalCharge, '15.25')
  assert.deepEqual(shipment.pieces[0].customerReferences[0], {
    type: 'P_O_NUMBER',
    value: 'PO-42',
  })
  assert.equal(shipment.pieces[0].documents[0].contentKey, 'SH,123')
  assert.equal(shipment.pieces[0].documents[0].trackingNumber, '794953535000')
  assert.equal(shipment.pieces[0].documents[0].alerts[0].code, 'LABEL.OK')
  assert.equal(shipment.pieces[0].documents[0].encodedLabel, 'JVBERi0xLjQK')
  assert.equal(
    shipment.pieces[0].documents[0].fedexUrl,
    'https://www.fedex.com/document/v2/document/retrieve/SH,123?isLabel=true',
  )
  assert.match(shipment.pieces[0].documents[0].url ?? '', /\/documents\?url=/)
  assert.match(shipment.pieces[0].documents[0].url ?? '', /label-794953535000\.pdf/)
  assert.equal(shipment.shipmentDocuments[0].contentType, 'COMMERCIAL_INVOICE')
  assert.equal(shipment.shipmentDocuments[0].url, null)
  assert.equal(shipment.shipmentDocuments[0].fedexUrl, null)
})

test('maps a cancel response', () => {
  const result = toCancelShipmentResult({
    transactionId: 'tx-2',
    output: {
      cancelledShipment: true,
      cancelledHistory: false,
      message: 'Shipment is successfully cancelled',
    },
  })

  assert.equal(result.cancelledShipment, true)
  assert.equal(result.cancelledHistory, false)
  assert.equal(result.message, 'Shipment is successfully cancelled')
})

test('maps create and cancel tag responses', () => {
  const created = toTagResult({
    transactionId: 'tx-tag',
    output: {
      masterTrackingNumber: '794953535000',
      serviceType: 'FEDEX_GROUND',
      shipTimestamp: '2026-11-10',
      completedTagDetail: {
        confirmationNumber: '275',
        location: 'NQAA',
        dispatchDate: '2026-11-10',
      },
    },
  })

  assert.equal(created.masterTrackingNumber, '794953535000')
  assert.equal(created.confirmationNumber, '275')
  assert.equal(created.location, 'NQAA')

  const cancelled = toTagResult({
    transactionId: 'tx-cancel-tag',
    output: { cancelledTag: true, successMessage: 'success' },
  })

  assert.equal(cancelled.cancelledTag, true)
  assert.equal(cancelled.successMessage, 'success')
})

test('maps address validation output into typed addresses', () => {
  const result = toAddressValidationResult({
    transactionId: 'tx-address',
    customerTransactionId: 'order-address',
    output: {
      resolvedAddresses: [
        {
          clientReferenceId: 'primary',
          streetLinesToken: ['7372 PARKRIDGE BLVD', 'APT 286'],
          city: 'MEMPHIS',
          stateOrProvinceCode: 'TN',
          postalCode: '38118',
          countryCode: 'US',
          classification: 'BUSINESS',
          postOfficeBox: false,
          normalizedStatusNameDPV: true,
          standardizedStatusNameMatchSource: 'Postal',
          resolutionMethodName: 'USPS',
          ruralRouteHighwayContract: false,
          generalDelivery: false,
          customerMessage: [{ code: 'SUITE.NUMBER.REQUIRED', message: 'Suite required' }],
          cityToken: [{ changed: false, value: 'MEMPHIS' }],
          postalCodeToken: { changed: true, value: '38118' },
          parsedPostalCode: { base: '38118', addOn: '1234', deliveryPoint: '50' },
          attributes: { POBox: false, SuiteRequiredButMissing: 'true' },
          address: {
            streetLines: ['7372 PARKRIDGE'],
            city: 'MEMPHIS',
            stateOrProvinceCode: 'TN',
            postalCode: '38118',
            countryCode: 'US',
          },
        },
      ],
      alerts: [{ alertType: 'NOTE', code: 'ADDRESS.VALID', message: 'ok' }],
    },
  })

  assert.equal(result.transactionId, 'tx-address')
  assert.equal(result.customerTransactionId, 'order-address')
  assert.equal(result.resolvedAddresses.length, 1)
  assert.deepEqual(result.resolvedAddresses[0].streetLines, [
    '7372 PARKRIDGE BLVD',
    'APT 286',
  ])
  assert.equal(result.resolvedAddresses[0].customerMessage[0].code, 'SUITE.NUMBER.REQUIRED')
  assert.equal(result.resolvedAddresses[0].postalCodeToken?.changed, true)
  assert.deepEqual(result.resolvedAddresses[0].attributes, [
    { key: 'POBox', value: 'false' },
    { key: 'SuiteRequiredButMissing', value: 'true' },
  ])
  assert.deepEqual(result.resolvedAddresses[0].address?.streetLines, ['7372 PARKRIDGE'])
  assert.equal(result.alerts[0].message, 'ok')
})

test('maps postal validation output defensively', () => {
  const result = toPostalValidationResult({
    transactionId: 'tx-3',
    output: {
      postalCode: '38017',
      stateOrProvinceCode: 'TN',
      countryCode: 'US',
      postalCodeValid: true,
    },
  })

  assert.equal(result.valid, true)
  assert.equal(result.postalCode, '38017')
})
