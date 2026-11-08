# FedEx GraphQL

A small GraphQL server that wraps the **FedEx Ship API (REST v1)** and **FedEx Track API (REST v1)**. It handles FedEx OAuth and maps the full schemas from `ship.json` and `track.json` onto the FedEx endpoints as typed GraphQL objects.

- Node.js + TypeScript
- [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) + [GraphiQL 6](https://github.com/graphql/graphiql)
- OAuth `client_credentials` token cached in memory (no credentials ever reach clients)
- Sandbox by default, production via one env var
- No database; GraphiQL and all of its frontend modules are bundled and served locally (no CDN)

## Endpoints covered

| GraphQL operation | Kind | FedEx REST endpoint |
| --- | --- | --- |
| `createShipment` | mutation | `POST /ship/v1/shipments` |
| `validateShipment` | mutation | `POST /ship/v1/shipments/packages/validate` |
| `cancelShipment` | mutation | `PUT /ship/v1/shipments/cancel` |
| `createTag` | mutation | `POST /ship/v1/shipments/tag` |
| `cancelTag` | mutation | `PUT /ship/v1/shipments/tag/cancel/{shipmentId}` |
| `asyncShipment` | query | `POST /ship/v1/shipments/results` |
| `validateAddress` | query | `POST /address/v1/addresses/resolve` |
| `validatePostalCode` | query | `POST /country/v1/postal/validate` |
| `trackShipment` | query | `POST /track/v1/trackingnumbers` |
| `trackByReferenceNumbers` | query | `POST /track/v1/referencenumbers` |
| `trackAssociatedShipments` | query | `POST /track/v1/associatedshipments` |
| `trackByTcn` | query | `POST /track/v1/tcn` |
| `trackDocuments` | query | `POST /track/v1/trackingdocuments` |
| `sendTrackingNotifications` | mutation | `POST /track/v1/notifications` |
| `fedexHealth` | query | local status, no FedEx call |

`validateAddress` and `validatePostalCode` use FedEx's Address Validation and Postal Code Validation APIs, which are the usual pre-flight checks before creating a shipment. The Track API operations use the same cached OAuth token and return the full typed response structure from `track.json`.

## Setup

1. Create a project at [developer.fedex.com](https://developer.fedex.com/) and note its **API key** and **secret**. The sandbox gives you a test account number.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env` and fill in your credentials:

   ```bash
   cp .env.example .env
   ```

   PowerShell: `Copy-Item .env.example .env`

   ```dotenv
   FEDEX_CLIENT_ID=your_api_key
   FEDEX_CLIENT_SECRET=your_api_secret
   FEDEX_ACCOUNT_NUMBER=your_test_account_number
   FEDEX_ENVIRONMENT=sandbox
   ```

4. Start the server:

   ```bash
   npm run dev
   ```

5. Open GraphiQL at <http://localhost:4000/graphql>.

Other scripts:

```bash
npm run typecheck      # TypeScript, no emit
npm test               # schema + payload-builder tests (no credentials needed)
npm run build:frontend # bundle GraphiQL, Monaco, and CSS into public/assets
npm run build          # build the frontend, then compile to dist/
npm start              # run the compiled server
npm run build:exe      # standalone executable in build/
npm run generate       # regenerate src/graphql/generated.ts from ship.json
npm run schema         # regenerate Fedex* types and schema.graphql
```

`npm run dev` builds `public/assets` automatically before starting the watcher.

## Standalone executable

```bash
npm run build:exe
```

On Windows this produces `build/fedex-graphql.exe` (on macOS/Linux, `build/fedex-graphql`). It embeds the app, all npm dependencies, the frontend assets (`public/assets`), and the Node runtime, so the target machine does not need Node, npm, or internet access for the UI.

The executable does **not** embed `.env` or any credentials. Put `.env` next to the executable, or set the variables in the environment. At startup it checks, in order:

1. `DOTENV_CONFIG_PATH`, if set
2. `.env` in the current working directory
3. `.env` in the executable's directory

The build script also leaves `build/fedex-graphql.cjs`, a single-file CommonJS bundle that can be run with `node build/fedex-graphql.cjs`.

Notes:

- The executable is built for the platform and CPU architecture running the build; this script does not cross-compile.
- Windows will warn that the executable is unsigned (SmartScreen). macOS builds are ad-hoc signed by the script.
- GraphiQL, Monaco, and the Monaco workers are bundled into the executable and served from `/assets`, so the browser does not need internet access. FedEx API calls still need outbound network access.

## Example: create a shipment

Run this in GraphiQL. FedEx enum-like fields are real GraphQL enums, so you get value autocomplete as you type (no quotes around enum values):

```graphql
mutation CreateShipment {
  createShipment(
    input: {
      requestedShipment: {
        pickupType: USE_SCHEDULED_PICKUP
        serviceType: FEDEX_GROUND
        packagingType: YOUR_PACKAGING
        shipper: {
          contact: { personName: "Warehouse", phoneNumber: "9015550100" }
          address: {
            streetLines: ["1 Main St"]
            city: "Memphis"
            stateOrProvinceCode: "TN"
            postalCode: "38101"
            countryCode: "US"
          }
        }
        recipients: [
          {
            contact: { personName: "Customer", phoneNumber: "9015550101" }
            address: {
              streetLines: ["10 FedEx Parkway"]
              city: "Collierville"
              stateOrProvinceCode: "TN"
              postalCode: "38017"
              countryCode: "US"
            }
          }
        ]
        requestedPackageLineItems: [{ weight: { value: 2, units: LB } }]
      }
    }
  ) {
    transactionId
    jobId
    errors {
      code
      message
    }
    shipments {
      masterTrackingNumber
      serviceType
      pieces {
        trackingNumber
        netChargeAmount
        documents {
          docType
          url
          encodedLabel
        }
      }
    }
  }
}
```

`labelResponseOptions` defaults to `LABEL`, so documents contain base64 `encodedLabel` values. Pass `labelResponseOptions: URL_ONLY` to get document URLs instead.

FedEx's document URLs are temporary (active for about 24 hours) and are not guaranteed to open directly in a browser: they can point at an internal sandbox host or return an XML/JSON error envelope. For that reason:

- `Document.url` is a clickable link to this server (`/documents?url=...`). The server fetches the document, follows FedEx's error envelope if the link expired, and returns the PDF.
- `Document.fedexUrl` is the temporary FedEx URL.
- Set `PUBLIC_BASE_URL` if the server is reached through a host other than `http://localhost:$PORT`, otherwise the generated links point at localhost.
- The proxy only accepts HTTPS `*.fedex.com/document/...` URLs, so it cannot be used to fetch arbitrary hosts. It is a document endpoint, not a GraphQL endpoint: no query or mutation travels in its URL.
- For documents you need to keep, use `labelResponseOptions: LABEL`, base64-decode `encodedLabel`, and store the bytes. The URL is not a permanent document store.

More operations are in [`examples/operations.graphql`](examples/operations.graphql): cancel, validate, return tags, async retrieval, address and postal validation.

## How it behaves

### GraphQL transport

GraphQL operations must be sent as a **POST body** (`application/json` with `query`, `variables`, and `operationName`). GraphiQL already does this. Requests that put an operation in the URL query string (`GET /graphql?query=...`) are rejected with HTTP 405, so queries, mutations, and variables do not end up in URLs, browser history, or access logs.

The frontend is the current GraphiQL v6 (React 19, GraphiQL 6.0.1), bundled at build time with esbuild and served from `/assets` by the same server. React, GraphiQL, Monaco, the Monaco workers, and the CSS are all local, so the UI has no CDN dependency. It uses an explicit POST-only transport, so even queries are sent in the request body. GraphiQL keeps its editor tabs in browser storage and does not write the current operation into the page URL, including when switching tabs. An old `?query=...` URL is cleaned up when the page loads.

### Authentication and token caching

The server exchanges `FEDEX_CLIENT_ID` / `FEDEX_CLIENT_SECRET` for an OAuth token at `POST /oauth/token`, caches it in memory, refreshes it 60 seconds before expiry, coalesces concurrent refreshes, and retries once with a fresh token if FedEx returns `401`. Clients only talk to your GraphQL server.

### Conversation with FedEx

- `accountNumber` is optional on inputs and falls back to `FEDEX_ACCOUNT_NUMBER`. The shipper's account number also falls back to it.
- `shippingChargesPayment` defaults to `{ paymentType: "SENDER" }` when omitted.
- `labelSpecification` defaults to `COMMON2D` / `PDF` / `PAPER_4X6` / 300 dpi.
- `totalWeight` is derived by summing `requestedPackageLineItems[].weight.value` when omitted.
- Return tags use `shipTimestamp` (not `shipDatestamp`) and a typed `pickupDetail`. Use `returnType: PRINT_RETURN_LABEL` for a printed return label (`PENDING` is the other spec value).
- `cancelTag` takes `shipmentId`, `serviceType`, and `completedTagDetail { confirmationNumber, location, dispatchDate }`, matching the Ship API request.
- FedEx application-level errors in an HTTP 200 body (missing fields, invalid address, and so on) are returned in the `errors` field, not thrown. This makes `validateShipment` usable as intended.
- Transport failures, auth failures, and non-2xx responses are thrown as GraphQL errors with extension codes `FEDEX_API_ERROR` or `FEDEX_AUTH_ERROR`. The response body is attached under `extensions.fedex`.
- If FedEx queues a shipment asynchronously, `createShipment` returns a `jobId` and possibly no shipments yet. Poll `asyncShipment(input: { jobId: "..." })` until the documents appear.

### FedEx enums and autocomplete

FedEx value sets are modeled as real GraphQL enums, which is what drives value autocomplete in GraphiQL and GraphQL IDE extensions:

`ServiceType`, `PackagingType`, `PickupType`, `PickupRequestType`, `PickupRequestSourceType`, `PaymentType`, `LabelFormatType`, `ImageType`, `LabelStockType`, `LabelOrder`, `LabelRotation`, `LabelPrintingOrientation`, `LabelResponseOption`, `MergeLabelDocOption`, `ProcessingOption`, `ProcessingOptionType`, `ShipAction`, `DeletionControl`, `CustomerReferenceType`, `WeightUnit`, `DimensionUnit`, `TinType`, `RateRequestType`, `ReturnType`, and `CarrierCode`.

- Inline literals are unquoted: `serviceType: FEDEX_GROUND`.
- In variables they are plain strings: `{ "serviceType": "FEDEX_GROUND" }`.
- The lists live in [`src/graphql/enums.ts`](src/graphql/enums.ts). If FedEx introduces a new value, add it there and run `npm run schema`.
- Only **inputs** use enums. Response fields remain `String`, so a new value returned by FedEx cannot break serialization.
- OpenAPI enums that appear on input objects also become generated GraphQL enums, so nested FedEx objects autocomplete their allowed values.
- The generated input enums live in [`src/graphql/generated.ts`](src/graphql/generated.ts), which is built from `ship.json`.

### Full OpenAPI schema

Every object, enum, and alias in `ship.json` and `track.json` has a GraphQL equivalent. Generated names are prefixed so they cannot collide with the hand-written convenience types or with each other:

- `Fedex<Name>` / `Fedex<Name>Input` are the Ship API response/request types.
- `FedexTrack<Name>` / `FedexTrack<Name>Input` are the Track API response/request types.
- Generated enums appear on input fields as real GraphQL enums.
- Top-level OpenAPI array schemas are expanded inline as GraphQL lists.

The hand-written types cover the common domestic shipping flow and add conveniences such as derived weights, label proxy URLs, and flattened result shapes. The generated types are available everywhere a corresponding field is typed in the noted inputs; for example `requestedShipment.customsClearanceDetail` accepts `FedexCustomsClearanceDetailInput`, and the Track API accepts `FedexTrackFull_Schema_Tracking_NumbersInput` and returns `FedexTrackTrkcResponseVO_TrackingNumber`.

There is no `JSON` scalar and no untyped pass-through field. Run `npm run generate` after changing either OpenAPI document, or `npm run schema` to regenerate and print the SDL.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `FEDEX_CLIENT_ID` | required | API key from the FedEx developer project |
| `FEDEX_CLIENT_SECRET` | required | API secret |
| `FEDEX_ACCOUNT_NUMBER` | none | Default FedEx account number |
| `FEDEX_ENVIRONMENT` | `sandbox` | `sandbox` or `production` |
| `FEDEX_BASE_URL` | environment default | Override for mocks/proxies |
| `FEDEX_LOCALE` | `en_US` | Sent as `x-locale` |
| `FEDEX_TIMEOUT_MS` | `30000` | Per-request timeout |
| `PORT` | `4000` | GraphQL server port |
| `PUBLIC_BASE_URL` | `http://localhost:$PORT` | Public origin used to build clickable document links |

Sandbox uses `https://apis-sandbox.fedex.com`; production uses `https://apis.fedex.com`.

## Project layout

```text
src/
  config.ts              env parsing, defaults, credential checks
  server.ts              HTTP server + GraphQL Yoga (POST-only operations)
  http.ts                request guards
  assets.ts              serves bundled frontend assets (disk or SEA-embedded)
  graphiql.ts            GraphiQL v6 page (POST-only transport, local assets)
  documents-route.ts     /documents proxy for bearer-protected FedEx links
  frontend/
    main.tsx             GraphiQL React entry point
    workers/             Monaco editor, JSON, and GraphQL worker entries
  fedex/
    client.ts            OAuth cache + REST request helper
    documents.ts         validates and downloads FedEx document URLs
    errors.ts            error types and GraphQL error mapping
  graphql/
    typeDefs.ts          schema SDL
    enums.ts             FedEx value sets exposed as GraphQL enums
    resolvers.ts         endpoint wiring
    serialize.ts         GraphQL input -> FedEx request payloads
    map.ts               FedEx responses -> GraphQL result shapes
    generated.ts         generated Fedex*/FedexTrack* types (do not edit)
    schema.ts            executable schema
examples/operations.graphql
scripts/
  generate-fedex-types.mjs  generates Fedex*/FedexTrack* types from ship.json + track.json
  build-frontend.mjs     bundles GraphiQL, Monaco workers, and CSS into public/
  build-sea.mjs          bundles and builds the standalone executable
public/assets/           generated frontend bundle (git-ignored)
test/                    schema and payload tests
schema.graphql           generated SDL snapshot
```

## Security notes

This service is meant to run server-side. FedEx credentials grant access to your shipping account, so do not deploy it as-is on the public internet. Add authentication/authorization in front of `/graphql` and `/documents`, rate limiting, request logging that excludes label bytes and personal data, and outbound network controls. Never send FedEx secrets to a browser or mobile client.

## Limitations

- Generated types come from `ship.json` and `track.json`. If FedEx adds a field to a published spec, refresh the document, run `npm run generate`, and rebuild.
- Enum lists are a snapshot of FedEx's documented values. GraphQL rejects values that are not in the list; add new values to the OpenAPI document or `src/graphql/enums.ts`, then run `npm run generate`.
- The Track API returns only fields documented in `track.json`. FedEx sometimes returns extra fields; those are intentionally not exposed by GraphQL.
- The Ship REST API has no synchronous "get shipment by tracking number" endpoint. `asyncShipment` retrieves results by `jobId`; live tracking belongs to the separate Track API.
- Return-tag requests vary by service and pickup mode. `createTag` reuses the shipment input plus `requestedShipment.pickupDetail`; for lane-specific fields, use the matching typed `Fedex*Input` fields from `ship.json`.
- This is an independent wrapper, not affiliated with or supported by FedEx.
