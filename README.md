# Employee 360 Integration Tests (Playwright + TypeScript)

This project provides repeatable API-level automated tests for an employee event integration flow.
It validates both API behavior and downstream SQL persistence using a lightweight local service and SQLite.

API method semantics in the mock service are intentionally explicit:

- `POST /employees` -> create a new employee (`201 Created`)
- `PUT /employees/{employeeId}` -> update an existing employee (`200 OK`)
- `POST /employees/batch` -> batch create with per-record outcomes (`200 OK`)

## Project structure

```text
.
├── src
│   ├── config              # environment/config loading
│   ├── db                  # SQLite schema + repository helpers
│   └── service             # mock integration endpoint
├── tests
│   ├── fixtures            # test payload builders
│   ├── helpers             # downstream DB assertions
│   ├── createEmployeeRecord.spec.ts
│   └── updateEmployeeRecord.spec.ts
├── scripts
│   └── reset-db.js
├── playwright.config.ts
└── azure-pipelines.yml
```

## What this suite covers

Focused regression coverage (positive, negative, boundary, and awkward production-like cases):

1. `POST /employees` creates a valid employee record and persists correct downstream data
2. `POST /employees` rejects missing `employeeId` without creating a record
3. `POST /employees` normalizes mixed-case emails to lowercase before persistence
4. repeated `POST /employees` for the same employee is rejected without duplicates
5. `POST /employees/batch` processes valid records while rejecting invalid records
6. `POST /employees` rejects malformed JSON payloads
7. `POST`/`PUT` reject canonical email collisions across different employee IDs
8. `PUT /employees/{employeeId}` updates an existing employee correctly
9. `PUT /employees/{employeeId}` returns `404` when employee does not exist
10. `PUT /employees/{employeeId}` applies validation rules (missing email, invalid effective date)
11. `PUT /employees/{employeeId}` rejects mismatched path/body employee IDs (`409`)
12. concurrent duplicate `POST /employees` requests result in one success and one conflict (no duplicate persistence)
13. replaying the same `POST /employees/batch` payload rejects duplicate-processing on replay
14. retry behavior is validated: failed `PUT` mismatch can be corrected and successfully retried
15. production-risk case: mismatched `employeeId` between URL path and body is blocked to prevent accidental cross-record updates

## Regression pack vs extended reliability tests

Tests are tagged to support tiered execution:

- `@regression`: core, always-on CI scenarios (fast, high signal)
- `@extended`: heavier resilience scenarios (concurrency/replay/retry patterns)

**Regression pack includes:**
- valid create and update flows
- missing `employeeId`
- mixed-case email normalization
- repeated POST duplicate rejection
- malformed payload checks
- batch mixed valid/invalid handling
- canonical email collision protection
- update-not-found handling
- update validation checks
- path/body `employeeId` mismatch protection

**Extended reliability pack includes:**
- concurrent duplicate POST race
- replay of same batch payload
- corrected retry after initial mismatch failure

## Why these regression tests were selected

These tests defend the highest-risk data trust outcomes for Employee 360:

- identity integrity (`employeeId`, canonical email handling)
- idempotency (no duplicate employees on repeat processing)
- duplicate-processing safety under concurrency and replay
- correctness of change propagation (updates hit the right row)
- retry safety after a failed request is corrected
- resilience (bad records do not break valid processing)
- downstream confidence (SQL assertions verify actual persisted state)

## What to automate first vs leave manual

- **Automate first:** contract/data integrity scenarios that run on every commit (`employeeId`/email/date validation, upsert behavior, deduplication, downstream SQL checks).
- **Deliberately manual initially:** exploratory checks against real upstream/downstream partner systems (auth flows, network failure chaos tests, large-volume soak/perf runs, schema drift investigations) until stable envs and data contracts are available for reliable automation.

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
npm ci
npx playwright install --with-deps chromium
```

## Run tests

```bash
npm test
```

The test run starts the local integration service automatically via Playwright `webServer`.

Run only the regression pack:

```bash
npm run test:regression
```

Run extended reliability tests:

```bash
npm run test:extended
```

## Allure reporting

```bash
npm test
npm run test:allure:results
```

Each test now attaches API and DB telemetry to Allure:
- API request/response (method, URL, payload, status, body)
- DB operation details (SQL, params, and result rows/counts)

## Configuration

Configuration is externalized via environment variables (no credentials hard-coded):

- `PORT` (default: `4010`)
- `EMPLOYEE_DB_PATH` (default: `./.data/employee360.test.sqlite`)

Create `.env` from `.env.example` if needed.

## CI/CD (Azure DevOps)

`azure-pipelines.yml` runs:

1. dependency install
2. Playwright browser install
3. API regression test execution (`npm run test:ci:regression`)
4. JUnit publication for pipeline pass/fail visibility
5. Allure raw result artifact publication

This makes the suite pipeline-ready for pull requests and main branch validations.

### How to run this in Azure DevOps (trigger strategy, stages, quality gates)

**Trigger strategy**
- **PR trigger (fast feedback):** run on pull requests to `main` to block merges when regression tests fail.
- **CI trigger:** run on commits to `main` for continuous validation of the integration contract.
- **Scheduled run (optional):** nightly run to detect environmental drift and flaky integration behavior early.

**Pipeline stages**
1. **Build/Setup stage**
   - Use Node 20, run `npm ci`, install Playwright browser dependencies.
2. **Test stage**
   - Run `npm run test:ci:regression`.
   - Publish JUnit results for pass/fail visibility in Azure DevOps test reporting.
   - Publish `allure-results` as a pipeline artifact.
3. **Report stage (optional)**
   - Generate and publish Allure HTML report from `allure-results` for detailed diagnostics.
4. **Release stage**
   - Run the same regression pack as a pre-deployment or post-deployment gate in higher environments.
   - Optionally run `npm run test:extended` as an additional release-readiness check.

**Quality gates for release pipeline**
- Fail the release gate if any critical regression test fails.
- Require **0 failed tests** in JUnit results before promotion.
- Require completion of mandatory scenario tags (for example: create, update, validation, collision checks).
- Optionally enforce runtime and retry thresholds to detect instability (for example, fail if retries were needed above threshold).
