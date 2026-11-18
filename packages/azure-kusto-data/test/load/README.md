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

## A/A calibration

Compare the fixed candidate against itself, using the same approved live target and settings as the A/B run:

```powershell
npm run loadTest -- --before . --after . --rows 5000 --iterations 20 --concurrency 4 --rounds 3 --warmup 2 --output artifacts\aa-c4-rep1.json
```

Repeat independent, sequential profiles at concurrency 1, 4, 8, and 12 with new output names for every repetition.
Verify identical compiled SDK and lockfile hashes. Identical-SDK comparisons are labeled `A/A` and require both variants
to pass all correctness checks, including the four workloads whose original A/B baseline was expected to fail.
Retain per-round samples as well as profile-level aggregates. Use their throughput/CPU/P90/P95/P99 variation to assess
A/B differences; a few repetitions provide an empirical noise range, not a population confidence interval or a preapproved regression budget.
Do not silently relax the existing load limits.

## Synthetic payload replay and profiling

First capture the same five fixed queries once each, using the fixed candidate and the approved E2E target:

```powershell
npm run replayTest -- --capture --rows 5000 --output artifacts\row-payloads.json
```

Only capture uses the cluster/Azure CLI. It retains normalized synthetic primary-result frames, not diagnostic frames,
target/authentication metadata, original compressed HTTP bytes, or arbitrary query output. The adjacent `.metadata.json`
records the capture SDK, target fingerprint, query count, and fixture hash without disclosing the endpoint/database.

Run the same immutable fixtures through the original base and fixed candidate, then collect separate instrumented comparisons:

```powershell
npm run replayTest -- --before ..\azure-kusto-node-before --fixtures artifacts\row-payloads.json --rows 5000 --profile none --output artifacts\replay.json
npm run replayTest -- --before ..\azure-kusto-node-before --fixtures artifacts\row-payloads.json --rows 5000 --profile cpu --output artifacts\replay-cpu.json
npm run replayTest -- --before ..\azure-kusto-node-before --fixtures artifacts\row-payloads.json --rows 5000 --profile heap --output artifacts\replay-heap.json
```

Defaults are 20 measured iterations/case/round, 10 warm-up iterations/case, three alternating paired rounds, and a 300-second
post-build budget. Bounds are 1-200 measured iterations, 1-50 warm-ups, 1-5 rounds, 1-50,000 rows, fixtures up to 64 MiB,
and at most 5,000 total iterations including warm-up. Existing fixtures, reports, and profile directories are never overwritten.
Replay is deliberately single-threaded and offline; do not run it alongside live latency measurements.

Every iteration decodes the same payload into fresh objects and constructs a fresh `KustoResponseDataSetV2`, preventing parser
or row mutations from leaking across samples. Reports separate JSON decode, data-set construction, and row consumption/validation/
serialization (including proxies and custom indexed parsers). They include matching payload/fixture/configuration hashes,
raw samples, CPU, and observed RSS. Decode/construction samples survive later model failures; successful throughput and
model/total percentiles do not count failed work. Known-broken baseline workloads retain their correctness guards.

CPU and sampling-allocation profilers start **inside each SDK worker after warm-up**, not in the coordinator.
Each instrumented report has a separate `.profiles` directory containing per-variant/round/workload `.cpuprofile` or
`.heapprofile` files. Stack URLs are rewritten to SDK/harness/dependency-relative labels before writing them.
CPU sampling uses 1 ms; allocation sampling uses 32 KiB and includes collected objects. The heap profile is an allocation
sample, not a heap snapshot or an exact retained-memory/leak measurement. Instrumented runs also observe GC durations
whose start times lie inside the measured loop; unprofiled runs do not enable GC observation.

Keep instrumented rates separate from unprofiled performance results. GC/CPU profiles are diagnostic, RSS can include retained
warm-up memory, and a heap-used delta can be negative due to GC. Attribute any ordinary-row cost to measured SDK hot paths,
allocations, GC, or calibration variability before proposing an optimization. Preserve all earlier artifacts/publications.

## Offline validation

```powershell
npm run testData -- --runInBand --runTestsByPath packages\azure-kusto-data\test\load\resultRowsLoadTest.ts packages\azure-kusto-data\test\load\resultRowsReplayTest.ts
```

These tests exercise token caching/refresh, bounded scheduling, warm-up exclusion, error accounting/redaction, aggregation,
strict A/A correctness, immutable fixture identities, fresh replay state, worker CPU/allocation profiling, profile-path
redaction, and input limits without requiring a cluster or Azure credentials.
