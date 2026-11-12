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

To run the authenticated E2E suite, sign in with Azure CLI and configure an approved test database:

```bash
# The following instructions are for bash. When using a different shell, use the syntax for setting environment variables.
az login --tenant "<your-tenant-id>"
export ENGINE_CONNECTION_STRING="https://<your-cluster>.kusto.windows.net"
export DM_CONNECTION_STRING="https://ingest-<your-cluster>.kusto.windows.net"
export TEST_DATABASE="<your-database>"
export AUTO_TEST=true
export LOGIN_TEST=true

npm run testPipeline -- --testPathPattern '/.*e2e.*/'
```

The tests use `AzureCliCredential` by default. Local application-key authentication is optional: set `APP_ID`, `APP_KEY`, and `TENANT_ID` together to select it. Do not provide `APP_KEY` in CI. The test principal must be able to query, create/alter/drop test tables, configure ingestion policies/mappings, and access the ingestion resources returned by Kusto. E2E tests modify the configured database; do not use a production database.

Use `npm run testNoE2E -- --ci --maxWorkers=2 --coverage` for parity with the GitHub unit-coverage job. Azure selects the E2E test paths using the complementary pattern, including the sibling `NoRedirects` and `Mgmt Parsing` suites. `npm run testPipeline` without a path selector still runs all tests locally. `npm run testE2E` filters by the name "E2E Tests" and excludes those sibling integration suites.

## Continuous integration

Build, formatting/lint checks, and non-E2E unit tests run in [GitHub Actions](.github/workflows/build.yml) on `master` pushes and every PR, including forks. The existing Node 20/22/24 offline test matrix is retained. The Node 20 build job generates unit coverage and uploads it using the existing Codecov GitHub Action invocation, without adding a token requirement. This workflow does not use Azure/Kusto credentials or a protected environment.

Authenticated E2E tests run in [Azure Pipelines](.azuredevops/build-and-e2e.yml) on `master` pushes, maintainer-approved same-repository PRs targeting `master`, and trusted manual runs. Azure installs/builds the SDK as an E2E prerequisite but does not run the unit-test suite, formatting checks, or lint. Fork PRs retain GitHub build/lint/unit validation but do not run authenticated Azure E2E. Release and CodeQL workflows remain in GitHub Actions.

Before enabling the pipeline, configure these project resources and authorize only the intended pipeline:

| Resource | Required configuration |
| --- | --- |
| Azure Pipelines GitHub App | Repository checkout, push/PR triggers, and GitHub check reporting for `Azure/azure-kusto-node`. |
| `kusto-connectors-arm-sc` | Azure Resource Manager service connection using workload identity federation, with the appropriate ADX database permissions and a maintainer approval check. |
| `azure-kusto-node-e2e` variable group | `ENGINE_CONNECTION_STRING`, `DM_CONNECTION_STRING`, and `TEST_DATABASE` for the approved test environment. |

Configure Azure project/pipeline policies to block fork PR runs and require maintainer approval for each same-repository PR revision before protected resources are used. Restrict manual Azure runs to trusted branches and maintainers. The YAML fork condition alone is not a security boundary because PRs can modify YAML. These restrictions do not apply to credential-free GitHub build/lint/unit validation.

Kusto returns SAS URLs for the Blob, Queue, and Table operations exercised by ingestion tests. No separate storage service connection or static storage key is required for these existing paths. The tests must run inside `AzureCLI@2` so they inherit its authenticated CLI configuration.

E2E JUnit and Cobertura coverage reports are published in Azure. Unit coverage is uploaded to Codecov only from GitHub Actions, preserving `codecov.yml`'s informational coverage policy. Azure does not upload to Codecov and requires no Codecov variable group or token.

Validate GitHub CI and Codecov PR association, a trusted Azure E2E run and its test/coverage publication, and the Azure approval/fork policies before merging the cutover. Coordinate required-check changes with a repository administrator without weakening unrelated protections or removing GitHub build/unit validation. A universally required Azure E2E check must be reconciled with the intentional absence of fork E2E runs.

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
