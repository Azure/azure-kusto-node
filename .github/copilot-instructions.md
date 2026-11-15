# Copilot Instructions for azure-kusto-node

## Build, Test, and Lint

This is an npm workspaces + fixed-version Lerna monorepo requiring Node.js >=22.12.0 and npm 11.21.2. It contains two published SDKs, `azure-kusto-data` and `azure-kusto-ingest`, and two private sample workspaces, `azure-kusto-quick-start` and `azure-kusto-quick-start-browser`.

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
npm run testQuickStart              # Offline Node sample module/path tests (Node test runner)

# Run a single test file
npx cross-env NODE_OPTIONS="--experimental-vm-modules" jest --selectProjects azure-kusto-data -- test/clientTest.ts

# Run a single test by name
npx cross-env NODE_OPTIONS="--experimental-vm-modules" jest -t "test name pattern"
```

`NODE_OPTIONS="--experimental-vm-modules"` is required because the project uses ESM with ts-jest.

Test files live in `packages/<package>/test/` and must match the pattern `**/test/**/*Test.ts`.

Tests gated behind credentials use `loginTest` / `manualLoginTest` helpers from `packages/azure-kusto-data/test/data/testUtils.ts` and run when `LOGIN_TEST` is nonempty. Keep it empty/unset for offline tests; `false` is still nonempty.

E2E tests use `ENGINE_CONNECTION_STRING`, `DM_CONNECTION_STRING`, and `TEST_DATABASE`, with `AzureCliCredential` and an existing Azure CLI login by default. Local application-key authentication is optional when `APP_ID`, `APP_KEY`, and `TENANT_ID` are all set; do not provide `APP_KEY` in CI.

### Continuous integration

Credential-free build, formatting/lint checks, and unit tests run in `.github/workflows/build.yml` on `master` pushes and every PR, including forks. Test the exact Node 22.12.0 minimum and latest Node 22/24/26 using npm 11.21.2, including both sample builds and `testQuickStart`. The Node 22 build job uses `npm run testNoE2E -- --ci --maxWorkers=2 --coverage` with `AUTO_TEST=true` and an empty `LOGIN_TEST`, then uploads unit coverage using the existing Codecov GitHub Action invocation. Do not add Azure login or Azure/Kusto secrets to this workflow.

Authenticated E2E tests run in `.azuredevops/build-and-e2e.yml` using the WIF-backed `kusto-connectors-arm-sc` service connection. Dependency installation/builds are prerequisites; unit tests, formatting checks, and lint stay in GitHub CI. Run E2E inside `AzureCLI@2` to preserve its task-local CLI configuration. The `azure-kusto-node-e2e` variable group supplies the endpoint/database settings. Azure publishes E2E test/coverage reports but must not upload to Codecov or require a Codecov group/token.

Use `npm run testPipeline -- --testPathPattern '/.*e2e.*/'`, `AUTO_TEST=true`, and `LOGIN_TEST=true` in Azure CI. This complements the GitHub `testNoE2E` exclusion and includes all suites in the selected E2E files. Do not replace it with `testE2E`, whose name filter omits the sibling `NoRedirects` and `Mgmt Parsing` integration suites.

Fork PRs receive GitHub build/lint/unit validation but do not run authenticated Azure E2E. Same-repository Azure PR runs require maintainer approval for the current revision; trusted `master` pushes and manual runs are supported. Enforce Azure trust through project/resource policies as well as the YAML condition. Release and CodeQL remain in GitHub Actions.

Kusto-issued SAS URLs authorize the existing Blob/Queue/Table test operations; do not add static storage credentials or separate storage connections for them. See `CONTRIBUTING.md` for platform setup and validation prerequisites.

## Architecture

### Monorepo layout

- **`azure-kusto-data`** — Query client SDK. Core types: `KustoClient`, `KustoConnectionStringBuilder`, `KustoResponseDataSet`, `ClientRequestProperties`. Handles authentication, connection building, query execution, and response parsing.
- **`azure-kusto-ingest`** — Ingestion client SDK. Depends on `azure-kusto-data`. Core types: `IngestClient`, `StreamingIngestClient`, `ManagedStreamingIngestClient`, `IngestionProperties`. Handles queued, streaming, and managed-streaming ingestion into Kusto clusters.
- **`quick_start`** — Private Node ESM sample. Builds to `dist/`; `npm run quick_start` builds and executes `dist/main.js`. Config/datasets stay under `src/`.
- **`quick_start_browser`** — Private React/Vite sample. Builds to `dist/` and bundles the SDK browser implementations. Do not externalize the SDKs.

Nx builds SDK dependencies before the samples. Keep one root lockfile and ordinary matching SDK semver ranges so standalone samples also work after publication. Only the two SDKs are packed/published; private workspaces must not become release assets.

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

- **Build output** goes to `dist-esm/` (JS) and `types/` (declarations) in SDK packages, and `dist/` in samples. Sample manifests override the Nx build outputs accordingly.

- **`no-console` is an ESLint error** — Do not use `console.log` in source code.

- **`@typescript-eslint/no-explicit-any` is off** — `any` is permitted but should be used sparingly.
