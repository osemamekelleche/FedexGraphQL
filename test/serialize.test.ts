import assert from 'node:assert/strict'
import test from 'node:test'
import { GraphQLError } from 'graphql'
import {
  buildAddressValidationBody,
  buildCancelShipmentBody,
  buildCancelTagBody,
  buildCreateShipmentBody,
  buildCreateTagBody,
  type CreateShipmentInput,
} from '../src/graphql/serialize.js'

function createInput(overrides: Partial<CreateShipmentInput> = {}): CreateShipmentInput {
  return {
    accountNumber: '123456789',
    requestedShipment: {
      pickupType: 'USE_SCHEDULED_PICKUP',
      serviceType: 'FEDEX_GROUND',
      packagingType: 'YOUR_PACKAGING',
      shipper: {
        contact: { personName: 'Shipper', phoneNumber: '9015550100' },
        address: {
          streetLines: ['1 Main St'],
          city: 'Memphis',
          stateOrProvinceCode: 'TN',
          postalCode: '38101',
          countryCode: 'US',
        },
      },
      recipients: [
        {
          contact: { personName: 'Recipient', phoneNumber: '9015550101' },
          address: {
            streetLines: ['2 Main St'],
            city: 'Nashville',
            stateOrProvinceCode: 'TN',
            postalCode: '37201',
            countryCode: 'US',
          },
        },
      ],
      requestedPackageLineItems: [{ weight: { value: 2, units: 'LB' } }],
    },
    ...overrides,
  }
}

test('builds a create shipment payload with sensible defaults', () => {
  const body = buildCreateShipmentBody(createInput())

  assert.deepEqual(body.accountNumber, { value: '123456789' })
  assert.equal(body.labelResponseOptions, 'LABEL')

  const shipment = body.requestedShipment as Record<string, any>
  assert.deepEqual(shipment.shipper.accountNumber, { value: '123456789' })
  assert.equal(shipment.recipients[0].accountNumber, undefined)
  assert.deepEqual(shipment.shippingChargesPayment, { paymentType: 'SENDER' })
  assert.deepEqual(shipment.labelSpecification, {
    labelFormatType: 'COMMON2D',
    imageType: 'PDF',
    labelStockType: 'PAPER_4X6',
    resolution: 300,
  })
  assert.deepEqual(shipment.requestedPackageLineItems[0].weight, { value: 2, units: 'LB' })
})

test('falls back to the configured account number', () => {
  const body = buildCreateShipmentBody(createInput({ accountNumber: undefined }), '999')
  assert.deepEqual(body.accountNumber, { value: '999' })
})

test('throws a BAD_USER_INPUT GraphQLError when no account number is available', () => {
  assert.throws(
    () => buildCreateShipmentBody(createInput({ accountNumber: undefined })),
    (error: unknown) => {
      assert.ok(error instanceof GraphQLError)
      assert.equal(error.extensions.code, 'BAD_USER_INPUT')
      return true
    },
  )
})

test('builds cancel shipment defaults', () => {
  const body = buildCancelShipmentBody(
    { trackingNumber: '794953555571', senderCountryCode: 'US' },
    '123456789',
  )

  assert.deepEqual(body, {
    accountNumber: { value: '123456789' },
    trackingNumber: '794953555571',
    senderCountryCode: 'US',
    deletionControl: 'DELETE_ALL_PACKAGES',
  })
})

test('derives totalWeight and serializes the extended shipment fields', () => {
  const input = createInput()
  input.shipAction = 'CONFIRM'
  input.processingOptionType = 'ALLOW_ASYNCHRONOUS'
  input.oneLabelAtATime = true
  input.version = { major: 1, minor: 0, patch: 0 }
  input.requestedShipment.shipDatestamp = '2026-11-10'
  input.requestedShipment.totalDeclaredValue = { amount: 100, currency: 'USD' }
  input.requestedShipment.soldTo = {
    contact: { personName: 'Buyer' },
    address: { streetLines: ['3 Main St'], countryCode: 'US' },
  }
  input.requestedShipment.origin = {
    contact: { companyName: 'Origin Co' },
    address: { streetLines: ['4 Main St'], countryCode: 'US' },
  }
  input.requestedShipment.rateRequestType = ['ACCOUNT', 'PREFERRED']
  input.requestedShipment.preferredCurrency = 'USD'
  input.requestedShipment.totalPackageCount = 3
  input.requestedShipment.masterTrackingId = { trackingNumber: '794953535000' }
  input.requestedShipment.variationOptions = [{ id: 'VAR', values: ['A'] }]
  input.requestedShipment.requestedPackageLineItems = [
    {
      weight: { value: 2, units: 'LB' },
      contentRecord: [{ itemNumber: 'SKU-1', receivedQuantity: 2, description: 'Widget' }],
    },
    { weight: { value: 3, units: 'LB' } },
  ]

  const body = buildCreateShipmentBody(input)
  const shipment = body.requestedShipment as Record<string, any>

  assert.equal(body.shipAction, 'CONFIRM')
  assert.equal(body.processingOptionType, 'ALLOW_ASYNCHRONOUS')
  assert.equal(body.oneLabelAtATime, true)
  assert.deepEqual(body.version, { major: 1, minor: 0, patch: 0 })
  assert.equal(shipment.totalWeight, 5)
  assert.equal(shipment.shipDatestamp, '2026-11-10')
  assert.deepEqual(shipment.totalDeclaredValue, { amount: 100, currency: 'USD' })
  assert.equal(shipment.soldTo.contact.personName, 'Buyer')
  assert.equal(shipment.origin.contact.companyName, 'Origin Co')
  assert.deepEqual(shipment.rateRequestType, ['ACCOUNT', 'PREFERRED'])
  assert.equal(shipment.preferredCurrency, 'USD')
  assert.equal(shipment.totalPackageCount, 3)
  assert.deepEqual(shipment.masterTrackingId, { trackingNumber: '794953535000' })
  assert.deepEqual(shipment.variationOptions, [{ id: 'VAR', values: ['A'] }])
  assert.deepEqual(shipment.requestedPackageLineItems[0].contentRecord, [
    { itemNumber: 'SKU-1', receivedQuantity: 2, description: 'Widget' },
  ])
})

test('serializes typed pickup detail for return tags', () => {
  const input = createInput()
  input.requestedShipment.shipTimestamp = '2026-11-10'
  input.requestedShipment.pickupDetail = {
    readyPickupDateTime: '2026-11-10T09:00:00Z',
    latestPickupDateTime: '2026-11-10T17:00:00Z',
    requestType: 'FUTURE_DAY',
    requestSource: 'AUTOMATION',
  }

  const shipment = buildCreateTagBody(input).requestedShipment as Record<string, any>

  assert.equal(shipment.shipTimestamp, '2026-11-10')
  assert.deepEqual(shipment.pickupDetail, {
    readyPickupDateTime: '2026-11-10T09:00:00Z',
    latestPickupDateTime: '2026-11-10T17:00:00Z',
    requestType: 'FUTURE_DAY',
    requestSource: 'AUTOMATION',
  })
})

test('builds a cancel tag body from completedTagDetail', () => {
  const body = buildCancelTagBody(
    {
      shipmentId: '794953555571',
      serviceType: 'FEDEX_GROUND',
      completedTagDetail: {
        confirmationNumber: '275',
        location: 'NQAA',
        dispatchDate: '2026-11-10',
      },
    },
    '123456789',
  )

  assert.deepEqual(body, {
    accountNumber: { value: '123456789' },
    serviceType: 'FEDEX_GROUND',
    trackingNumber: '794953555571',
    completedTagDetail: {
      confirmationNumber: '275',
      location: 'NQAA',
      dispatchDate: '2026-11-10',
    },
  })
})

test('builds an address validation payload', () => {
  const body = buildAddressValidationBody({
    includeResolutionTokens: true,
    addressesToValidate: [
      {
        clientReferenceId: 'customer-1',
        address: {
          streetLines: ['10 FedEx Parkway'],
          city: 'Collierville',
          stateOrProvinceCode: 'TN',
          postalCode: '38017',
          countryCode: 'US',
        },
      },
    ],
  })

  assert.deepEqual(body.validateAddressControlParameters, { includeResolutionTokens: true })
  const addresses = body.addressesToValidate as Record<string, any>[]
  assert.equal(addresses[0].clientReferenceId, 'customer-1')
  assert.equal(addresses[0].address.countryCode, 'US')
})
