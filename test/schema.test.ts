import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GraphQLEnumType,
  graphql,
  parse,
  validate,
  validateSchema,
} from 'graphql'
import { schema } from '../src/graphql/schema.js'

test('schema is valid', () => {
  assert.deepEqual(validateSchema(schema), [])
})

test('FedEx value sets are exposed as GraphQL enums for autocomplete', () => {
  const cases: Array<[string, string[]]> = [
    ['ServiceType', ['FEDEX_GROUND', 'PRIORITY_OVERNIGHT', 'INTERNATIONAL_PRIORITY']],
    ['PackagingType', ['YOUR_PACKAGING', 'FEDEX_BOX', 'FEDEX_PAK', 'FEDEX_ENVELOPE']],
    ['PickupType', ['USE_SCHEDULED_PICKUP', 'DROPOFF_AT_FEDEX_LOCATION']],
    ['PaymentType', ['SENDER', 'RECIPIENT', 'THIRD_PARTY', 'COLLECT']],
    ['ImageType', ['PDF', 'PNG', 'ZPLII', 'EPL2']],
    ['LabelStockType', ['PAPER_4X6', 'PAPER_7X475', 'PAPER_LETTER']],
    ['DeletionControl', ['DELETE_ALL_PACKAGES']],
    ['WeightUnit', ['LB', 'KG']],
    ['DimensionUnit', ['IN', 'CM']],
    ['TinType', ['FEDERAL', 'BUSINESS_NATIONAL']],
    ['PickupRequestType', ['FUTURE_DAY', 'SAME_DAY']],
    ['PickupRequestSourceType', ['AUTOMATION', 'CUSTOMER_SERVICE']],
    ['LabelRotation', ['LEFT', 'RIGHT', 'UPSIDE_DOWN', 'NONE']],
    ['LabelPrintingOrientation', ['BOTTOM_EDGE_OF_TEXT_FIRST', 'TOP_EDGE_OF_TEXT_FIRST']],
    ['ProcessingOptionType', ['SYNCHRONOUS_ONLY', 'ALLOW_ASYNCHRONOUS']],
    ['ShipAction', ['CONFIRM', 'TRANSFER']],
    ['RateRequestType', ['LIST', 'NONE', 'PREFERRED', 'ACCOUNT', 'INCENTIVE', 'RETAIL']],
    ['ReturnType', ['PENDING', 'PRINT_RETURN_LABEL']],
  ]

  for (const [name, expected] of cases) {
    const type = schema.getType(name)
    assert.ok(type instanceof GraphQLEnumType, `${name} should be an enum`)
    const values = type.getValues().map((value) => value.name)
    for (const value of expected) {
      assert.ok(values.includes(value), `${name} should contain ${value}`)
    }
  }
})

test('enum value sets match the Ship API spec exactly', () => {
  const cases: Array<[string, string[]]> = [
    ['PaymentType', ['COLLECT', 'RECIPIENT', 'SENDER', 'THIRD_PARTY']],
    ['DeletionControl', ['DELETE_ALL_PACKAGES']],
    ['WeightUnit', ['KG', 'LB']],
    ['DimensionUnit', ['CM', 'IN']],
    ['ImageType', ['EPL2', 'PDF', 'PNG', 'ZPLII']],
    ['LabelResponseOption', ['LABEL', 'URL_ONLY']],
  ]

  for (const [name, expected] of cases) {
    const type = schema.getType(name)
    assert.ok(type instanceof GraphQLEnumType, `${name} should be an enum`)
    const values = type.getValues().map((value) => value.name).sort()
    assert.deepEqual(values, expected)
  }
})

test('inline enum literals validate without quoting', () => {
  const document = parse(/* GraphQL */ `
    mutation {
      createShipment(
        input: {
          requestedShipment: {
            pickupType: USE_SCHEDULED_PICKUP
            serviceType: FEDEX_GROUND
            packagingType: YOUR_PACKAGING
            shipper: { contact: { personName: "Shipper" } }
            recipients: [{ contact: { personName: "Recipient" } }]
            requestedPackageLineItems: [{ weight: { value: 1, units: LB } }]
          }
        }
      ) {
        transactionId
      }
    }
  `)

  assert.deepEqual(validate(schema, document), [])
})

test('unknown enum literals are rejected', () => {
  const document = parse(/* GraphQL */ `
    mutation {
      createShipment(
        input: {
          requestedShipment: {
            pickupType: USE_SCHEDULED_PICKUP
            serviceType: NOT_A_REAL_SERVICE
            packagingType: YOUR_PACKAGING
            shipper: { contact: { personName: "Shipper" } }
            recipients: [{ contact: { personName: "Recipient" } }]
            requestedPackageLineItems: [{ weight: { value: 1, units: LB } }]
          }
        }
      ) {
        transactionId
      }
    }
  `)

  assert.ok(validate(schema, document).length > 0)
})

test('ship.json types are generated and no JSON pass-through remains', () => {
  for (const name of [
    'FedexMoney',
    'FedexMoneyInput',
    'FedexPackageSpecialServicesRequestedInput',
    'FedexCompletedCreateShipmentDetail',
    'FedexShipmentAdvisoryDetails',
  ]) {
    assert.ok(schema.getType(name), `${name} should exist`)
  }

  assert.equal(schema.getType('JSON'), undefined, 'the JSON scalar must not exist')

  for (const type of Object.values(schema.getTypeMap())) {
    if (type.name.startsWith('__') || !('getFields' in type)) continue
    for (const [fieldName, field] of Object.entries(type.getFields())) {
      assert.ok(
        !field.type.toString().includes('JSON'),
        `${type.name}.${fieldName} must not use JSON`,
      )
    }
  }
})

test('Track API operations expose generated request and response types', () => {
  const queryFields = schema.getQueryType()?.getFields() ?? {}
  const cases: Array<[string, string, string]> = [
    [
      'trackShipment',
      'FedexTrackFull_Schema_Tracking_NumbersInput',
      'FedexTrackTrkcResponseVO_TrackingNumber',
    ],
    [
      'trackByReferenceNumbers',
      'FedexTrackFull_Schema_Tracking_ReferencesInput',
      'FedexTrackTrkcResponseVO_ReferenceNumber',
    ],
    [
      'trackAssociatedShipments',
      'FedexTrackFull_Schema_Multiple_Piece_ShipmentInput',
      'FedexTrackTrkcResponseVO_Associated',
    ],
    ['trackByTcn', 'FedexTrackFull_Schema_TCNInput', 'FedexTrackTrkcResponseVO_TCN'],
    ['trackDocuments', 'FedexTrackFull_Schema_SPODInput', 'FedexTrackTrkcResponseVO_SPOD'],
  ]

  for (const [fieldName, inputType, outputType] of cases) {
    const field = queryFields[fieldName]
    assert.ok(field, `${fieldName} should exist`)
    assert.equal(field.args[0]?.type.toString(), `${inputType}!`)
    assert.equal(field.type.toString(), `${outputType}!`)
    assert.ok(schema.getType(inputType), `${inputType} should exist`)
    assert.ok(schema.getType(outputType), `${outputType} should exist`)
  }

  const mutationFields = schema.getMutationType()?.getFields() ?? {}
  const notification = mutationFields.sendTrackingNotifications
  assert.ok(notification, 'sendTrackingNotifications should exist')
  assert.equal(
    notification.args[0]?.type.toString(),
    'FedexTrackFull_Schema_NotificationInput!',
  )
  assert.equal(
    notification.type.toString(),
    'FedexTrackTrkcResponseVO_Notifications!',
  )

  for (const name of [
    'FedexTrackTrackingNumbersResponse',
    'FedexTrackCompleteTrackResult',
    'FedexTrackScanEvent',
    'FedexTrackSPODResponseVO',
    'FedexTrackSendNotificationOutputVO',
  ]) {
    assert.ok(schema.getType(name), `${name} should exist`)
  }
})

test('fedexHealth is queryable without credentials', async () => {
  const result = await graphql({
    schema,
    source: /* GraphQL */ `
      {
        fedexHealth {
          environment
          baseUrl
          credentialsConfigured
          accountNumberConfigured
          tokenCached
          tokenExpiresAt
        }
      }
    `,
  })

  assert.equal(result.errors, undefined)
  const health = (result.data as Record<string, Record<string, unknown>>).fedexHealth
  assert.equal(typeof health.environment, 'string')
  assert.equal(typeof health.baseUrl, 'string')
  assert.equal(typeof health.credentialsConfigured, 'boolean')
  assert.equal(health.tokenCached, false)
})
