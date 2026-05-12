# Copilot Instructions for azure-kusto-node

## Build, Test, and Lint

This is an npm workspaces + Lerna monorepo with two packages: `azure-kusto-data` and `azure-kusto-ingest`.

```bash
npm ci                  # Install dependencies
npm run build           # Build all packages (uses Lerna + Nx caching)
npm run lint            # ESLint
npm run checkFormat     # Prettier check
npm run format          # Prettier fix
```

### Testing (Jest)

```bash
npm test                            # Run all tests
npm run testData                    # Run only azure-kusto-data tests
npm run testIngest                  # Run only azure-kusto-ingest tests
npm run testNoE2E                   # All tests except E2E

# Run a single test file
npx cross-env NODE_OPTIONS="--experimental-vm-modules" jest --selectProjects azure-kusto-data -- test/clientTest.ts

# Run a single test by name
npx cross-env NODE_OPTIONS="--experimental-vm-modules" jest -t "test name pattern"
```

`NODE_OPTIONS="--experimental-vm-modules"` is required because the project uses ESM with ts-jest.

Test files live in `packages/<package>/test/` and must match the pattern `**/test/**/*Test.ts`.

Tests gated behind credentials use `loginTest` / `manualLoginTest` helpers from `packages/azure-kusto-data/test/data/testUtils.ts` and only run when `LOGIN_TEST=1` is set.

E2E tests require Azure environment variables (`ENGINE_CONNECTION_STRING`, `DM_CONNECTION_STRING`, `TEST_DATABASE`, `APP_ID`, `APP_KEY`, `TENANT_ID`).

## Architecture

### Monorepo layout

- **`azure-kusto-data`** — Query client SDK. Core types: `KustoClient`, `KustoConnectionStringBuilder`, `KustoResponseDataSet`, `ClientRequestProperties`. Handles authentication, connection building, query execution, and response parsing.
- **`azure-kusto-ingest`** — Ingestion client SDK. Depends on `azure-kusto-data`. Core types: `IngestClient`, `StreamingIngestClient`, `ManagedStreamingIngestClient`, `IngestionProperties`. Handles queued, streaming, and managed-streaming ingestion into Kusto clusters.

### Browser dual-target pattern

Both packages support browser environments via the `"browser"` field in `package.json`, which maps Node-specific modules to `*.browser.ts` variants at bundle time. For example:
- `connectionBuilder.js` → `connectionBuilder.browser.js` (restricts auth to browser-safe methods)
- `ingestClient.js` → `ingestClient.browser.js`
- `streamUtils.js` → `streamUtils.browser.js`

When adding or modifying a Node-specific module that has a browser counterpart, update both files and ensure the browser variant doesn't use Node-only APIs (fs, streams, etc.). Browser auth is limited to `withUserPrompt`, `withAccessToken`, `withTokenProvider`, and `withTokenCredential`.

### Authentication flow

`KustoConnectionStringBuilder` configures auth via static factory methods (e.g., `withAadApplicationKeyAuthentication`, `withAzLoginIdentity`). At runtime, `AadHelper` (in `security.ts`) selects the appropriate `TokenProvider` subclass from `tokenProvider.ts`. Auth failures are wrapped in `KustoAuthenticationError` with the provider name and inner error.

### Error types

- `KustoAuthenticationError` — Auth failures (data package)
- `ThrottlingError` — Server throttling responses (data package)
- `IngestionPropertiesValidationError` — Invalid ingestion configuration (ingest package)

## Conventions

- **License header required** on every `.ts` source file:
  ```
  // Copyright (c) Microsoft Corporation.
  // Licensed under the MIT License.
  ```
  This is enforced by the `header/header` ESLint rule.

- **ESM modules** — The project uses `"module": "NodeNext"` in tsconfig. Imports must include the `.js` extension (e.g., `import { Foo } from "./foo.js"`).

- **Build output** goes to `dist-esm/` (JS) and `types/` (declarations) in each package.

- **`no-console` is an ESLint error** — Do not use `console.log` in source code.

- **`@typescript-eslint/no-explicit-any` is off** — `any` is permitted but should be used sparingly.
