/**
 * FedEx request enums.
 *
 * GraphiQL and GraphQL IDEs only autocomplete enum values when the field is a
 * real GraphQL enum, so the stable FedEx value sets are modeled here. Values
 * mirror the Ship API OpenAPI document in `ship.json`.
 *
 * If FedEx adds a value, add it to the matching list and run `npm run schema`.
 * Only *input* fields use these enums. Response fields stay `String` so a new
 * value coming back from FedEx can never break serialization.
 */

function enumDef(name: string, description: string, values: readonly string[]): string {
  const unique = [...new Set(values)].sort()
  return [
    `"""${description}"""`,
    `enum ${name} {`,
    ...unique.map((value) => `  ${value}`),
    '}',
  ].join('\n')
}

/**
 * The Ship API does not constrain service and packaging types in the OpenAPI
 * document (FedEx maintains them in external reference pages), so these lists
 * are curated from FedEx's published service/packaging value sets.
 */
const serviceTypes = [
  'EUROPE_FIRST_INTERNATIONAL_PRIORITY',
  'FEDEX_1_DAY_FREIGHT',
  'FEDEX_2_DAY',
  'FEDEX_2_DAY_AM',
  'FEDEX_2_DAY_FREIGHT',
  'FEDEX_3_DAY_FREIGHT',
  'FEDEX_CARGO_AIRPORT_TO_AIRPORT',
  'FEDEX_CARGO_INTERNATIONAL_PREMIUM',
  'FEDEX_CARGO_MAIL',
  'FEDEX_CUSTOM_CRITICAL_AIR_EXPEDITE',
  'FEDEX_CUSTOM_CRITICAL_AIR_EXPEDITE_EXCLUSIVE_USE',
  'FEDEX_CUSTOM_CRITICAL_AIR_EXPEDITE_NETWORK',
  'FEDEX_CUSTOM_CRITICAL_CHARTER_AIR',
  'FEDEX_CUSTOM_CRITICAL_POINT_TO_POINT',
  'FEDEX_CUSTOM_CRITICAL_SURFACE_EXPEDITE',
  'FEDEX_CUSTOM_CRITICAL_SURFACE_EXPEDITE_EXCLUSIVE_USE',
  'FEDEX_CUSTOM_CRITICAL_TEMP_ASSURE_AIR',
  'FEDEX_CUSTOM_CRITICAL_TEMP_ASSURE_VALIDATED_AIR',
  'FEDEX_CUSTOM_CRITICAL_WHITE_GLOVE_SERVICES',
  'FEDEX_DISTANCE_DEFERRED',
  'FEDEX_ECONOMY',
  'FEDEX_EXPRESS_SAVER',
  'FEDEX_FIRST_OVERNIGHT_EXTRA_HOURS',
  'FEDEX_GROUND',
  'FEDEX_INTERNATIONAL_CONNECT_PLUS',
  'FEDEX_INTERNATIONAL_DEFERRED_FREIGHT',
  'FEDEX_INTERNATIONAL_PRIORITY',
  'FEDEX_INTERNATIONAL_PRIORITY_EXPRESS',
  'FEDEX_INTERNATIONAL_PRIORITY_PLUS',
  'FEDEX_NEXT_DAY_AFTERNOON',
  'FEDEX_NEXT_DAY_EARLY_MORNING',
  'FEDEX_NEXT_DAY_END_OF_DAY',
  'FEDEX_NEXT_DAY_FREIGHT',
  'FEDEX_NEXT_DAY_MID_MORNING',
  'FEDEX_REGIONAL_ECONOMY',
  'FEDEX_REGIONAL_ECONOMY_FREIGHT',
  'FEDEX_STANDARD_OVERNIGHT_EXTRA_HOURS',
  'FIRST_OVERNIGHT',
  'FIRST_OVERNIGHT_FREIGHT',
  'GROUND_HOME_DELIVERY',
  'INTERNATIONAL_ECONOMY',
  'INTERNATIONAL_ECONOMY_DISTRIBUTION',
  'INTERNATIONAL_ECONOMY_FREIGHT',
  'INTERNATIONAL_FIRST',
  'INTERNATIONAL_PRIORITY',
  'INTERNATIONAL_PRIORITY_DISTRIBUTION',
  'INTERNATIONAL_PRIORITY_FREIGHT',
  'PRIORITY_OVERNIGHT',
  'PRIORITY_OVERNIGHT_EXTRA_HOURS',
  'SAME_DAY',
  'SAME_DAY_CITY',
  'SMART_POST',
  'STANDARD_OVERNIGHT',
  'TRANSBORDER_DISTRIBUTION_CONSOLIDATION',
] as const

const packagingTypes = [
  'YOUR_PACKAGING',
  'FEDEX_ENVELOPE',
  'FEDEX_BOX',
  'FEDEX_EXTRA_SMALL_BOX',
  'FEDEX_SMALL_BOX',
  'FEDEX_MEDIUM_BOX',
  'FEDEX_LARGE_BOX',
  'FEDEX_EXTRA_LARGE_BOX',
  'FEDEX_10KG_BOX',
  'FEDEX_25KG_BOX',
  'FEDEX_PAK',
  'FEDEX_TUBE',
] as const

const pickupTypes = [
  'CONTACT_FEDEX_TO_SCHEDULE',
  'DROPOFF_AT_FEDEX_LOCATION',
  'USE_SCHEDULED_PICKUP',
] as const

const pickupRequestTypes = ['FUTURE_DAY', 'SAME_DAY'] as const

const pickupRequestSources = ['AUTOMATION', 'CUSTOMER_SERVICE'] as const

const paymentTypes = ['SENDER', 'RECIPIENT', 'THIRD_PARTY', 'COLLECT'] as const

const labelFormatTypes = ['COMMON2D', 'LABEL_DATA_ONLY'] as const

const imageTypes = ['PDF', 'ZPLII', 'EPL2', 'PNG'] as const

const labelStockTypes = [
  'PAPER_4X6',
  'PAPER_4X675',
  'PAPER_4X8',
  'PAPER_4X9',
  'PAPER_7X475',
  'PAPER_85X11_BOTTOM_HALF_LABEL',
  'PAPER_85X11_TOP_HALF_LABEL',
  'PAPER_LETTER',
  'STOCK_4X6',
  'STOCK_4X675',
  'STOCK_4X675_LEADING_DOC_TAB',
  'STOCK_4X675_TRAILING_DOC_TAB',
  'STOCK_4X8',
  'STOCK_4X85_TRAILING_DOC_TAB',
  'STOCK_4X9',
  'STOCK_4X9_LEADING_DOC_TAB',
  'STOCK_4X9_TRAILING_DOC_TAB',
  'STOCK_4X105_TRAILING_DOC_TAB',
] as const

const labelOrders = ['SHIPPING_LABEL_FIRST', 'SHIPPING_LABEL_LAST'] as const

const labelRotations = ['LEFT', 'RIGHT', 'UPSIDE_DOWN', 'NONE'] as const

const labelPrintingOrientations = [
  'BOTTOM_EDGE_OF_TEXT_FIRST',
  'TOP_EDGE_OF_TEXT_FIRST',
] as const

const labelResponseOptions = ['LABEL', 'URL_ONLY'] as const

const mergeLabelDocOptions = ['NONE', 'LABELS_AND_DOCS', 'LABELS_ONLY'] as const

const processingOptions = ['INCLUDE_PICKUPRATES'] as const

const processingOptionTypes = ['SYNCHRONOUS_ONLY', 'ALLOW_ASYNCHRONOUS'] as const

const shipActions = ['CONFIRM', 'TRANSFER'] as const

const deletionControls = ['DELETE_ALL_PACKAGES'] as const

const customerReferenceTypes = [
  'CUSTOMER_REFERENCE',
  'DEPARTMENT_NUMBER',
  'INVOICE_NUMBER',
  'P_O_NUMBER',
  'INTRACOUNTRY_REGULATORY_REFERENCE',
  'RMA_ASSOCIATION',
] as const

const weightUnits = ['KG', 'LB'] as const

const dimensionUnits = ['CM', 'IN'] as const

const tinTypes = [
  'PERSONAL_NATIONAL',
  'PERSONAL_STATE',
  'FEDERAL',
  'BUSINESS_NATIONAL',
  'BUSINESS_STATE',
  'BUSINESS_UNION',
] as const

const rateRequestTypes = [
  'LIST',
  'NONE',
  'PREFERRED',
  'ACCOUNT',
  'INCENTIVE',
  'RETAIL',
] as const

const returnTypes = ['PENDING', 'PRINT_RETURN_LABEL'] as const

const carrierCodes = ['FDXE', 'FDXG', 'FXSP', 'FDXC', 'FXCC'] as const

export const enumTypeDefs = [
  enumDef(
    'ServiceType',
    'FedEx service type. Common values: FEDEX_GROUND, PRIORITY_OVERNIGHT, STANDARD_OVERNIGHT, FEDEX_2_DAY, FEDEX_EXPRESS_SAVER, INTERNATIONAL_PRIORITY, INTERNATIONAL_ECONOMY.',
    serviceTypes,
  ),
  enumDef(
    'PackagingType',
    'FedEx packaging type. Use YOUR_PACKAGING for your own box; FEDEX_* values are FedEx-supplied packaging.',
    packagingTypes,
  ),
  enumDef(
    'PickupType',
    'How the package enters the FedEx network: scheduled pickup, on-call pickup, or drop-off.',
    pickupTypes,
  ),
  enumDef('PickupRequestType', 'Pickup request window type used in pickupDetail.', pickupRequestTypes),
  enumDef(
    'PickupRequestSourceType',
    'Who created the pickup request in pickupDetail.',
    pickupRequestSources,
  ),
  enumDef(
    'PaymentType',
    'Who pays the shipping charges. FedEx defines SENDER, RECIPIENT, THIRD_PARTY, and COLLECT.',
    paymentTypes,
  ),
  enumDef('LabelFormatType', 'Label format style. COMMON2D is the standard shipping label.', labelFormatTypes),
  enumDef('ImageType', 'Label/document image format.', imageTypes),
  enumDef('LabelStockType', 'Label stock size and layout.', labelStockTypes),
  enumDef('LabelOrder', 'Whether shipping labels print before or after accompanying documents.', labelOrders),
  enumDef('LabelRotation', 'Label rotation for thermal printers with roll stock.', labelRotations),
  enumDef(
    'LabelPrintingOrientation',
    'Label printing orientation for thermal printers with roll stock.',
    labelPrintingOrientations,
  ),
  enumDef(
    'LabelResponseOption',
    'LABEL returns base64 label bytes in the response; URL_ONLY returns temporary FedEx document URLs.',
    labelResponseOptions,
  ),
  enumDef(
    'MergeLabelDocOption',
    'How labels and customs documents are combined in the response.',
    mergeLabelDocOptions,
  ),
  enumDef(
    'ProcessingOption',
    'Shipment processing option. INCLUDE_PICKUPRATES asks FedEx to return pickup rate details for US/Canada shipments.',
    processingOptions,
  ),
  enumDef(
    'ProcessingOptionType',
    'Shipment processing mode. ALLOW_ASYNCHRONOUS lets FedEx queue the request and return a jobId.',
    processingOptionTypes,
  ),
  enumDef(
    'ShipAction',
    'Open shipment action. CONFIRM confirms the shipment; TRANSFER hands it to another party.',
    shipActions,
  ),
  enumDef(
    'DeletionControl',
    'Which packages to cancel. The Ship API currently supports DELETE_ALL_PACKAGES only.',
    deletionControls,
  ),
  enumDef('CustomerReferenceType', 'Type of customer reference printed on the label.', customerReferenceTypes),
  enumDef('WeightUnit', 'Package weight unit. FedEx accepts KG or LB.', weightUnits),
  enumDef('DimensionUnit', 'Package dimension unit. FedEx accepts CM or IN.', dimensionUnits),
  enumDef(
    'TinType',
    'Type of tax identification number (TaxpayerIdentification.tinType).',
    tinTypes,
  ),
  enumDef(
    'RateRequestType',
    'Rate types to return in the shipment response.',
    rateRequestTypes,
  ),
  enumDef(
    'ReturnType',
    'Return-shipment type. Use PRINT_RETURN_LABEL for a printed return label or PENDING for email returns.',
    returnTypes,
  ),
  enumDef(
    'CarrierCode',
    'FedEx carrier for postal-code validation: FDXE Express, FDXG Ground, FXSP Ground Economy, FDXC, FXCC.',
    carrierCodes,
  ),
].join('\n\n')
