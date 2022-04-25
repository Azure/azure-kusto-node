# Contributing to Azure Node SDK

If you would like to become an active contributor to this project please
follow the instructions provided in [Microsoft Azure Projects Contribution Guidelines](https://azure.github.io/azure-sdk/general_introduction.html).

## Requirements

In order to work on this project, we recommend using the both production and dev dependencies:

```bash
npx lerna bootstrap --hoist
```

These include testing related packages as well as styling ([eslint](https://eslint.org/))

## Testing

This project uses [mocha](https://mochajs.org/) for testing.

First, enter the directory of the package to run the tests on:

```bash
cd packages/azure-kusto-data
# or:
cd packages/azure-kusto-ingest
```

In order to run unittests execute:

```bash
npm test
```

Tests that need credentials to run will not run by default.
To run them, set the enviornment variable `LOGIN_TEST=1`
These tests will usually need more credentials, which will be passed via enviornment variables.
See tests that are declared with `loginTest` or `manualLoginTest` for their requirements.

In order to check coding style compliance excute:

```bash
npm run lint
npm run checkFormat
```

To run end to end tests from the `azure-kusto-ingest` packge, you will need to set up environment variables:

```bash
# The following instructions are for bash. When using a different shell, use the syntax for setting environment variables.
export ENGINE_CONNECTION_STRING=https://<your-cluster>.kusto.windows.net
export DM_CONNECTION_STRING=https://ingest-<your-cluster>.kusto.windows.net
export TEST_DATABASE=<your-database>
export APP_ID=<your-app-id>
export APP_KEY=<your-app-key>
export TENANT_ID=<your-tenant-id>

npm run e2e
```

On creating PR or pushing a commit there is an automated validation which runs lint, unittests and end2end tests.

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
