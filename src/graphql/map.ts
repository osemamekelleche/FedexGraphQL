import { buildDocumentProxyUrl, documentExtension } from '../fedex/documents.js'
import { isJsonObject, type JsonObject } from './serialize.js'

function asObject(value: unknown): JsonObject {
  return isJsonObject(value) ? value : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function str(value: unknown): string | null {
  if (value === undefined || value === null) return null
  return typeof value === 'string' ? value : String(value)
}

function bool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  // Some FedEx amounts are objects: { amount, currency }.
  if (isJsonObject(value)) return num(value.amount)
  return null
}

function int(value: unknown): number | null {
  const parsed = num(value)
  return parsed === null ? null : Math.trunc(parsed)
}

function strings(value: unknown): string[] {
  return asArray(value).flatMap((entry) => {
    const text = str(entry)
    return text === null ? [] : [text]
  })
}

function toMessages(value: unknown) {
  return asArray(value).map((entry) => {
    const message = asObject(entry)
    return {
      alertType: str(message.alertType),
      code: str(message.code),
      message: str(message.message),
    }
  })
}

function documentFilename(document: JsonObject): string {
  const contentType = str(document.contentType) ?? ''
  const prefix = contentType.toUpperCase().includes('LABEL') ? 'label' : 'document'
  const trackingNumber = str(document.trackingNumber)
  const suffix = trackingNumber ? `-${trackingNumber.replace(/[^\w.-]/g, '_')}` : ''
  return `${prefix}${suffix}.${documentExtension(str(document.docType))}`
}

function toDocument(value: unknown) {
  const document = asObject(value)
  const fedexUrl = str(document.url)
  return {
    contentKey: str(document.contentKey),
    contentType: str(document.contentType),
    docType: str(document.docType),
    copiesToPrint: int(document.copiesToPrint),
    trackingNumber: str(document.trackingNumber),
    encodedLabel: str(document.encodedLabel),
    // Raw, temporary FedEx URL.
    fedexUrl,
    // Clickable URL that proxies the download through this GraphQL server.
    url: fedexUrl ? buildDocumentProxyUrl(fedexUrl, documentFilename(document)) : null,
    alerts: toMessages(document.alerts),
  }
}

function toPiece(value: unknown) {
  const piece = asObject(value)
  return {
    trackingNumber: str(piece.trackingNumber),
    masterTrackingNumber: str(piece.masterTrackingNumber),
    packageSequenceNumber: int(piece.packageSequenceNumber),
    trackingIdType: str(piece.trackingIdType),
    acceptanceTrackingNumber: str(piece.acceptanceTrackingNumber),
    serviceCategory: str(piece.serviceCategory),
    acceptanceType: str(piece.acceptanceType),
    deliveryTimestamp: str(piece.deliveryTimestamp),
    baseRateAmount: num(piece.baseRateAmount),
    netChargeAmount: num(piece.netChargeAmount),
    netDiscountAmount: num(piece.netDiscountAmount),
    listRateAmount: num(piece.listRateAmount),
    codCollectionAmount: num(piece.codCollectionAmount),
    additionalChargesDiscount: num(piece.additionalChargesDiscount),
    listCustomerTotalCharge: str(piece.listCustomerTotalCharge),
    customerReferences: asArray(piece.customerReferences).map((entry) => {
      const reference = asObject(entry)
      return {
        type: str(reference.customerReferenceType) ?? str(reference.type),
        value: str(reference.value),
      }
    }),
    documents: asArray(piece.packageDocuments).map(toDocument),
  }
}

function toTransactionShipment(value: unknown) {
  const shipment = asObject(value)
  return {
    serviceType: str(shipment.serviceType),
    serviceName: str(shipment.serviceName),
    serviceCategory: str(shipment.serviceCategory),
    shipDatestamp: str(shipment.shipDatestamp),
    masterTrackingNumber: str(shipment.masterTrackingNumber),
    pieces: asArray(shipment.pieceResponses).map(toPiece),
    shipmentDocuments: asArray(shipment.shipmentDocuments).map(toDocument),
    completedShipmentDetail: isJsonObject(shipment.completedShipmentDetail)
      ? shipment.completedShipmentDetail
      : null,
    shipmentAdvisoryDetails: isJsonObject(shipment.shipmentAdvisoryDetails)
      ? shipment.shipmentAdvisoryDetails
      : null,
    alerts: toMessages(shipment.alerts),
  }
}

export function toShipmentResult(raw: unknown) {
  const record = asObject(raw)
  const output = asObject(record.output)

  return {
    transactionId: str(record.transactionId),
    customerTransactionId: str(record.customerTransactionId),
    jobId: str(output.jobId) ?? str(record.jobId),
    shipments: asArray(output.transactionShipments).map(toTransactionShipment),
    alerts: toMessages(output.alerts ?? record.alerts),
    errors: toMessages(record.errors ?? output.errors),
  }
}

export function toCancelShipmentResult(raw: unknown) {
  const record = asObject(raw)
  const output = asObject(record.output)

  return {
    transactionId: str(record.transactionId),
    cancelledShipment: bool(output.cancelledShipment),
    cancelledHistory: bool(output.cancelledHistory),
    message: str(output.message),
    alerts: toMessages(output.alerts ?? record.alerts),
    errors: toMessages(record.errors ?? output.errors),
  }
}

export function toTagResult(raw: unknown) {
  const record = asObject(raw)
  const output = asObject(record.output)
  const completedTag = asObject(output.completedTagDetail)

  return {
    transactionId: str(record.transactionId),
    customerTransactionId: str(record.customerTransactionId),
    masterTrackingNumber: str(output.masterTrackingNumber),
    serviceType: str(output.serviceType),
    shipTimestamp: str(output.shipTimestamp),
    confirmationNumber: str(completedTag.confirmationNumber),
    dispatchDate: str(completedTag.dispatchDate),
    location: str(completedTag.location),
    cancelledTag: bool(output.cancelledTag),
    successMessage: str(output.successMessage),
    alerts: toMessages(output.alerts ?? record.alerts),
    errors: toMessages(record.errors ?? output.errors),
  }
}

function toResolutionToken(value: unknown) {
  if (value === undefined || value === null) return null
  if (!isJsonObject(value)) {
    return { changed: null, value: str(value) }
  }
  return { changed: bool(value.changed), value: str(value.value) }
}

function toParsedPostalCode(value: unknown) {
  if (!isJsonObject(value)) return null
  return {
    base: str(value.base),
    addOn: str(value.addOn),
    deliveryPoint: str(value.deliveryPoint),
  }
}

function toResolvedAddress(value: unknown) {
  const address = asObject(value)
  const messages = asArray(address.customerMessage ?? address.customerMessages)
  const attributes = Array.isArray(address.attributes)
    ? address.attributes.flatMap((entry) => {
        const attribute = asObject(entry)
        const key = str(attribute.key) ?? str(attribute.name)
        return key === null ? [] : [{ key, value: str(attribute.value) }]
      })
    : isJsonObject(address.attributes)
      ? Object.entries(address.attributes).map(([key, raw]) => ({ key, value: str(raw) }))
      : []

  return {
    clientReferenceId: str(address.clientReferenceId),
    streetLines: strings(address.streetLines ?? address.streetLinesToken),
    streetLinesToken: strings(address.streetLinesToken),
    city: str(address.city),
    stateOrProvinceCode: str(address.stateOrProvinceCode),
    postalCode: str(address.postalCode),
    countryCode: str(address.countryCode),
    classification: str(address.classification),
    postOfficeBox: bool(address.postOfficeBox),
    normalizedStatusNameDPV: bool(address.normalizedStatusNameDPV),
    standardizedStatusNameMatchSource: str(address.standardizedStatusNameMatchSource),
    resolutionMethodName: str(address.resolutionMethodName),
    ruralRouteHighwayContract: bool(address.ruralRouteHighwayContract),
    generalDelivery: bool(address.generalDelivery),
    customerMessage: messages.map((entry) => {
      if (typeof entry === 'string') return { code: null, message: entry }
      const message = asObject(entry)
      return { code: str(message.code), message: str(message.message) }
    }),
    cityToken: asArray(address.cityToken).flatMap((entry) => {
      const token = toResolutionToken(entry)
      return token === null ? [] : [token]
    }),
    postalCodeToken: toResolutionToken(address.postalCodeToken),
    parsedPostalCode: toParsedPostalCode(address.parsedPostalCode),
    attributes,
    address: isJsonObject(address.address)
      ? {
          streetLines: strings(address.address.streetLines),
          city: str(address.address.city),
          stateOrProvinceCode: str(address.address.stateOrProvinceCode),
          postalCode: str(address.address.postalCode),
          countryCode: str(address.address.countryCode),
        }
      : null,
  }
}

export function toAddressValidationResult(raw: unknown) {
  const record = asObject(raw)
  const output = asObject(record.output)

  return {
    transactionId: str(record.transactionId),
    customerTransactionId: str(record.customerTransactionId),
    resolvedAddresses: asArray(output.resolvedAddresses).map(toResolvedAddress),
    // FedEx does not document this list, but older responses can include it.
    unresolvedAddresses: asArray(output.unresolvedAddresses).map(toResolvedAddress),
    alerts: toMessages(output.alerts ?? record.alerts),
    errors: toMessages(record.errors ?? output.errors),
  }
}

export function toPostalValidationResult(raw: unknown) {
  const record = asObject(raw)
  const output = asObject(record.output)

  return {
    transactionId: str(record.transactionId),
    valid:
      bool(output.postalCodeValid) ??
      bool(output.valid) ??
      bool(output.isValid) ??
      bool(record.valid) ??
      null,
    postalCode: str(output.postalCode) ?? str(record.postalCode),
    stateOrProvinceCode:
      str(output.stateOrProvinceCode) ?? str(record.stateOrProvinceCode),
    city: str(output.city) ?? str(record.city),
    countryCode: str(output.countryCode) ?? str(record.countryCode),
    alerts: toMessages(output.alerts ?? record.alerts),
    errors: toMessages(record.errors ?? output.errors),
  }
}
