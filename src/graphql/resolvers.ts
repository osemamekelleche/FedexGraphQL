import { config, credentialsConfigured } from '../config.js'
import { fedexRequest, getTokenStatus } from '../fedex/client.js'
import { asGraphQLError } from '../fedex/errors.js'
import {
  toAddressValidationResult,
  toCancelShipmentResult,
  toPostalValidationResult,
  toShipmentResult,
  toTagResult,
} from './map.js'
import {
  buildAddressValidationBody,
  buildAsyncShipmentBody,
  buildCancelShipmentBody,
  buildCancelTagBody,
  buildCreateShipmentBody,
  buildCreateTagBody,
  buildPostalValidationBody,
  buildValidateShipmentBody,
  cleanInput,
  type AsyncShipmentInput,
  type CancelShipmentInput,
  type CancelTagInput,
  type CreateShipmentInput,
  type CreateTagInput,
  type JsonObject,
  type PostalCodeValidationInput,
  type ValidateAddressInput,
} from './serialize.js'

interface Args<T> {
  input: T
}

async function run<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw asGraphQLError(error)
  }
}

export const resolvers = {
  Query: {
    fedexHealth: () => {
      const token = getTokenStatus()
      return {
        environment: config.environment,
        baseUrl: config.baseUrl,
        credentialsConfigured: credentialsConfigured(),
        accountNumberConfigured: Boolean(config.accountNumber),
        tokenCached: token.cached,
        tokenExpiresAt: token.expiresAt,
      }
    },

    validateAddress: (_parent: unknown, { input }: Args<ValidateAddressInput>) =>
      run(async () => {
        const raw = await fedexRequest(
          'POST',
          '/address/v1/addresses/resolve',
          buildAddressValidationBody(input),
        )
        return toAddressValidationResult(raw)
      }),

    validatePostalCode: (_parent: unknown, { input }: Args<PostalCodeValidationInput>) =>
      run(async () => {
        const raw = await fedexRequest(
          'POST',
          '/country/v1/postal/validate',
          buildPostalValidationBody(input),
        )
        return toPostalValidationResult(raw)
      }),

    asyncShipment: (_parent: unknown, { input }: Args<AsyncShipmentInput>) =>
      run(async () => {
        const raw = await fedexRequest(
          'POST',
          '/ship/v1/shipments/results',
          buildAsyncShipmentBody(input, config.accountNumber),
        )
        return toShipmentResult(raw)
      }),

    trackShipment: (_parent: unknown, { input }: Args<JsonObject>) =>
      run(() => fedexRequest('POST', '/track/v1/trackingnumbers', cleanInput(input))),

    trackByReferenceNumbers: (_parent: unknown, { input }: Args<JsonObject>) =>
      run(() => fedexRequest('POST', '/track/v1/referencenumbers', cleanInput(input))),

    trackAssociatedShipments: (_parent: unknown, { input }: Args<JsonObject>) =>
      run(() => fedexRequest('POST', '/track/v1/associatedshipments', cleanInput(input))),

    trackByTcn: (_parent: unknown, { input }: Args<JsonObject>) =>
      run(() => fedexRequest('POST', '/track/v1/tcn', cleanInput(input))),

    trackDocuments: (_parent: unknown, { input }: Args<JsonObject>) =>
      run(() => fedexRequest('POST', '/track/v1/trackingdocuments', cleanInput(input))),
  },

  Mutation: {
    createShipment: (_parent: unknown, { input }: Args<CreateShipmentInput>) =>
      run(async () => {
        const raw = await fedexRequest(
          'POST',
          '/ship/v1/shipments',
          buildCreateShipmentBody(input, config.accountNumber),
        )
        return toShipmentResult(raw)
      }),

    validateShipment: (_parent: unknown, { input }: Args<CreateShipmentInput>) =>
      run(async () => {
        const raw = await fedexRequest(
          'POST',
          '/ship/v1/shipments/packages/validate',
          buildValidateShipmentBody(input, config.accountNumber),
        )
        return toShipmentResult(raw)
      }),

    cancelShipment: (_parent: unknown, { input }: Args<CancelShipmentInput>) =>
      run(async () => {
        const raw = await fedexRequest(
          'PUT',
          '/ship/v1/shipments/cancel',
          buildCancelShipmentBody(input, config.accountNumber),
        )
        return toCancelShipmentResult(raw)
      }),

    createTag: (_parent: unknown, { input }: Args<CreateTagInput>) =>
      run(async () => {
        const raw = await fedexRequest(
          'POST',
          '/ship/v1/shipments/tag',
          buildCreateTagBody(input, config.accountNumber),
        )
        return toTagResult(raw)
      }),

    cancelTag: (_parent: unknown, { input }: Args<CancelTagInput>) =>
      run(async () => {
        const raw = await fedexRequest(
          'PUT',
          `/ship/v1/shipments/tag/cancel/${encodeURIComponent(input.shipmentId)}`,
          buildCancelTagBody(input, config.accountNumber),
        )
        return toTagResult(raw)
      }),

    sendTrackingNotifications: (_parent: unknown, { input }: Args<JsonObject>) =>
      run(() => fedexRequest('POST', '/track/v1/notifications', cleanInput(input))),
  },
}
