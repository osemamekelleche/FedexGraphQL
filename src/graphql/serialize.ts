import { GraphQLError } from 'graphql'

export type JsonObject = Record<string, unknown>

export interface WeightInput {
  value: number
  units?: string | null
}

export interface DimensionsInput {
  length: number
  width: number
  height: number
  units?: string | null
}

export interface MoneyInput {
  amount: number
  currency?: string | null
}

export interface VersionInput {
  major?: number | null
  minor?: number | null
  patch?: number | null
}

export interface ContactInput {
  personName?: string | null
  companyName?: string | null
  phoneNumber?: string | null
  phoneExtension?: string | null
  faxNumber?: string | null
  emailAddress?: string | null
}

export interface ContactAndAddressInput {
  contact?: ContactInput | null
  address?: AddressInput | null
}

export interface AddressInput {
  streetLines: string[]
  city?: string | null
  stateOrProvinceCode?: string | null
  postalCode?: string | null
  countryCode: string
  residential?: boolean | null
  addressType?: string | null
}

export interface TaxIdInput {
  number: string
  tinType: string
  usage?: string | null
  effectiveDate?: string | null
  expirationDate?: string | null
}

export interface PartyInput {
  contact?: ContactInput | null
  address?: AddressInput | null
  accountNumber?: string | null
  tins?: TaxIdInput[] | null
  deliveryInstructions?: string | null
}

export interface ResponsiblePartyInput {
  accountNumber?: string | null
  address?: AddressInput | null
  contact?: ContactInput | null
}

export interface PaymentInput {
  paymentType: string
  payor?: { responsibleParty?: ResponsiblePartyInput | null } | null
}

export interface CustomerReferenceInput {
  customerReferenceType: string
  value: string
}

export interface ContentRecordInput {
  itemNumber?: string | null
  receivedQuantity?: number | null
  description?: string | null
  partNumber?: string | null
}

export interface PackageInput {
  weight: WeightInput
  dimensions?: DimensionsInput | null
  declaredValue?: MoneyInput | null
  itemDescription?: string | null
  itemDescriptionForClearance?: string | null
  customerReferences?: CustomerReferenceInput[] | null
  packageSpecialServices?: JsonObject | null
  subPackagingType?: string | null
  contentRecord?: ContentRecordInput[] | null
  variableHandlingChargeDetail?: JsonObject | null
  sequenceNumber?: number | null
  groupPackageCount?: number | null
}

export interface LabelSpecificationInput {
  labelFormatType?: string | null
  imageType?: string | null
  labelStockType?: string | null
  labelOrder?: string | null
  labelRotation?: string | null
  labelPrintingOrientation?: string | null
  returnedDispositionDetail?: string | null
  resolution?: number | null
  printedLabelOrigin?: ContactAndAddressInput | null
  customerSpecifiedDetail?: JsonObject | null
}

export interface PickupDetailInput {
  readyPickupDateTime?: string | null
  latestPickupDateTime?: string | null
  courierInstructions?: string | null
  requestType?: string | null
  requestSource?: string | null
}

export interface RegulatoryReferenceInput {
  regulatoryID?: string | null
  responsibleParty?: string | null
  identifier?: string | null
  registeredParty?: ContactAndAddressInput | null
}

export interface MasterTrackingIdInput {
  formId?: string | null
  trackingIdType?: string | null
  uspsApplicationId?: string | null
  trackingNumber?: string | null
}

export interface VariationOptionInput {
  id?: string | null
  values?: string[] | null
}

export interface RequestedShipmentInput {
  shipDatestamp?: string | null
  shipTimestamp?: string | null
  totalDeclaredValue?: MoneyInput | null
  pickupType: string
  serviceType: string
  packagingType: string
  totalWeight?: number | null
  shipper: PartyInput
  regulatoryReferences?: RegulatoryReferenceInput[] | null
  recipients: PartyInput[]
  soldTo?: PartyInput | null
  recipientLocationNumber?: string | null
  origin?: ContactAndAddressInput | null
  shippingChargesPayment?: PaymentInput | null
  labelSpecification?: LabelSpecificationInput | null
  requestedPackageLineItems: PackageInput[]
  customsClearanceDetail?: JsonObject | null
  shipmentSpecialServices?: JsonObject | null
  emailNotificationDetail?: JsonObject | null
  expressFreightDetail?: JsonObject | null
  variableHandlingChargeDetail?: JsonObject | null
  smartPostInfoDetail?: JsonObject | null
  shippingDocumentSpecification?: JsonObject | null
  blockInsightVisibility?: boolean | null
  rateRequestType?: string[] | null
  preferredCurrency?: string | null
  totalPackageCount?: number | null
  masterTrackingId?: MasterTrackingIdInput | null
  variationOptions?: VariationOptionInput[] | null
  pickupDetail?: PickupDetailInput | null
}

export interface CreateShipmentInput {
  accountNumber?: string | null
  requestedShipment: RequestedShipmentInput
  labelResponseOptions?: string | null
  mergeLabelDocOption?: string | null
  shipAction?: string | null
  processingOptionType?: string | null
  oneLabelAtATime?: boolean | null
  processingOptions?: string[] | null
  version?: VersionInput | null
}

export interface CancelShipmentInput {
  accountNumber?: string | null
  trackingNumber: string
  senderCountryCode?: string | null
  deletionControl?: string | null
  emailShipment?: boolean | null
  version?: VersionInput | null
}

export interface CreateTagInput {
  accountNumber?: string | null
  requestedShipment: RequestedShipmentInput
  version?: VersionInput | null
}

export interface CompletedTagDetailInput {
  confirmationNumber: string
  location: string
  dispatchDate: string
}

export interface CancelTagInput {
  shipmentId: string
  accountNumber?: string | null
  serviceType: string
  trackingNumber?: string | null
  completedTagDetail: CompletedTagDetailInput
  version?: VersionInput | null
}

export interface AsyncShipmentInput {
  jobId: string
  accountNumber?: string | null
  version?: VersionInput | null
}

export interface ValidateAddressInput {
  addressesToValidate: Array<{
    clientReferenceId?: string | null
    address: AddressInput
  }>
  includeResolutionTokens?: boolean | null
}

export interface PostalCodeValidationInput {
  carrierCode: string
  countryCode: string
  postalCode: string
  stateOrProvinceCode?: string | null
  city?: string | null
  shipDate?: string | null
  routingCode?: string | null
  checkForMismatch?: boolean | null
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Recursively remove undefined/null values so the payload only contains fields
 * the caller actually provided.
 */
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean)
  if (isJsonObject(value)) return compact(value)
  return value
}

function compact(value: JsonObject): JsonObject {
  const output: JsonObject = {}
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined || raw === null) continue
    const cleaned = clean(raw)
    if (cleaned === undefined || cleaned === null) continue
    output[key] = cleaned
  }
  return output
}

function resolveAccountNumber(
  provided: string | null | undefined,
  fallback: string | undefined,
): string {
  const resolved = provided ?? fallback
  if (!resolved) {
    throw new GraphQLError(
      'No FedEx account number was provided. Pass accountNumber or set FEDEX_ACCOUNT_NUMBER.',
      { extensions: { code: 'BAD_USER_INPUT' } },
    )
  }
  return resolved
}

function buildAddress(address: AddressInput): JsonObject {
  return compact({
    streetLines: address.streetLines,
    city: address.city,
    stateOrProvinceCode: address.stateOrProvinceCode,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    residential: address.residential,
    addressType: address.addressType,
  })
}

function buildContact(contact: ContactInput): JsonObject {
  return compact({
    personName: contact.personName,
    companyName: contact.companyName,
    phoneNumber: contact.phoneNumber,
    phoneExtension: contact.phoneExtension,
    faxNumber: contact.faxNumber,
    emailAddress: contact.emailAddress,
  })
}

function buildContactAndAddress(value: ContactAndAddressInput): JsonObject {
  return compact({
    contact: value.contact ? buildContact(value.contact) : undefined,
    address: value.address ? buildAddress(value.address) : undefined,
  })
}

function buildParty(party: PartyInput, fallbackAccountNumber?: string): JsonObject {
  const accountNumber = party.accountNumber ?? fallbackAccountNumber

  return compact({
    contact: party.contact ? buildContact(party.contact) : undefined,
    address: party.address ? buildAddress(party.address) : undefined,
    accountNumber: accountNumber ? { value: accountNumber } : undefined,
    tins: party.tins,
    deliveryInstructions: party.deliveryInstructions,
  })
}

function buildVersion(version: VersionInput | null | undefined): JsonObject | undefined {
  if (!version) return undefined
  return compact({
    major: version.major,
    minor: version.minor,
    patch: version.patch,
  })
}

function buildResponsibleParty(party: ResponsiblePartyInput): JsonObject {
  return compact({
    accountNumber: party.accountNumber ? { value: party.accountNumber } : undefined,
    address: party.address ? buildAddress(party.address) : undefined,
    contact: party.contact ? buildContact(party.contact) : undefined,
  })
}

function buildPayment(payment: PaymentInput | null | undefined): JsonObject {
  if (!payment) return { paymentType: 'SENDER' }

  const responsibleParty = payment.payor?.responsibleParty
  return compact({
    paymentType: payment.paymentType,
    payor: responsibleParty
      ? { responsibleParty: buildResponsibleParty(responsibleParty) }
      : undefined,
  })
}

function buildPackage(pkg: PackageInput): JsonObject {
  return compact({
    sequenceNumber: pkg.sequenceNumber,
    groupPackageCount: pkg.groupPackageCount,
    subPackagingType: pkg.subPackagingType,
    weight: { value: pkg.weight.value, units: pkg.weight.units ?? 'LB' },
    dimensions: pkg.dimensions
      ? {
          length: pkg.dimensions.length,
          width: pkg.dimensions.width,
          height: pkg.dimensions.height,
          units: pkg.dimensions.units ?? 'IN',
        }
      : undefined,
    declaredValue: pkg.declaredValue
      ? { amount: pkg.declaredValue.amount, currency: pkg.declaredValue.currency ?? 'USD' }
      : undefined,
    itemDescription: pkg.itemDescription,
    itemDescriptionForClearance: pkg.itemDescriptionForClearance,
    customerReferences: pkg.customerReferences,
    contentRecord: pkg.contentRecord,
    variableHandlingChargeDetail: pkg.variableHandlingChargeDetail,
    packageSpecialServices: pkg.packageSpecialServices,
  })
}

function buildLabelSpecification(spec: LabelSpecificationInput | null | undefined): JsonObject {
  const label = spec ?? {}

  return compact({
    labelFormatType: label.labelFormatType ?? 'COMMON2D',
    imageType: label.imageType ?? 'PDF',
    labelStockType: label.labelStockType ?? 'PAPER_4X6',
    labelOrder: label.labelOrder,
    labelRotation: label.labelRotation,
    labelPrintingOrientation: label.labelPrintingOrientation,
    returnedDispositionDetail: label.returnedDispositionDetail,
    resolution: label.resolution ?? 300,
    printedLabelOrigin: label.printedLabelOrigin
      ? buildContactAndAddress(label.printedLabelOrigin)
      : undefined,
    customerSpecifiedDetail: label.customerSpecifiedDetail,
  })
}

function sumPackageWeight(packages: PackageInput[]): number | undefined {
  if (packages.length === 0) return undefined
  const total = packages.reduce((sum, pkg) => sum + pkg.weight.value, 0)
  return Number.isFinite(total) ? total : undefined
}

function buildPickupDetail(
  pickup: PickupDetailInput | null | undefined,
): JsonObject | undefined {
  if (!pickup) return undefined
  return compact({
    readyPickupDateTime: pickup.readyPickupDateTime,
    latestPickupDateTime: pickup.latestPickupDateTime,
    courierInstructions: pickup.courierInstructions,
    requestType: pickup.requestType,
    requestSource: pickup.requestSource,
  })
}

function buildMoney(money: MoneyInput | null | undefined): JsonObject | undefined {
  if (!money) return undefined
  return { amount: money.amount, currency: money.currency ?? 'USD' }
}

function buildRequestedShipment(
  shipment: RequestedShipmentInput,
  accountNumber: string,
): JsonObject {
  const typed = compact({
    shipDatestamp: shipment.shipDatestamp,
    shipTimestamp: shipment.shipTimestamp,
    totalDeclaredValue: buildMoney(shipment.totalDeclaredValue),
    pickupType: shipment.pickupType,
    serviceType: shipment.serviceType,
    packagingType: shipment.packagingType,
    totalWeight: shipment.totalWeight ?? sumPackageWeight(shipment.requestedPackageLineItems),
    shipper: buildParty(shipment.shipper, accountNumber),
    regulatoryReferences: shipment.regulatoryReferences,
    recipients: shipment.recipients.map((recipient) => buildParty(recipient)),
    soldTo: shipment.soldTo ? buildParty(shipment.soldTo) : undefined,
    recipientLocationNumber: shipment.recipientLocationNumber,
    origin: shipment.origin ? buildContactAndAddress(shipment.origin) : undefined,
    shippingChargesPayment: buildPayment(shipment.shippingChargesPayment),
    labelSpecification: buildLabelSpecification(shipment.labelSpecification),
    requestedPackageLineItems: shipment.requestedPackageLineItems.map(buildPackage),
    customsClearanceDetail: shipment.customsClearanceDetail,
    shipmentSpecialServices: shipment.shipmentSpecialServices,
    emailNotificationDetail: shipment.emailNotificationDetail,
    expressFreightDetail: shipment.expressFreightDetail,
    variableHandlingChargeDetail: shipment.variableHandlingChargeDetail,
    smartPostInfoDetail: shipment.smartPostInfoDetail,
    shippingDocumentSpecification: shipment.shippingDocumentSpecification,
    blockInsightVisibility: shipment.blockInsightVisibility,
    rateRequestType: shipment.rateRequestType,
    preferredCurrency: shipment.preferredCurrency,
    totalPackageCount: shipment.totalPackageCount,
    masterTrackingId: shipment.masterTrackingId,
    variationOptions: shipment.variationOptions,
    pickupDetail: buildPickupDetail(shipment.pickupDetail),
  })

  return typed
}

export function buildCreateShipmentBody(
  input: CreateShipmentInput,
  fallbackAccountNumber?: string,
): JsonObject {
  const accountNumber = resolveAccountNumber(input.accountNumber, fallbackAccountNumber)

  return compact({
    accountNumber: { value: accountNumber },
    labelResponseOptions: input.labelResponseOptions ?? 'LABEL',
    mergeLabelDocOption: input.mergeLabelDocOption,
    shipAction: input.shipAction,
    processingOptionType: input.processingOptionType,
    oneLabelAtATime: input.oneLabelAtATime,
    processingOptions: input.processingOptions,
    version: buildVersion(input.version),
    requestedShipment: buildRequestedShipment(input.requestedShipment, accountNumber),
  })
}

export function buildValidateShipmentBody(
  input: CreateShipmentInput,
  fallbackAccountNumber?: string,
): JsonObject {
  const accountNumber = resolveAccountNumber(input.accountNumber, fallbackAccountNumber)

  return compact({
    accountNumber: { value: accountNumber },
    version: buildVersion(input.version),
    requestedShipment: buildRequestedShipment(input.requestedShipment, accountNumber),
  })
}

export function buildCreateTagBody(
  input: CreateTagInput,
  fallbackAccountNumber?: string,
): JsonObject {
  const accountNumber = resolveAccountNumber(input.accountNumber, fallbackAccountNumber)

  return compact({
    accountNumber: { value: accountNumber },
    version: buildVersion(input.version),
    requestedShipment: buildRequestedShipment(input.requestedShipment, accountNumber),
  })
}

export function buildCancelShipmentBody(
  input: CancelShipmentInput,
  fallbackAccountNumber?: string,
): JsonObject {
  return compact({
    accountNumber: { value: resolveAccountNumber(input.accountNumber, fallbackAccountNumber) },
    trackingNumber: input.trackingNumber,
    senderCountryCode: input.senderCountryCode,
    deletionControl: input.deletionControl ?? 'DELETE_ALL_PACKAGES',
    emailShipment: input.emailShipment,
    version: buildVersion(input.version),
  })
}

export function buildCancelTagBody(
  input: CancelTagInput,
  fallbackAccountNumber?: string,
): JsonObject {
  return compact({
    accountNumber: { value: resolveAccountNumber(input.accountNumber, fallbackAccountNumber) },
    serviceType: input.serviceType,
    trackingNumber: input.trackingNumber ?? input.shipmentId,
    completedTagDetail: {
      confirmationNumber: input.completedTagDetail.confirmationNumber,
      location: input.completedTagDetail.location,
      dispatchDate: input.completedTagDetail.dispatchDate,
    },
    version: buildVersion(input.version),
  })
}

export function buildAsyncShipmentBody(
  input: AsyncShipmentInput,
  fallbackAccountNumber?: string,
): JsonObject {
  return compact({
    accountNumber: { value: resolveAccountNumber(input.accountNumber, fallbackAccountNumber) },
    jobId: input.jobId,
    version: buildVersion(input.version),
  })
}

export function buildAddressValidationBody(input: ValidateAddressInput): JsonObject {
  return compact({
    validateAddressControlParameters:
      input.includeResolutionTokens === undefined || input.includeResolutionTokens === null
        ? undefined
        : { includeResolutionTokens: input.includeResolutionTokens },
    addressesToValidate: input.addressesToValidate.map((item) =>
      compact({
        clientReferenceId: item.clientReferenceId,
        address: buildAddress(item.address),
      }),
    ),
  })
}

export function buildPostalValidationBody(input: PostalCodeValidationInput): JsonObject {
  return compact({
    carrierCode: input.carrierCode,
    countryCode: input.countryCode,
    postalCode: input.postalCode,
    stateOrProvinceCode: input.stateOrProvinceCode,
    city: input.city,
    shipDate: input.shipDate,
    routingCode: input.routingCode,
    checkForMismatch: input.checkForMismatch,
  })
}
