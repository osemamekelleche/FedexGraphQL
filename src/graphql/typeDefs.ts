import { enumTypeDefs } from './enums.js'
import { generatedTypeDefs } from './generated.js'

export const typeDefs = /* GraphQL */ `
${enumTypeDefs}

${generatedTypeDefs}

  type Query {
    "FedEx environment, credential, and token status. Never returns secrets."
    fedexHealth: FedexHealth!

    "Validate and resolve up to 100 addresses (FedEx Address Validation API)."
    validateAddress(input: ValidateAddressInput!): AddressValidationResult!

    "Validate a postal code, optionally checking the state/province match (FedEx Postal Code Validation API)."
    validatePostalCode(input: PostalCodeValidationInput!): PostalCodeValidationResult!

    "Retrieve a shipment that FedEx processed asynchronously, using the jobId returned by createShipment."
    asyncShipment(input: AsyncShipmentInput!): ShipmentResult!
  }

  type Mutation {
    "Create a shipment and return tracking numbers, labels, and FedEx alerts."
    createShipment(input: CreateShipmentInput!): ShipmentResult!

    "Validate shipment data without producing a label. Uses the same input as createShipment."
    validateShipment(input: CreateShipmentInput!): ShipmentResult!

    "Cancel a shipment or a single package in a multi-piece shipment."
    cancelShipment(input: CancelShipmentInput!): CancelShipmentResult!

    "Create a FedEx return tag: FedEx delivers a return label and collects the package."
    createTag(input: CreateTagInput!): TagResult!

    "Cancel a return tag and its associated pickup."
    cancelTag(input: CancelTagInput!): TagResult!
  }

  type FedexHealth {
    "sandbox or production."
    environment: String!
    baseUrl: String!
    credentialsConfigured: Boolean!
    accountNumberConfigured: Boolean!
    "True while a FedEx OAuth token is cached in memory."
    tokenCached: Boolean!
    tokenExpiresAt: String
  }

  "An alert, note, warning, or error returned by FedEx."
  type FedexMessage {
    alertType: String
    code: String
    message: String
  }

  type ShipmentResult {
    transactionId: String
    customerTransactionId: String
    "Present when FedEx queued the shipment for asynchronous processing. Pass it to asyncShipment."
    jobId: String
    shipments: [TransactionShipment!]!
    alerts: [FedexMessage!]!
    "FedEx errors returned in the HTTP 200 body. Transport and auth failures are thrown as GraphQL errors."
    errors: [FedexMessage!]!
  }

  type TransactionShipment {
    serviceType: String
    serviceName: String
    serviceCategory: String
    shipDatestamp: String
    masterTrackingNumber: String
    "One entry per package in the shipment."
    pieces: [PieceResponse!]!
    shipmentDocuments: [Document!]!
    "Carrier code, master tracking id, service description, ratings, and other completed shipment detail."
    completedShipmentDetail: FedexCompletedCreateShipmentDetail
    "Regulatory advisories and prohibitions returned by FedEx."
    shipmentAdvisoryDetails: FedexShipmentAdvisoryDetails
    alerts: [FedexMessage!]!
  }

  type PieceResponse {
    trackingNumber: String
    masterTrackingNumber: String
    packageSequenceNumber: Int
    trackingIdType: String
    "Tracking number used for the acceptance scan, when FedEx returns one."
    acceptanceTrackingNumber: String
    "EXPRESS, GROUND, EXPRESS_FREIGHT, FREIGHT, SMARTPOST, or EXPRESS_PARCEL."
    serviceCategory: String
    acceptanceType: String
    deliveryTimestamp: String
    baseRateAmount: Float
    netChargeAmount: Float
    netDiscountAmount: Float
    listRateAmount: Float
    codCollectionAmount: Float
    additionalChargesDiscount: Float
    "Customer total charge before discounts, as returned by FedEx (a string in the API)."
    listCustomerTotalCharge: String
    customerReferences: [CustomerReference!]!
    "Labels and other documents for this package."
    documents: [Document!]!
  }

  type Document {
    "Opaque identifier FedEx uses to locate the document."
    contentKey: String
    "LABEL, COMMERCIAL_INVOICE, GAA_FORM, and other document content types."
    contentType: String
    docType: String
    copiesToPrint: Int
    "Tracking number printed on the document, when FedEx returns one."
    trackingNumber: String
    "Base64-encoded document bytes, present when labelResponseOptions is LABEL."
    encodedLabel: String
    "Raw temporary FedEx URL (active for about 24 hours). May not open directly in a browser."
    fedexUrl: String
    "Clickable URL that downloads the document through this GraphQL server."
    url: String
    alerts: [FedexMessage!]!
  }

  type CustomerReference {
    "e.g. DEPARTMENT_NUMBER, INVOICE_NUMBER, P_O_NUMBER."
    type: String
    value: String
  }

  type CancelShipmentResult {
    transactionId: String
    cancelledShipment: Boolean
    cancelledHistory: Boolean
    message: String
    alerts: [FedexMessage!]!
    errors: [FedexMessage!]!
  }

  type TagResult {
    transactionId: String
    customerTransactionId: String
    masterTrackingNumber: String
    serviceType: String
    shipTimestamp: String
    "Confirmation number of the created/cancelled return tag."
    confirmationNumber: String
    dispatchDate: String
    location: String
    "True when cancelTag cancelled the tag."
    cancelledTag: Boolean
    "Success message returned by cancelTag."
    successMessage: String
    alerts: [FedexMessage!]!
    errors: [FedexMessage!]!
  }

  type AddressValidationResult {
    transactionId: String
    customerTransactionId: String
    "Resolved addresses as returned by FedEx, including annotations and classification."
    resolvedAddresses: [ResolvedAddress!]!
    "Addresses FedEx could not resolve."
    unresolvedAddresses: [ResolvedAddress!]!
    alerts: [FedexMessage!]!
    errors: [FedexMessage!]!
  }

  "A validated address returned by the FedEx Address Validation API."
  type ResolvedAddress {
    "The clientReferenceId supplied with the input address."
    clientReferenceId: String
    "Standardized street lines. FedEx calls this streetLinesToken when resolution tokens are requested."
    streetLines: [String!]!
    streetLinesToken: [String!]!
    city: String
    stateOrProvinceCode: String
    postalCode: String
    countryCode: String
    "BUSINESS, RESIDENTIAL, MIXED, or UNKNOWN."
    classification: String
    postOfficeBox: Boolean
    "True when the address has a valid delivery point (DPV)."
    normalizedStatusNameDPV: Boolean
    standardizedStatusNameMatchSource: String
    resolutionMethodName: String
    ruralRouteHighwayContract: Boolean
    generalDelivery: Boolean
    "Informational messages describing changes or problems with the address."
    customerMessage: [ResolvedAddressMessage!]!
    "Resolved city values with change tokens."
    cityToken: [ResolutionToken!]!
    postalCodeToken: ResolutionToken
    parsedPostalCode: ParsedPostalCode
    "Address attributes as key/value pairs. FedEx types these inconsistently, so values are strings."
    attributes: [ResolvedAddressAttribute!]!
    "The unresolved input address, when FedEx echoes it back."
    address: AddressValidationAddress
  }

  type ResolvedAddressMessage {
    code: String
    message: String
  }

  type ResolutionToken {
    "True when FedEx changed this address component."
    changed: Boolean
    value: String
  }

  type ParsedPostalCode {
    base: String
    addOn: String
    deliveryPoint: String
  }

  type ResolvedAddressAttribute {
    key: String!
    value: String
  }

  type AddressValidationAddress {
    streetLines: [String!]!
    city: String
    stateOrProvinceCode: String
    postalCode: String
    countryCode: String
  }

  type PostalCodeValidationResult {
    transactionId: String
    valid: Boolean
    postalCode: String
    stateOrProvinceCode: String
    city: String
    countryCode: String
    alerts: [FedexMessage!]!
    errors: [FedexMessage!]!
  }

  "FedEx API version block: { major, minor, patch }."
  input VersionInput {
    major: Int
    minor: Int
    patch: Int
  }

  input WeightInput {
    value: Float!
    units: WeightUnit = LB
  }

  input DimensionsInput {
    length: Float!
    width: Float!
    height: Float!
    units: DimensionUnit = IN
  }

  input MoneyInput {
    amount: Float!
    "ISO 4217 currency code. Defaults to USD."
    currency: String
  }

  input ContactInput {
    personName: String
    companyName: String
    phoneNumber: String
    phoneExtension: String
    faxNumber: String
    emailAddress: String
  }

  "A contact plus an address, used for origin and printed-label addresses."
  input ContactAndAddressInput {
    contact: ContactInput
    address: AddressInput
  }

  input AddressInput {
    "Street address lines, e.g. [\\"10 FedEx Parkway\\"]."
    streetLines: [String!]!
    city: String
    "Two-letter state or province code."
    stateOrProvinceCode: String
    postalCode: String
    "Two-letter ISO country code, e.g. US."
    countryCode: String!
    "Set true for residential addresses."
    residential: Boolean
    "FedEx address type, e.g. STREET_LINE or P.O. BOX."
    addressType: String
  }

  input TaxIdInput {
    number: String!
    "Tax identification type, e.g. BUSINESS_NATIONAL or FEDERAL."
    tinType: TinType!
    usage: String
    "Effective date of the tax id, e.g. 2026-01-01."
    effectiveDate: String
    expirationDate: String
  }

  input PartyInput {
    contact: ContactInput
    address: AddressInput
    "FedEx account number. For the shipper, defaults to FEDEX_ACCOUNT_NUMBER."
    accountNumber: String
    tins: [TaxIdInput!]
    "Delivery instructions for the recipient, e.g. leave at the back door."
    deliveryInstructions: String
  }

  input ResponsiblePartyInput {
    accountNumber: String
    address: AddressInput
    contact: ContactInput
  }

  input PayorInput {
    responsibleParty: ResponsiblePartyInput
  }

  input PaymentInput {
    "Who pays: SENDER, RECIPIENT, THIRD_PARTY, or COLLECT."
    paymentType: PaymentType!
    payor: PayorInput
  }

  input CustomerReferenceInput {
    "e.g. DEPARTMENT_NUMBER, INVOICE_NUMBER, P_O_NUMBER."
    customerReferenceType: CustomerReferenceType!
    value: String!
  }

  "Details of an individual item inside a package (contentRecord)."
  input ContentRecordInput {
    itemNumber: String
    receivedQuantity: Int
    description: String
    partNumber: String
  }

  input PackageInput {
    weight: WeightInput!
    "Strongly recommended for accurate rates and label content."
    dimensions: DimensionsInput
    "Declared value for carriage/customs. Currency defaults to USD."
    declaredValue: MoneyInput
    "Description of the goods. Required for international shipments."
    itemDescription: String
    "Item description used on customs clearance documents."
    itemDescriptionForClearance: String
    customerReferences: [CustomerReferenceInput!]
    """
    FedEx package-level special services, e.g.
    { specialServiceTypes: ["SIGNATURE_OPTION"], signatureOptionDetail: { signatureReleaseNumber: "1234" } }.
    """
    packageSpecialServices: FedexPackageSpecialServicesRequestedInput
    "FedEx sub-packaging type, when the package contains nested packaging."
    subPackagingType: String
    "Item-level contents of the package."
    contentRecord: [ContentRecordInput!]
    "Variable handling charge details for this package."
    variableHandlingChargeDetail: FedexVariableHandlingChargeDetailInput
    sequenceNumber: Int
    groupPackageCount: Int
  }

  input LabelSpecificationInput {
    "e.g. COMMON2D or LABEL_DATA_ONLY."
    labelFormatType: LabelFormatType
    "e.g. PDF, PNG, ZPLII, EPL2."
    imageType: ImageType
    "e.g. PAPER_4X6, PAPER_7X475, PAPER_LETTER."
    labelStockType: LabelStockType
    "e.g. SHIPPING_LABEL_FIRST, SHIPPING_LABEL_LAST."
    labelOrder: LabelOrder
    "Thermal-printer roll stock orientation."
    labelRotation: LabelRotation
    "Thermal-printer roll stock printing orientation."
    labelPrintingOrientation: LabelPrintingOrientation
    "Disposition detail for the returned label, e.g. RETURNED."
    returnedDispositionDetail: String
    "203 or 300 dpi. FedEx defaults to 203."
    resolution: Int
    printedLabelOrigin: ContactAndAddressInput
    "Controls which data is suppressed or customized on the label."
    customerSpecifiedDetail: FedexCustomerSpecifiedLabelDetailInput
  }

  "Pickup window and source for a shipment or return tag."
  input PickupDetailInput {
    "Ready-for-pickup date/time, e.g. 2026-11-10T09:00:00Z. Required for return tags."
    readyPickupDateTime: String
    "Latest possible pickup date/time, e.g. 2026-11-10T17:00:00Z. Required for return tags."
    latestPickupDateTime: String
    courierInstructions: String
    requestType: PickupRequestType
    requestSource: PickupRequestSourceType
  }

  "Regulatory reference, currently used for IOSS numbers."
  input RegulatoryReferenceInput {
    "Currently IOSS."
    regulatoryID: String
    "Currently SHIPPER."
    responsibleParty: String
    identifier: String
    registeredParty: ContactAndAddressInput
  }

  "Master tracking id for a multiple-piece shipment."
  input MasterTrackingIdInput {
    formId: String
    trackingIdType: String
    uspsApplicationId: String
    trackingNumber: String
  }

  "A shipment variation expressed as a key with one or more values."
  input VariationOptionInput {
    id: String
    values: [String!]
  }

  input RequestedShipmentInput {
    "YYYY-MM-DD. Defaults to the FedEx processing date when omitted."
    shipDatestamp: String
    "Return-tag shipments use shipTimestamp instead of shipDatestamp."
    shipTimestamp: String
    "Sum of all package declared values. Currency defaults to USD."
    totalDeclaredValue: MoneyInput
    "How FedEx gets the package: scheduled pickup, on-call pickup, or drop-off."
    pickupType: PickupType!
    "FedEx service, e.g. FEDEX_GROUND or PRIORITY_OVERNIGHT."
    serviceType: ServiceType!
    "Packaging used, e.g. YOUR_PACKAGING, FEDEX_BOX, FEDEX_PAK."
    packagingType: PackagingType!
    "Shipment total weight. Derived from the package weights when omitted."
    totalWeight: Float
    "Pickup window details, required for return tags."
    pickupDetail: PickupDetailInput
    shipper: PartyInput!
    regulatoryReferences: [RegulatoryReferenceInput!]
    recipients: [PartyInput!]!
    "Party responsible for purchasing the goods (customs)."
    soldTo: PartyInput
    recipientLocationNumber: String
    "Origin address when it differs from the shipper address."
    origin: ContactAndAddressInput
    shippingChargesPayment: PaymentInput
    labelSpecification: LabelSpecificationInput
    requestedPackageLineItems: [PackageInput!]!
    "Customs clearance detail. Required for most international shipments."
    customsClearanceDetail: FedexCustomsClearanceDetailInput
    """
    FedEx shipment-level special services, e.g.
    { specialServiceTypes: ["RETURN_SHIPMENT"], returnShipmentDetail: { returnType: PRINT_RETURN_LABEL } }.
    """
    shipmentSpecialServices: FedexShipmentSpecialServicesRequestedInput
    "Email notification recipients and message."
    emailNotificationDetail: FedexShipShipmentEMailNotificationDetailInput
    "Advanced booking and packing list details for Express Freight."
    expressFreightDetail: FedexExpressFreightDetailInput
    "Variable handling charge details for the shipment."
    variableHandlingChargeDetail: FedexVariableHandlingChargeDetailInput
    "FedEx Ground Economy (SmartPost) details."
    smartPostInfoDetail: FedexSmartPostInfoDetailInput
    "Additional non-label shipping documents to produce."
    shippingDocumentSpecification: FedexShippingDocumentSpecificationInput
    blockInsightVisibility: Boolean
    "Rate types to return, e.g. [ACCOUNT, PREFERRED]."
    rateRequestType: [RateRequestType!]
    "Currency for returned monetary values. Use with rateRequestType."
    preferredCurrency: String
    "Total number of packages for a parent one-label-at-a-time shipment."
    totalPackageCount: Int
    masterTrackingId: MasterTrackingIdInput
    variationOptions: [VariationOptionInput!]
  }

  input CreateShipmentInput {
    "FedEx account number. Defaults to FEDEX_ACCOUNT_NUMBER."
    accountNumber: String
    requestedShipment: RequestedShipmentInput!
    """
    LABEL returns base64 labels in the response; URL_ONLY returns temporary
    document URLs. Defaults to LABEL.
    """
    labelResponseOptions: LabelResponseOption
    "How labels and documents are combined: NONE, LABELS_AND_DOCS, LABELS_ONLY."
    mergeLabelDocOption: MergeLabelDocOption
    "Open-shipment action: CONFIRM or TRANSFER."
    shipAction: ShipAction
    """
    SYNCHRONOUS_ONLY or ALLOW_ASYNCHRONOUS. ALLOW_ASYNCHRONOUS lets FedEx
    queue the work and return a jobId.
    """
    processingOptionType: ProcessingOptionType
    "Process one label at a time (piece by piece) instead of a single-shot MPS."
    oneLabelAtATime: Boolean
    "INCLUDE_PICKUPRATES asks FedEx to return pickup rate details."
    processingOptions: [ProcessingOption!]
    version: VersionInput
  }

  input CancelShipmentInput {
    "FedEx account number. Defaults to FEDEX_ACCOUNT_NUMBER."
    accountNumber: String
    "Master or package tracking number."
    trackingNumber: String!
    "Country of the shipper, e.g. US."
    senderCountryCode: String
    "The Ship API currently supports DELETE_ALL_PACKAGES only."
    deletionControl: DeletionControl
    "Set true when cancelling an email return shipment."
    emailShipment: Boolean
    version: VersionInput
  }

  input CreateTagInput {
    "FedEx account number. Defaults to FEDEX_ACCOUNT_NUMBER."
    accountNumber: String
    requestedShipment: RequestedShipmentInput!
    version: VersionInput
  }

  "Pickup confirmation returned by createTag and required to cancel the tag."
  input CompletedTagDetailInput {
    "Confirmation number, e.g. 275."
    confirmationNumber: String!
    "Location code, e.g. NQAA."
    location: String!
    "Dispatch date, e.g. 2026-11-10."
    dispatchDate: String!
  }

  input CancelTagInput {
    "Shipment id from the createTag response (the tracking number). Goes in the request path."
    shipmentId: String!
    "FedEx account number. Defaults to FEDEX_ACCOUNT_NUMBER."
    accountNumber: String
    "Service type of the tag, e.g. FEDEX_GROUND."
    serviceType: ServiceType!
    "Tracking number of the tag to cancel. Defaults to shipmentId."
    trackingNumber: String
    completedTagDetail: CompletedTagDetailInput!
    version: VersionInput
  }

  input AsyncShipmentInput {
    "jobId returned by createShipment when FedEx processes a shipment asynchronously."
    jobId: String!
    "FedEx account number. Defaults to FEDEX_ACCOUNT_NUMBER."
    accountNumber: String
    version: VersionInput
  }

  input AddressToValidateInput {
    "Echoed back by FedEx so you can match results to inputs."
    clientReferenceId: String
    address: AddressInput!
  }

  input ValidateAddressInput {
    "Up to 100 addresses per request."
    addressesToValidate: [AddressToValidateInput!]!
    "Include tokens describing how each part of the address was resolved."
    includeResolutionTokens: Boolean
  }

  input PostalCodeValidationInput {
    "FDXE (Express), FDXG (Ground), FXSP (Ground Economy), FDXC, or FXCC."
    carrierCode: CarrierCode!
    "Two-letter ISO country code."
    countryCode: String!
    postalCode: String!
    stateOrProvinceCode: String
    city: String
    "Ship date used for service commitment checks, e.g. 2026-11-13."
    shipDate: String
    routingCode: String
    "When true, FedEx reports a mismatch between postal code and state/province."
    checkForMismatch: Boolean
  }
`
