# Contributing to Azure Node SDK

If you would like to become an active contributor to this project please
follow the instructions provided in [Microsoft Azure Projects Contribution Guidelines](https://azure.github.io/azure-sdk/general_introduction.html).

## Requirements

In order to work on this project, we recommend using the dev requirements:

```bash
npm install --only=dev
```

These including testing related packages as well as styling ([eslint](https://eslint.org/))

## Testing

This project uses [mocha](https://mochajs.org/) for testing.
You can tun UT by:

```bash
npm test 
```

On creating PR or pushing a commit there is an automate validation which run lint, UT and E2E test.

## PRs
We welcome contributions. In order to make the PR process efficient, please follow the below checklist:

* **There is an issue open concerning the code added** - (either bug or enhancement).
    Preferably there is an agreed upon approach in the issue.
* **PR comment explains the changes done** - (This should be a TL;DR; as the rest of it should be documented in the related issue).
* **PR is concise** - try and avoid make drastic changes in a single PR. Split it into multiple changes if possible. If you feel a major change is needed, it is ok, but make sure commit history is clear and one of the maintainers can comfortably review both the code and the logic behind the change. 
* **Please provide any related information needed to understand the change** - docs, guidelines, use-case, best practices and so on. Opinions are accepted, but have to be backed up.
* **Checks should pass** - these including linting with black and running tests.

## Code of Conduct
This project's code of conduct can be found in the
[CODE_OF_CONDUCT.md file](https://github.com/Azure/azure-kusto-node/blob/master/CODE_OF_CONDUCT.md)
(v1.4.0 of the http://contributor-covenant.org/ CoC).
