# Live result-row load comparison

Opt-in before/after testing for [#459](https://github.com/Azure/azure-kusto-node/issues/459).
This is not part of the authenticated E2E suite or normal unit-test execution.

## Safety and prerequisites

Use an **approved test cluster and database**, not a production workload. The suite sends only fixed,
synthetic `range` queries through each revision's `Client.executeQuery`. It does not read existing tables,
create/alter/drop resources, ingest data, or invoke management commands. Database Viewer/query permission is sufficient.
The query-results cache is disabled. Normal server-side metadata/plan caching still applies.

Use the repository's supported Node/npm versions, Git, and an authenticated Azure CLI (`az login`).
Both checkouts need dependencies installed using `npm ci`; no additional packages are required.
Credentials are taken from the Azure CLI session, never command-line arguments or report files.
The harness caches tokens in memory per worker/audience and refreshes them 60 seconds before expiry.
Concurrent acquisition is deduplicated so an Azure CLI subprocess on every query does not dominate SDK throughput.
The credential is loaded from the selected checkout's dependencies; both revisions use the same caching policy.

## Run

From the **candidate repository root**, create a separate baseline checkout. For PR #466, the original base is
`34c0fea7822df50d6b528026effb6a762f39b25d`. Do not reset or modify your candidate checkout.

```powershell
git worktree add --detach ..\azure-kusto-node-before 34c0fea7822df50d6b528026effb6a762f39b25d
Push-Location ..\azure-kusto-node-before
npm ci
Pop-Location

az login --tenant "<tenant-id>"
$env:ENGINE_CONNECTION_STRING = "https://<test-cluster>.kusto.windows.net"
$env:TEST_DATABASE = "<approved-test-database>"

# Small live smoke test first.
npm run loadTest -- --before ..\azure-kusto-node-before --rows 100 --iterations 2 --concurrency 1 --rounds 1 --warmup 1 --output artifacts\rows-smoke.json

# Paired load comparison: 60 measured requests per case and revision.
npm run loadTest -- --before ..\azure-kusto-node-before --output artifacts\rows-load.json
```

The runner rebuilds **both** SDKs before loading them, records their revisions, compiled-code/lockfile hashes and
SDK-source dirty flags, and runs each revision/round in a fresh Node process. Revision order alternates
`before, after` then `after, before`; the two revisions never issue load concurrently.
Each case primes authentication once, then performs `warmup * concurrency` additional, concurrency-bounded warm-up requests.
All warm-up requests are excluded from the measured latency, throughput, CPU, and RSS sampling window.
Resident memory retained from warm-up can still contribute to measured RSS.

`--after <checkout>` selects a candidate other than the current checkout.

| Option                   |                         Default | Bounds                                                                           |
| ------------------------ | ------------------------------: | -------------------------------------------------------------------------------- |
| `--rows`                 |                           1,000 | 1-50,000 rows/query                                                              |
| `--iterations`           |                              20 | 1-200 measured requests/case/round/revision                                      |
| `--concurrency`          |                               4 | 1-16 outstanding requests; cannot exceed iterations                              |
| `--warmup`               |                               2 | 1-10 warm-up requests per concurrent worker, after authentication priming        |
| `--rounds`               |                               3 | 1-5 paired rounds                                                                |
| `--timeout-ms`           |                          30,000 | 1,000-120,000 server timeout; client timeout adds 5 seconds                      |
| `--max-duration-seconds` |                             300 | 10-1,800 wall-clock budget after builds, including worker startup/authentication |
| `--output`               | timestamped file in `artifacts` | New JSON file; existing files are not overwritten                                |

Additionally, `rows * concurrency` cannot exceed 100,000, and one invocation cannot exceed 5,000 queries including
warm-up. Query failures stop further admission; in-flight requests drain. A worker exceeding the wall-clock budget is terminated;
server-side work remains bounded by the request timeout.

To compare different load levels, repeat the paired run with separate output files, for example
`--concurrency 1`, `--concurrency 4`, then `--concurrency 8`. Keep rows, iterations, rounds, credentials, machine,
Node version, and target unchanged when comparing levels. Do not run independent comparisons simultaneously.

## Workloads and interpretation

| Case            | What it exercises                                                                                 | Original baseline                 |
| --------------- | ------------------------------------------------------------------------------------------------- | --------------------------------- |
| `ordinary-json` | Full JSON serialization of 16-column typed rows, including datetime, timespan, and dynamic values | Must succeed; performance control |
| `raw-values`    | Raw-value iteration with a column named `raw`                                                     | Incorrect values                  |
| `reserved-json` | JSON serialization with row-property/method names and `__proto__`                                 | Overwritten methods/metadata      |
| `proxy-json`    | The same reserved names through collection-aware proxies                                          | Overwritten methods/metadata      |
| `custom-index`  | Numeric row access with custom datetime/timespan parsers, including null datetimes                | Custom parsers ignored            |

The JSON report and adjacent `.json.md` comparison include success/error counts, requests/second, rows/second,
nearest-rank p50/p90/p95/p99, CPU milliseconds, observed peak process RSS, and individual measured samples.
Markdown includes a P90/P95/P99 table for each workload's query, model, and total latency.
Percentiles pool individual samples across rounds, rather than averaging per-round percentiles.
With the default 60 successful samples per case/revision, P99 is the observed maximum, not a stable tail estimate.
`queryMs` measures the entire `executeQuery` await, including network, service work, response decoding, and event-loop contention;
it is **not server-only execution time**. `modelMs` measures synchronous row consumption, validation, and serialization.
`totalMs` spans both. CPU/RSS are process-level measurements; RSS is sampled after warm-up and request consumption, not an allocation profiler.

Throughput and end-to-end/model percentiles count **successful requests only**. A failed baseline is not a fast implementation:
its performance delta is `null`/`n/a`. Query timing is retained even when later model validation fails.
Warm-up correctness failures are reported separately and fail the candidate as well.
The original baseline's four known-broken cases are expected; failures in the control case, infrastructure failures,
incomplete runs, or **any** candidate correctness failure cause a nonzero exit.

Performance deltas are informational, not a regression gate. Inspect paired rounds and CPU/model time before attributing
network/service variability or GC noise to the PR. The ordinary control also requires identical serialized byte counts.
Reports contain synthetic query text and a target fingerprint, but no cluster/database names, identities, access tokens,
connection strings, or raw service error messages. Review artifacts before publishing them.

## Planned follow-ups (not executed)

These experiments have not been executed. A/A can use the existing runner; payload replay/profiling needs a dedicated driver.
Keep existing report files and published results immutable; write every new experiment to a separate output path.

### A/A calibration

- Compare the fixed candidate against itself (`--before <candidate> --after <candidate>`), verifying identical compiled SDK and lockfile hashes.
- Use the same approved target, Node/runtime, five workloads, 5,000 rows, 20 measured requests, three paired rounds, warm-up, and concurrency levels 1, 4, 8, and 12.
- Repeat independent, sequential paired runs to characterize throughput, CPU, and P90/P95/P99 variation. Retain per-round samples and before/after ordering.
- Use the observed A/A variability to judge A/B differences; do not assume the previous throughput changes are either regressions or noise.
  Collect more samples across bounded runs before treating P99 as a reliable tail estimate. Do not silently relax the existing load limits.

### Synthetic payload replay and profiling

- Capture only the generated queries' synthetic primary-result frames; remove target/authentication/diagnostic metadata before retaining fixtures.
- Replay the same fixtures through the original base and fixed candidate in separate, alternating Node workers without live query traffic.
  Create fresh data sets per iteration so custom parsers and row mutations cannot leak between samples.
- Measure response decoding/data-set construction separately from row iteration, indexed custom parsing, JSON serialization, and collection-aware proxies.
  Keep the existing correctness guards; do not compare successful throughput for known-broken baseline cases.
- First collect warmed, unprofiled latency/CPU/memory measurements. Then capture CPU and heap-allocation/GC profiles of the measured replay loop
  inside each SDK worker, not the coordinator. Keep instrumented results separate because profiling changes performance.
- Attribute the observed ordinary-row client-side cost to hot paths, allocations, GC, or variability before proposing an SDK optimization.
  Publish matching fixture/configuration hashes and comparison evidence without including private service metadata.

## Offline validation

```powershell
npm run testData -- --runInBand --runTestsByPath packages\azure-kusto-data\test\load\resultRowsLoadTest.ts
```

These tests exercise token caching/refresh, bounded scheduling, warm-up exclusion, error accounting/redaction, aggregation, and input limits
without requiring a cluster or Azure credentials.
