# Contributing to Azure Node SDK

If you would like to become an active contributor to this project please
follow the instructions provided in [Microsoft Azure Projects Contribution Guidelines](https://azure.github.io/azure-sdk/general_introduction.html).

## Requirements

In order to work on this project, we recommend using the both production and dev dependencies:

```bash
npm i
```

These include testing related packages as well as styling ([eslint](https://eslint.org/))

## Testing

This project uses [Jest](https://jestjs.io/) for testing. Run commands from the repository root.

To run unit tests without the authenticated E2E suite:

```bash
npm run testNoE2E
# Select a package:
npm run testData
npm run testIngestNoE2E
```

Tests that need credentials to run will not run by default.
To enable credential-gated tests, set the environment variable `LOGIN_TEST=1`.
Set `AUTO_TEST=true` to exclude tests requiring interactive or machine-specific authentication.
See tests that are declared with `loginTest` or `manualLoginTest` for their requirements.

To check coding style compliance:

```bash
npm run lint
npm run checkFormat
```

To run the full pipeline suite, including ingestion E2E tests, sign in with Azure CLI and configure an approved test database:

```bash
# The following instructions are for bash. When using a different shell, use the syntax for setting environment variables.
az login --tenant "<your-tenant-id>"
export ENGINE_CONNECTION_STRING="https://<your-cluster>.kusto.windows.net"
export DM_CONNECTION_STRING="https://ingest-<your-cluster>.kusto.windows.net"
export TEST_DATABASE="<your-database>"
export AUTO_TEST=true
export LOGIN_TEST=true

npm run testPipeline
```

The tests use `AzureCliCredential` by default. Local application-key authentication is optional: set `APP_ID`, `APP_KEY`, and `TENANT_ID` together to select it. Do not provide `APP_KEY` in CI. The test principal must be able to query, create/alter/drop test tables, configure ingestion policies/mappings, and access the ingestion resources returned by Kusto. E2E tests modify the configured database; do not use a production database.

Use `npm run testPipeline` for parity with CI. `npm run testE2E` filters by the name "E2E Tests" and excludes other integration suites in the same file.

## Continuous integration

Build, lint, unit tests, and authenticated E2E run in [Azure Pipelines](.azuredevops/build-and-e2e.yml). Release and CodeQL workflows remain in GitHub Actions. The Azure pipeline runs on `master` pushes, maintainer-approved same-repository PRs targeting `master`, and trusted manual runs. Fork PRs do not run build/unit/E2E validation in this phase; CodeQL remains available.

Before enabling the pipeline, configure these project resources and authorize only the intended pipeline:

| Resource | Required configuration |
| --- | --- |
| Azure Pipelines GitHub App | Repository checkout, push/PR triggers, and GitHub check reporting for `Azure/azure-kusto-node`. |
| `kusto-connectors-arm-sc` | Azure Resource Manager service connection using workload identity federation, with the appropriate ADX database permissions and a maintainer approval check. |
| `azure-kusto-node-e2e` variable group | `ENGINE_CONNECTION_STRING`, `DM_CONNECTION_STRING`, and `TEST_DATABASE` for the approved test environment. |
| `azure-kusto-node-codecov` variable group | Secret `CODECOV_TOKEN` for this repository, with restricted pipeline access. The token is mapped only to the upload step. |

Configure project/pipeline policies to block fork PR runs and require maintainer approval for each same-repository PR revision before protected resources are used. Restrict manual runs to trusted branches and maintainers. The YAML fork condition alone is not a security boundary because PRs can modify YAML.

Kusto returns SAS URLs for the Blob, Queue, and Table operations exercised by ingestion tests. No separate storage service connection or static storage key is required for these existing paths. The tests must run inside `AzureCLI@2` so they inherit its authenticated CLI configuration.

JUnit and coverage reports are published in Azure. Coverage is also uploaded with a checksum-pinned Codecov CLI, preserving `codecov.yml`'s informational coverage policy. Codecov upload failures are reported as non-blocking Azure task issues; lint and test failures remain blocking.

Validate a trusted Azure run, test/coverage publication, Codecov PR association, and the approval/fork policies before merging the cutover. Coordinate obsolete required-check removal with a repository administrator without weakening unrelated protections. A universally required Azure check must be reconciled with the intentional absence of fork builds.

## PRs

We welcome contributions. In order to make the PR process efficient, please follow the below checklist:

-   **There is an issue open concerning the code added** - (either bug or enhancement).
    Preferably there is an agreed upon approach in the issue.
-   **PR comment explains the changes done** - (This should be a TL;DR; as the rest of it should be documented in the related issue).
-   **PR is concise** - try and avoid make drastic changes in a single PR. Split it into multiple changes if possible. If you feel a major change is needed, it is ok, but make sure commit history is clear and one of the maintainers can comfortably review both the code and the logic behind the change.
-   **Please provide any related information needed to understand the change** - docs, guidelines, use-case, best practices and so on. Opinions are accepted, but have to be backed up.
-   **Checks should pass** - these include running coding style compliance check and unittests noted above.

## Code of Conduct

This project's code of conduct can be found in the
[CODE_OF_CONDUCT.md file](https://github.com/Azure/azure-kusto-node/blob/master/CODE_OF_CONDUCT.md)
(v1.4.0 of the http://contributor-covenant.org/ CoC).
