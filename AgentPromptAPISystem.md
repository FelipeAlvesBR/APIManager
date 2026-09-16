# MASTER BUILD PROMPT — POSTMAN-LIKE API PLATFORM

## Mission

Build a production-grade, web-first API development platform inspired by the major workflows of Postman, but do **not** copy Postman proprietary source code, trademarks, visual assets, private APIs, exact UI artwork, or other protected implementation details. The goal is a technically complete alternative API workspace for developers and teams.

The product should feel like a serious API engineering environment rather than a simple HTTP client. It must support the complete everyday loop:

1. discover or import an API
2. create/edit requests
3. authenticate securely
4. run requests across environments
5. inspect and debug responses
6. save requests into reusable collections
7. chain workflows with variables and scripts
8. write and run automated tests
9. mock unfinished APIs
10. design and validate API specifications
11. monitor production endpoints
12. collaborate with teammates
13. integrate with Git and CI/CD
14. publish documentation
15. automate work through a CLI/API
16. use AI to create/debug/test API workflows

The product must be designed as a multi-tenant application with a resilient local-first web client, a secure cloud backend, and a clean separation between UI, request execution, scripting, persistence, synchronization, and automation.

Current Postman product documentation confirms that the reference product spans API requests across HTTP, GraphQL, gRPC, WebSocket, Socket.IO and MQTT, collections, environments/variables, testing/scripts, mock servers, monitors, API specifications, workspaces, collaboration, Git, import/export, CLI automation, AI/Agent Mode, browser/network capture, documentation, governance, and a Postman API/MCP ecosystem. [1][2][3][4][5][6][7][8][9][10]

---

# 1. PRODUCT PRINCIPLES

## 1.1 Core UX principles

- The fastest path from “I have an endpoint” to “I got a useful response” must be under 20 seconds.
- Every important action must be keyboard accessible.
- Do not bury primary API actions under tiny three-dot menus.
- Keep request configuration and response inspection visible in one working surface.
- Preserve work automatically.
- Never silently lose a request, environment value, test, response example, or collection edit.
- Clearly distinguish local/secret values from shared values.
- Make destructive actions reversible where technically possible.
- Use explicit confirmation for deletes, destructive Git operations, secret deletion, workspace deletion, collection deletion, and disabling security controls.
- Make errors actionable: show what failed, why, what can be tried, and what data is relevant.

## 1.2 Engineering principles

- Server is authoritative for shared collaborative state.
- Client remains usable during transient connectivity loss.
- All write operations are idempotent where possible.
- Every resource has immutable IDs.
- Every resource mutation creates an auditable event.
- No secrets in application logs.
- No arbitrary user script should be able to access server credentials or other users’ data.
- API request execution must be isolated from the main application process.
- Tests must be deterministic and independently runnable.
- Every asynchronous operation needs cancellation, timeout and retry semantics.

## 1.3 Compatibility principle

Implement a compatibility-oriented internal data model based on the open Postman Collection JSON ecosystem where practical, while keeping the implementation independent. Support importing/exporting common formats and easy migration from other tools. Current Postman supports importing Postman data, OpenAPI/Swagger, cURL, Git repositories and migrations from tools such as SoapUI, Hoppscotch, Insomnia and Thunder Client. [11][12]

---

# 2. PRIORITY MODEL

Implement in this order.

## P0 — must work before calling the product an MVP

1. Accounts/authentication
2. Workspace creation
3. HTTP request builder
4. GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS
5. URL, query params, headers, raw body, form-data, x-www-form-urlencoded, binary
6. auth helpers
7. send request
8. response viewer
9. request history
10. collections/folders
11. variables/environments
12. secrets vault
13. import cURL
14. import/export collections
15. pre-request and post-response JavaScript scripting
16. assertions/tests
17. collection runner
18. response examples
19. basic collaboration/sharing
20. robust error handling and logging

## P1 — high-value professional features

21. OpenAPI import/export and collection generation
22. JSON schema/OpenAPI validation
23. mock server
24. scheduled monitors
25. CLI
26. Git integration
27. comments/mentions
28. workspaces with permissions
29. OAuth 2.0 flow helper
30. WebSocket client
31. GraphQL client
32. gRPC client
33. code snippet generation
34. request/code generation
35. documentation publishing
36. proxy/traffic capture
37. cookie manager
38. response visualizer
39. performance/load testing
40. API search

## P2 — advanced platform

41. AsyncAPI/protobuf support
42. MQTT
43. Socket.IO
44. Flows / visual API workflows
45. API governance/linting
46. private/public API catalog
47. organization admin console
48. audit logs
49. advanced analytics
50. SSO/SAML/OIDC
51. SCIM
52. enterprise data policies
53. AI agent mode
54. MCP server/client
55. cloud automation sandbox

## P3 — differentiating features

56. Bring Your Own Model Provider for Agent Mode
57. intelligent failure diagnosis
58. contract drift detection
59. semantic diffing
60. test-data generation
61. replayable debugging sessions
62. smart environment switching
63. automated API workflow reconstruction from captured traffic

Do not build P2/P3 features before P0 is reliable.

---

# 3. TARGET APPLICATION SURFACES

Build these applications from one shared domain model.

### Web application

Primary user experience. Responsive but optimized for large screens (1280px+). The desktop layout should feel like a professional IDE.

### Desktop shell

Optional Electron/Tauri wrapper around the web app for local proxy, local execution, filesystem access, native certificates, and native Git integration.

### CLI

A standalone command-line application able to:

- run collections
- run selected folders/requests
- choose environments
- load data files
- emit human-readable output
- emit JSON
- emit JUnit XML
- emit HTML
- exit non-zero on failure
- trigger monitors
- export collections
- validate specs

### Backend API

Public versioned API for managing all first-class resources.

### Agent/MCP interface

Machine-readable tool interface so external AI agents can inspect and modify workspaces safely.

---

# 4. INFORMATION ARCHITECTURE

Main global navigation:

- Home
- Workspaces
- Collections
- APIs
- Specs
- Environments
- Mocks
- Monitors
- Runs
- History
- Flows
- Documentation
- API Catalog
- AI
- Integrations
- Team/Admin

Global top bar:

- workspace selector
- environment selector
- search
- command palette
- sync status
- notifications
- user/account

Main workspace layout:

LEFT SIDEBAR
- Collections
- APIs
- Specs
- Environments
- Mocks
- Monitors
- Documents

CENTER WORKBENCH
- tabs for requests/specs/flows/docs
- split request/response editor

RIGHT CONTEXT SIDEBAR
- docs
- variables
- comments
- AI
- examples
- generated code

BOTTOM PANEL
- console
- test results
- collection run results
- network timeline
- warnings
- script logs

---

# 5. HOME / START EXPERIENCE

Homepage should immediately support:

- New HTTP request
- New WebSocket request
- New GraphQL request
- New gRPC request
- Import cURL
- Import OpenAPI
- Import collection
- Import from Git
- Open recent request
- Open recent collection
- Run recent collection
- Create workspace
- Ask AI

Show recent work with:

- name
- resource type
- workspace
- last edited
- last run status
- last HTTP status
- last response duration

Add command palette shortcuts:

- New request
- Open request
- Search requests
- Send request
- Save request
- Run collection
- Switch environment
- Open history
- Toggle console
- Open AI

---

# 6. WORKSPACES

A workspace is the collaborative container and single source of truth for a group of related API assets.

Current Postman workspaces group APIs, collections, environments, mocks, monitors and other linked elements, and collaborative edits sync in real time. [13]

Support:

- personal workspace
- team workspace
- private workspace
- public workspace
- partner/shared workspace

Workspace fields:

```text
id
name
slug
description
visibility
ownerId
organizationId
createdAt
updatedAt
settings
linkedGitRepo
```

Workspace permissions:

- owner
- admin
- editor
- commenter
- viewer
- restricted/no-access

Workspace activity feed:

- created collection
- changed request
- changed environment
- opened PR
- merged change
- published documentation
- created monitor
- test run
- mock server change
- member joined/removed

Include member groups and resource-level permissions.

---

# 7. HTTP REQUEST BUILDER — P0 CORE

Create a polished request editor.

## Request header

- request name
- Save button
- method selector
- URL input
- Send button
- save-to-collection control
- duplicate
- share
- code
- documentation

## Method selector

Built-in:

GET
POST
PUT
PATCH
DELETE
HEAD
OPTIONS
TRACE

Allow custom methods.

## URL handling

Parse:

- protocol
- host
- port
- path
- path variables
- query params

Each query parameter row needs:

- enabled checkbox
- key
- value
- description
- encode toggle
- delete

Show final resolved URL preview.

## Headers

Editable table:

- enabled
- key
- value
- description
- inherited/overridden indicator

Automatically show calculated headers separately where possible.

## Body types

- none
- raw text
- JSON
- XML
- JavaScript
- HTML
- form-data
- x-www-form-urlencoded
- binary
- GraphQL

JSON body editor:

- syntax highlighting
- formatting
- validation
- folding
- line numbers
- inline errors
- schema-aware completion where available

## Auth

Support at minimum:

- No Auth
- API Key
- Bearer Token
- Basic Auth
- Digest Auth
- OAuth 1.0
- OAuth 2.0
- Hawk
- AWS Signature
- NTLM if technically supported
- custom auth

Authorization should support inheritance:

request > folder > collection > workspace default.

Never render secret tokens in logs by default.

## Settings

Per-request:

- redirects
- timeout
- proxy
- SSL verification
- client certificates
- follow original HTTP method on redirect
- retry policy where supported

## Send

When clicking Send:

1. resolve variables
2. validate request
3. run pre-request script
4. resolve auth
5. execute network request
6. capture metrics
7. store response snapshot locally
8. run post-response script
9. run assertions
10. update history
11. update request-run state

---

# 8. RESPONSE VIEWER

Response panel must support:

- status code
- status phrase
- duration
- size
- timestamp
- headers
- body
- cookies
- raw
- pretty
- preview
- hex/binary
- search
- copy
- save example

Pretty JSON:

- collapsible tree
- path navigation
- copy value/path
- data-type display
- search
- expand all / collapse all

Raw mode:

- exact bytes where possible
- line wrapping toggle

HTML preview:

- sandboxed iframe
- no access to parent application
- warning when executing active content

Image response:

- display image
- dimensions
- content type
- size

Binary response:

- downloadable
- hex viewer when practical

Response metadata:

```text
status
statusText
headers
cookies
body
sizeBytes
durationMs
requestId
remoteAddress
protocol
tls
redirects
```

Never store sensitive response bodies indefinitely without explicit user control.

---

# 9. REQUEST HISTORY

Every sent request creates a history record.

History record:

```text
id
requestSnapshotId
workspaceId
collectionId?
environmentId?
method
url
status
duration
sentAt
responseSummary
```

History must support:

- search
- HTTP-method filter
- status filter
- host filter
- collection filter
- environment filter
- date filter
- success/failure filter
- sort by newest/oldest/duration
- replay
- save as request
- delete one
- delete selected
- clear all

Important UX requirement: do not make users open every run to understand which environment was used. Community users have specifically requested filtering history by environment, and older community requests also asked for richer history filtering. [14][15]

---

# 10. COLLECTIONS

Collections are reusable groups of requests and workflows.

Support:

- collections
- nested folders
- requests
- collection description
- folder description
- request descriptions
- examples
- variables
- auth inheritance
- collection scripts
- folder scripts
- request scripts

Collection configuration:

- auth
- variables
- pre-request script
- post-response script
- documentation
- default headers
- run settings

Collections can be:

- run manually
- scheduled
- monitored
- used as mock source
- published as docs
- exported
- imported
- shared
- versioned
- used by CLI

Current Postman collections serve as reusable request groups, test suites, workflows and documentation sources. [16]

---

# 11. VARIABLES AND ENVIRONMENTS

Implement a scope hierarchy.

Suggested precedence:

1. runtime/local variable
2. data-run variable
3. environment variable
4. collection variable
5. global variable
6. system/dynamic variable

This must be deterministic and documented.

Current Postman behavior uses local values for sending requests and allows shared values to be synchronized; local secret values are not synced to the cloud. [17][18]

Variable editor fields:

- name
- type
- value
- secret/secure toggle
- description
- enabled
- scope

Environment features:

- create
- duplicate
- rename
- delete
- activate
- import/export
- diff
- compare
- clone
- share selected variables

Variable syntax:

`{{variableName}}`

Add variable resolution preview.

Hovering a variable reference should show:

- resolved value
- scope
- source
- whether secret

Prevent accidental secret exposure in screenshots and logs.

Dynamic variables:

- random UUID
- email
- first name
- last name
- integer
- float
- date/time
- UUID
- IP
- domain
- boolean

Add user-defined Faker-style data generators.

---

# 12. SECRET VAULT

Create a local encrypted secret vault.

Requirements:

- platform secure storage where available
- encryption at rest
- zero secret values in normal analytics
- zero secret values in error telemetry
- masked UI
- reveal requires user gesture
- audit access in enterprise mode
- optional external secret manager integration

Secrets may be referenced in requests using a special secure variable mechanism.

Current Postman Vault is designed to keep local secrets out of the normal synced workspace data, and can also integrate with external secret managers. [19]

---

# 13. SCRIPTING ENGINE

Implement a JavaScript runtime for request automation.

Two primary hooks:

### Pre-request

Runs before network execution.

Can:

- read variables
- set variables
- generate tokens
- compute signatures
- modify dynamic state

### Post-response

Runs after response.

Can:

- assert status
- inspect body
- save values
- chain requests
- calculate derived data
- visualize results

Current Postman uses a Node.js-based sandbox and `pm` APIs for request/response access, variables, cookies, assertions and other workflow tasks. [20][21]

Security requirements:

- isolate scripts
- CPU quota
- memory quota
- execution timeout
- no direct filesystem access
- no arbitrary child process creation
- no access to cloud session tokens
- controlled HTTP calls from scripts
- permission model for packages

Script APIs should include:

```javascript
pm.request
pm.response
pm.variables
pm.environment
pm.collectionVariables
pm.globals
pm.cookies
pm.test
pm.expect
pm.sendRequest
console.log
```

Implement Chai-like assertions or equivalent.

Example:

```javascript
pm.test("status is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("contains user id", function () {
  const json = pm.response.json();
  pm.expect(json.id).to.exist;
});
```

---

# 14. TEST SYSTEM

Tests are first-class resources.

Types:

- assertion test
- request contract test
- schema validation
- authentication test
- smoke test
- regression test
- workflow test
- performance test

Collection Runner UI:

Left side:

- collection tree
- selection checkboxes

Configuration:

- environment
- iterations
- delay
- data file
- persist variables
- stop on failure
- bail strategy

Run output:

- total
- passed
- failed
- skipped
- duration
- request timings
- assertion details
- console logs
- variable changes
- response samples

Current Postman supports collection runs, scheduled runs, CLI/CI runs, monitors, webhooks and performance tests. [3]

---

# 15. MOCK SERVER

Create mocks from saved examples and/or OpenAPI.

Mock definition:

```text
id
name
workspaceId
sourceCollectionId
routes
examples
latency
headers
responsePolicies
state
```

Route matching:

- method
- exact path
- path parameters
- query matching
- headers
- examples
- explicit mock behavior

Mock response controls:

- status
- headers
- body
- delay
- randomization
- conditional response

Must support deterministic mocks for automated tests.

Current Postman mock servers can simulate endpoints before a production server exists and return saved examples or dynamic responses. [3]

---

# 16. API SPECIFICATIONS / SPEC HUB

Create an API design workspace.

Initial formats:

P0:
- OpenAPI 3.0
- OpenAPI 3.1

P1:
- OpenAPI 2.0
- AsyncAPI
- GraphQL schema
- protobuf
- Smithy

Editor:

- YAML editor
- JSON editor
- syntax highlighting
- autocomplete
- outline tree
- validation
- references
- generated examples
- preview
- diff

OpenAPI visual editor:

- endpoints tree
- methods
- params
- schemas
- responses
- security schemes

Generate collection from specification.

Generate spec from collection where possible.

Track spec-to-collection sync and report drift.

Current Postman Spec Hub supports OpenAPI, AsyncAPI, protobuf, GraphQL and Smithy specifications, with visual editing for OpenAPI and collection generation. [22]

---

# 17. API GOVERNANCE

Rules engine:

- naming conventions
- required descriptions
- response code policies
- auth requirements
- pagination
- versioning
- content-type rules
- schema constraints
- security policies

Linting output:

- error
- warning
- info

Each rule needs:

```text
id
name
severity
message
path
resolution
```

Support custom rule packs.

Enterprise governance dashboard:

- APIs compliant
- APIs failing
- trend
- owner
- severity
- unresolved findings

---

# 18. PROTOCOL SUPPORT

## P0

HTTP/HTTPS

## P1

GraphQL
WebSocket
gRPC

## P2

Socket.IO
MQTT
SOAP
Unix domain sockets / named pipes

Current Postman supports several of these protocols, including HTTP, GraphQL, gRPC, WebSocket, Socket.IO and MQTT. [23]

### WebSocket UI

- URL
- connect/disconnect
- headers
- auth
- cookies
- message composer
- message history
- message format
- ping/pong
- timestamps
- connection state

Message formats:

- Text
- JSON
- XML
- HTML
- Binary Base64
- Binary Hex

Postman currently supports composing, sending and inspecting WebSocket messages with multiple formats. [24]

### gRPC UI

- server URL
- proto file/import
- service selector
- method selector
- request message
- metadata
- auth/TLS
- response stream

### GraphQL UI

- endpoint
- query
- variables
- headers
- introspection
- schema explorer
- operation selector
- response tree

---

# 19. CODE GENERATION

For every HTTP request, generate snippets for common clients.

Minimum:

- cURL
- JavaScript fetch
- Node.js
- Python requests
- Java
- Kotlin
- Swift
- C#
- Go
- PHP
- Ruby
- HTTP raw

Snippet generator must faithfully reflect:

- URL
- headers
- auth
- body
- query parameters
- multipart fields

Allow copying and downloading.

---

# 20. IMPORT / EXPORT

Imports:

- cURL
- Postman Collection JSON
- environments
- OpenAPI
- Swagger
- HAR
- Git repositories
- raw URLs
- pasted text
- files/folders
- other API clients

Exports:

- collection JSON
- environments
- OpenAPI
- test reports
- HAR
- Markdown docs
- HTML docs

Current Postman supports imports from files/folders/raw text/URLs/repositories and migration from several other API clients. [11]

The import wizard must show:

- detected format
- number of requests
- environments
- unresolved references
- secrets found
- conflicting resource names
- conversion warnings

Never silently discard unsupported data.

---

# 21. GIT INTEGRATION

Support:

- GitHub
- GitLab
- Bitbucket
- Azure DevOps

Capabilities:

- connect repo
- select branch
- pull
- push
- commit
- diff
- branch
- merge
- conflict resolution
- import collection definitions from repo
- local mode

Postman currently supports native Git/local development workflows and repository imports. [25][26]

Design local mode carefully:

- filesystem is source of local truth
- cloud sync is explicit
- show branch/dirty state
- show conflicts
- never overwrite without confirmation
- support three-way merge

---

# 22. COLLABORATION

Realtime collaboration:

- presence
- active editors
- cursor/presence indicators where practical
- comments
- mentions
- discussions
- change history
- compare changes
- forks
- pull requests

Comments must be anchored to a resource and optionally to a specific field/path.

Comment lifecycle:

- open
- reply
- resolve
- reopen
- mention

Postman currently provides comments, team roles, groups, resource-level permissions, live sessions and fork/pull-request version workflows. [27]

---

# 23. VERSION CONTROL / PULL REQUESTS

Implement resource snapshots.

Each snapshot stores:

- resource JSON
- author
- timestamp
- parent snapshot
- message

Diff viewer:

- added
- removed
- changed
- moved

Pull request:

```text
sourceBranch
baseBranch
author
reviewers
status
diff
comments
checks
```

Checks:

- lint
- tests
- governance
- schema compatibility

---

# 24. DOCUMENTATION

Every collection can be rendered into documentation.

Docs page must show:

- endpoint
- description
- auth
- params
- headers
- body
- example request
- example response
- generated client code
- errors

Docs themes:

- light
- dark
- custom branding

Publication modes:

- private
- team
- public

Automatic rebuild after collection changes.

Current Postman public documentation keeps documentation synchronized with collection changes and includes code samples and a Run-in-Postman-style entry point. [28]

---

# 25. MONITORS

Monitor = scheduled execution of a collection against a target environment.

Configuration:

- collection
- environment
- schedule
- region
- timeout
- notification policy
- failure threshold

Minimum schedules:

- every 1 minute
- every 5 minutes
- every 15 minutes
- hourly
- daily
- weekly
- cron-like advanced schedule

Results:

- pass/fail
- status
- latency
- availability
- assertion failures
- history
- region

Alerts:

- email
- Slack
- webhook
- generic HTTP callback

Current Postman Monitors execute collections on schedules or via CLI and alert when tests fail. [29]

---

# 26. PERFORMANCE / LOAD TESTING

Implement a controlled performance runner.

Configuration:

- virtual users
- request rate
- ramp-up
- duration
- target environment
- dataset
- concurrency

Metrics:

- requests/sec
- p50
- p90
- p95
- p99
- error rate
- status code distribution
- connection time
- TLS time
- TTFB

Hard safety controls:

- explicit confirmation before high-volume run
- configurable request ceiling
- configurable spend ceiling if cloud-based
- kill switch

Current Postman supports performance test execution via Postman CLI and collection-based performance testing. [3]

---

# 27. NETWORK CAPTURE / INTERCEPTOR

Provide a secure proxy/capture mode.

Capabilities:

- capture HTTP/HTTPS requests
- filter hosts
- filter methods
- save captured request
- capture response
- replay
- convert capture to collection
- sync browser cookies where explicitly authorized

Postman currently provides proxy/interception capabilities for recording requests and inspecting/replaying traffic. [9]

Security:

- never capture passwords without warning
- default host allowlist
- explicit certificate trust workflow
- sensitive header masking

---

# 28. COOKIES

Cookie manager:

- domain
- path
- name
- value
- secure
- httpOnly
- sameSite
- expiration

Per-request cookie preview.

Actions:

- add
- edit
- delete
- clear domain
- import
- sync where explicitly authorized

Provide warnings about authentication cookies.

---

# 29. RESPONSE VISUALIZER

Allow JavaScript visualizations of JSON responses.

Template examples:

- table
- chart
- cards
- timeline
- tree

Sandbox visualization scripts.

Never permit visualization code to access application session secrets.

---

# 30. FLOWS / VISUAL WORKFLOWS

Implement a node-based workflow editor.

Nodes:

- HTTP request
- GraphQL
- gRPC
- WebSocket
- condition
- transform
- variable
- loop
- retry
- delay
- script
- AI request
- output

Edges:

- success
- failure
- conditional
- parallel

Workflow run display:

- active node
- duration
- input
- output
- error

Persist executions for debugging.

---

# 31. AI FEATURES — P2/P3

AI must accelerate work rather than become a decorative chatbot.

## AI actions

- explain response
- debug error
- generate request
- generate tests
- generate mock examples
- generate OpenAPI
- summarize collection
- generate documentation
- create variables
- convert cURL
- generate code
- suggest assertions
- identify missing auth
- explain schema error
- compare APIs
- identify contract drift

## Context selection

Users can explicitly provide:

- request
- collection
- folder
- environment
- spec
- response
- test output
- workspace document

Never silently send secrets to an external AI provider.

Current Postman Agent Mode can operate over requests, collections, tests, workspaces, environments, monitors, specs and flows, and can create/manage requests, flows and mock servers or debug errors and write tests. [30]

---

# 32. EXTRA DIFFERENTIATING FEATURE
# Bring Your Own Model Provider for Agent Mode

This is the additional feature to implement beyond the normal Postman-like surface.

### User problem

Developers increasingly want API-platform AI assistants to work with:

- self-hosted models
- company-hosted inference
- private VPC AI gateways
- OpenAI-compatible internal endpoints
- custom routing layers
- regional models
- models with company-specific retention policies

Postman supports OpenAI-compatible, fine-tuned, self-hosted and local models for AI requests, but its Agent Mode experience is a different control surface. Community discussion has specifically included requests for self-hosted/custom AI integration. [31][32]

### Feature

Allow Agent Mode itself to use a user-defined OpenAI-compatible or compatible model gateway.

Configuration:

```text
Provider name
Base URL
API format
API key / OAuth / mTLS
Model name
Context window
Tool-call support
Streaming
Temperature
Max output tokens
Region
Data retention policy
```

Supported modes:

- OpenAI-compatible REST
- local Ollama-style provider
- company proxy/gateway
- custom HTTPS JSON provider using a mapping template

### Enterprise controls

Admins can:

- allow only approved AI endpoints
- prohibit public AI providers
- require regional endpoints
- disable data retention
- block sending secrets
- redact sensitive variables
- record AI audit events

### Automatic secret redaction

Before AI context leaves the local client:

1. detect API keys
2. detect Authorization headers
3. detect cookies
4. detect JWTs
5. detect passwords
6. replace with placeholders
7. maintain reversible local mapping only when the user explicitly enables it

### Provider health test

“Test connection” should execute:

1. DNS/connectivity
2. TLS validation
3. auth validation
4. minimal model request
5. tool-call compatibility check
6. streaming check
7. latency measurement

### Model switching

The user can switch:

- global default
- workspace default
- project default
- single conversation

The active provider must always be visible.

### Acceptance criteria

- Agent Mode can perform the same supported tool operations using an approved private model endpoint.
- No secret is accidentally included in the model context.
- Provider outage does not break the rest of Postman.
- Workspace admins can centrally enforce provider policy.
- Logs identify provider/model but never store secret prompt content by default.

---

# 33. POSTMAN-STYLE PUBLIC API

Create an API to manage:

- users
- organizations
- workspaces
- collections
- requests
- folders
- environments
- variables
- APIs
- specifications
- mocks
- monitors
- comments
- forks
- pull requests
- runs
- documentation
- teams
- roles
- audit logs

Postman’s own public API exposes many of these resource classes, including workspaces, collections, environments, APIs, specs, mocks, monitors, comments, forks, pull requests, users/groups/roles and usage/billing data. [33]

Require API keys or OAuth for automation.

Support pagination, filtering, rate limits, idempotency keys, request IDs and structured errors.

---

# 34. MCP

Provide MCP resources/tools for:

- list workspaces
- inspect collection
- inspect request
- get environment names
- validate spec
- run collection
- run request
- create request
- update request
- add tests
- create mock
- inspect monitor

Every mutation should require explicit tool permission.

Return machine-readable structured results.

Postman itself currently exposes an MCP server for managing resources such as workspaces, collections, specs, mocks and monitors. [34]

---

# 35. CLI

Binary name example:

`apiplatform`

Commands:

```text
login
logout
whoami
workspace list
collection list
collection run
request run
monitor run
spec validate
spec generate
collection export
collection import
environment list
```

Example:

```bash
apiplatform collection run ./collections/shop.json \
  --environment ./env/staging.json \
  --reporter junit \
  --report-file reports/results.xml
```

Exit codes:

0 = success
1 = test failure
2 = configuration error
3 = network/runtime error
4 = authorization error
5 = invalid command

---

# 36. BACKEND ARCHITECTURE

Preferred implementation:

Frontend:
- React + TypeScript
- state management with a predictable store
- Monaco editor
- WebSocket realtime layer

Backend:
- TypeScript/Node.js or Go
- REST/JSON API
- WebSocket gateway
- PostgreSQL
- Redis
- object storage
- queue system

Optional execution workers:
- isolated containers
- sandboxed Node runtime
- gRPC clients
- scheduled job workers

Suggested services:

1. identity-service
2. organization-service
3. workspace-service
4. collection-service
5. environment-service
6. request-execution-service
7. script-runner-service
8. test-runner-service
9. mock-service
10. monitor-service
11. git-service
12. spec-service
13. documentation-service
14. notification-service
15. search-service
16. audit-service
17. ai-service
18. agent-service

Do not turn every database table into a microservice on day one. A modular monolith with explicit domain modules is acceptable for MVP, but boundaries must allow later extraction.

---

# 37. DATA MODEL

Core entities:

```text
User
Organization
Team
Workspace
WorkspaceMember
Collection
CollectionFolder
Request
RequestExample
Environment
EnvironmentVariable
Secret
Script
Test
CollectionRun
RunItem
RunAssertion
MockServer
MockRoute
Api
Specification
SpecificationVersion
Monitor
MonitorRun
Comment
PullRequest
GitConnection
Document
Flow
FlowNode
FlowRun
Integration
AuditEvent
Notification
AiProvider
AiConversation
AiMessage
AgentRun
```

Every entity should include:

- id
- createdAt
- updatedAt
- createdBy
- updatedBy where applicable
- version

Use optimistic concurrency control on collaborative entities.

---

# 38. SEARCH

Global search must find:

- collection names
- request names
- URLs
- descriptions
- headers
- variables
- workspaces
- APIs
- specs
- docs

Filters:

- workspace
- type
- environment
- method
- status
- owner
- tag

Support command syntax eventually:

```text
method:GET
status:500
workspace:payments
host:api.example.com
```

---

# 39. PERFORMANCE REQUIREMENTS

Target:

- homepage interactive < 2s on normal broadband after warm cache
- request editor interactive < 1s for common collections
- opening an existing collection should stream large resources instead of blocking on entire dataset
- response rendering should remain usable for multi-megabyte JSON
- search results should begin appearing < 300ms after typing for local index
- autosave must never block the UI

Large response handling:

- virtualization
- truncation for extremely large outputs
- lazy parsing
- expandable raw view

---

# 40. OFFLINE / SYNC MODEL

The application must remain usable when disconnected.

Offline-capable:

- open previously loaded workspaces
- edit requests
- edit collections
- edit scripts
- edit variables
- inspect cached history
- run requests if network to target exists

Online-only:

- shared collaboration state
- cloud monitors
- server-side scheduled jobs
- some Git/cloud operations

Sync states:

- synced
- syncing
- offline
- conflict
- failed

Never silently overwrite local edits.

Current Postman automatically syncs cloud-backed data across linked devices when online and indicates offline state when synchronization cannot happen. [35]

---

# 41. SECURITY

Implement:

- TLS everywhere
- secure cookies
- CSRF protection where applicable
- strict CORS
- OAuth/OIDC
- MFA-ready architecture
- RBAC
- resource authorization
- row-level tenant isolation
- encryption at rest
- encryption in transit
- KMS-backed key management
- secrets vault
- rate limiting
- abuse detection
- audit logs
- anomaly detection

Never trust workspace IDs from the client without authorization checks.

Script sandbox must be separated from API credentials.

Cloud collection runners must use short-lived credentials where possible.

AI integrations must have data boundary controls.

---

# 42. OBSERVABILITY

All server operations require:

- structured logs
- trace ID
- request ID
- metrics
- duration
- outcome

Metrics:

- request execution count
- request success/failure
- p50/p95/p99 duration
- script execution failures
- collection run failures
- monitor failures
- queue latency
- WebSocket connections
- sync conflicts
- AI requests

Never put raw authorization headers or raw secret variable values into telemetry.

---

# 43. ACCESSIBILITY

WCAG-oriented implementation:

- keyboard navigation
- visible focus
- screen-reader labels
- high contrast
- no color-only status
- resizable text
- reduced motion
- accessible code editors where possible

Every important operation must be possible without a mouse.

---

# 44. ERROR UX

Every error needs:

1. concise human explanation
2. technical details expandable
3. request ID
4. retry where safe
5. copy diagnostics
6. relevant remediation

Example:

`401 Unauthorized`

Show:

- endpoint
- auth method
- whether token exists
- whether token is expired if known
- server response
- “Refresh token” or “Edit authorization” actions

Do not claim an expired token if the evidence does not prove it.

---

# 45. TESTING STRATEGY

Use four levels:

### Unit

- variable resolution
- auth generation
- request serialization
- response parsing
- JSONPath
- assertions
- status mapping
- collection traversal
- Git diff/merge

### Integration

- API + DB
- sync
- WebSocket
- worker queue
- script sandbox
- mock server
- Git provider

### End-to-end

Use Playwright.

### Load

- concurrent users
- large collections
- giant responses
- repeated monitors

---

# 46. REQUIRED END-TO-END TEST SCENARIOS

The AI coding agent must implement automated E2E scenarios for at least the following.

## Account/workspace

1. Create account.
2. Sign in.
3. Create workspace.
4. Invite teammate.
5. Change teammate role.
6. Remove teammate.
7. Delete workspace with confirmation.

## Requests

8. Send basic GET.
9. Send POST JSON.
10. Send multipart upload.
11. Send form-urlencoded request.
12. Send binary payload.
13. Follow redirect.
14. Handle redirect loop safely.
15. Timeout request.
16. Abort request.
17. Retry failed request where configured.
18. Handle DNS failure.
19. Handle TLS error.
20. Handle malformed URL.

## Authentication

21. Basic auth success.
22. Bearer token success.
23. API key in header.
24. API key in query.
25. OAuth2 authorization-code flow.
26. OAuth2 expired token.
27. Auth inheritance collection -> folder -> request.
28. Secret masking.

## Variables

29. Environment switching changes base URL.
30. Collection variable resolves.
31. Environment variable overrides collection variable.
32. Local secret never syncs.
33. Missing variable detection.
34. Dynamic variable generation.
35. Variable updated by script and consumed by next request.

## Scripts/tests

36. Pre-request script executes.
37. Pre-request script failure stops request according to policy.
38. Post-response script executes.
39. Assertion pass.
40. Assertion fail.
41. Script timeout.
42. Infinite loop is killed.
43. Script attempts forbidden filesystem access.
44. Script logs are isolated to run.

## Collections

45. Save request to collection.
46. Nested folder creation.
47. Collection auth inheritance.
48. Collection script execution.
49. Run collection sequentially.
50. Run selected folder only.
51. Data-driven collection run.
52. Stop on first failure.
53. Continue after failure.
54. Export collection.
55. Reimport exported collection.

## History

56. History records environment.
57. Search history by URL.
58. Search history by method.
59. Filter history by environment.
60. Filter by status.
61. Replay a historic request.
62. Clear selected history.

## Collaboration

63. Two users edit same request.
64. Detect concurrent edit.
65. Resolve conflict.
66. Add comment.
67. Mention teammate.
68. Resolve comment.
69. Compare versions.
70. Fork resource.
71. Create pull request.
72. Merge pull request.

## Git

73. Connect repository.
74. Pull branch.
75. Edit request locally.
76. Commit change.
77. Push change.
78. Create branch.
79. Detect remote conflict.
80. Three-way merge.
81. Abort merge safely.

## Import/export

82. Import cURL.
83. Import OpenAPI 3.0.
84. Import OpenAPI 3.1.
85. Import Postman-compatible collection.
86. Import malformed JSON and show diagnostics.
87. Detect secrets during import.
88. Export collection.

## Mocking

89. Create mock from example.
90. Call mock endpoint.
91. Select correct example.
92. Query-specific mock behavior.
93. Delay response.
94. Return deterministic mock.

## Monitoring

95. Create monitor.
96. Schedule monitor.
97. Successful monitor run.
98. Failed assertion causes failed monitor.
99. Notification on failure.
100. Monitor history.

## Protocols

101. GraphQL request.
102. GraphQL variables.
103. GraphQL introspection.
104. WebSocket connect.
105. WebSocket send text.
106. WebSocket receive server message.
107. WebSocket reconnect.
108. gRPC unary call.
109. gRPC metadata.
110. MQTT publish/subscribe if enabled.

## Performance

111. Run 10 concurrent users.
112. Detect latency regression.
113. Enforce request ceiling.
114. Kill running performance test.

## AI

115. Generate request from natural language.
116. Generate tests from response.
117. Explain failure.
118. Create mock with AI.
119. Redact secret before AI submission.
120. Deny disallowed AI provider by organization policy.

## New feature — BYO Agent Model

121. Configure OpenAI-compatible private endpoint.
122. Validate provider connection.
123. Run Agent Mode with private model.
124. Tool call works through provider.
125. Streaming response works.
126. Secret redaction works.
127. Admin disables unapproved provider.
128. Provider outage fails over safely if configured.

---

# 47. NEGATIVE / SECURITY TEST SCENARIOS

The agent must explicitly test:

- tenant A cannot read tenant B collection
- tenant A cannot guess a workspace ID and access it
- revoked member token stops working
- deleted user no longer receives notifications
- expired session cannot call mutation APIs
- CSRF attack fails
- malformed JWT fails safely
- oversized request body is rejected
- oversized response does not crash browser
- malicious JSON is rendered safely
- HTML response cannot access parent application
- stored XSS in collection description is escaped
- stored XSS in request description is escaped
- malicious script cannot read session token
- SSRF protections on server-side fetches
- internal metadata IPs blocked where relevant
- webhook endpoints protected against abuse
- rate limits trigger correctly
- secret values never appear in logs
- secret values never appear in exported non-secret data
- AI redaction catches common credential patterns

---

# 48. DATA MIGRATION / RECOVERY TESTS

Test:

- browser refresh during save
- tab crash during save
- network disappears during save
- process/browser crash during collection edit
- two-device edit
- rollback to previous version
- recovery of deleted request
- recovery after failed migration
- interrupted Git pull
- interrupted Git push

---

# 49. DEMO DATA

Ship a demo workspace called “Sample Commerce API”.

Collections:

- Auth
- Users
- Products
- Cart
- Orders
- Payments

Environments:

- Local
- Staging
- Production

Include:

- realistic variables
- tests
- example responses
- mock server
- OpenAPI specification
- monitor

This lets a new user understand the platform without configuring anything.

---

# 50. FIRST-RUN TUTORIAL

On first launch:

Step 1 — Create request

Step 2 — Send it

Step 3 — Save to collection

Step 4 — Create environment

Step 5 — Add variable

Step 6 — Add a test

Step 7 — Run collection

Step 8 — Create mock

Step 9 — Publish docs

Step 10 — Enable monitor

Allow “Skip tutorial”.

---

# 51. DESIGN LANGUAGE

Create an original design system.

Do not reproduce Postman’s exact branding, typography, logos or proprietary visual treatment.

Visual direction:

- professional developer tool
- dense but readable
- neutral surfaces
- clear hierarchy
- restrained accent color
- monospaced code areas
- strong keyboard focus
- predictable tab behavior

Components:

- Button
- IconButton
- Input
- CodeEditor
- Tabs
- Tree
- DataTable
- Dropdown
- CommandPalette
- Modal
- Drawer
- Toast
- Badge
- SplitPane
- DiffViewer
- RunTimeline
- VariableToken
- StatusIndicator

---

# 52. KEYBOARD SHORTCUTS

Minimum:

```text
Ctrl/Cmd + K   Command palette
Ctrl/Cmd + Enter   Send request
Ctrl/Cmd + S   Save
Ctrl/Cmd + Shift + S   Save as
Ctrl/Cmd + P   Search/open
Ctrl/Cmd + B   Toggle sidebar
Ctrl/Cmd + J   Toggle console
Ctrl/Cmd + Shift + R   Run collection
Ctrl/Cmd + Shift + F   Global search
Esc            Close modal
```

Shortcuts must be discoverable through the command palette.

---

# 53. FINAL BUILD PHASES

## Phase A — Foundation

- monorepo
- design system
- auth
- workspace
- DB schema
- API gateway
- request runner

## Phase B — Core client

- request editor
- response viewer
- history
- collections
- variables
- secrets

## Phase C — Automation

- scripts
- tests
- collection runner
- CLI

## Phase D — Professional API workflows

- OpenAPI
- mocks
- monitors
- Git
- collaboration
- documentation

## Phase E — Protocols

- GraphQL
- WebSocket
- gRPC
- Socket.IO/MQTT later

## Phase F — Intelligence

- AI assistant
- Agent Mode
- MCP
- BYO Agent Model

## Phase G — Hardening

- security audit
- load testing
- failure injection
- accessibility
- backup/recovery
- disaster recovery

---

# 54. DEFINITION OF DONE

Do not report “implemented” merely because a button exists.

A feature is done only when:

1. UI is usable.
2. Backend endpoint works.
3. Persistence works.
4. Authorization works.
5. Error states work.
6. Loading states work.
7. Empty states work.
8. Offline/disconnected behavior is defined.
9. Automated tests cover normal and negative cases.
10. Telemetry exists where appropriate.
11. No secrets leak into logs.
12. Accessibility is acceptable.
13. Documentation exists.
14. Migration/export behavior is tested.
15. Performance is acceptable.

---

# 55. REQUIRED AI CODING-AGENT BEHAVIOR

The AI agent receiving this specification must behave as a principal engineer, product designer and QA lead.

Before coding:

- inspect repository
- identify stack
- identify constraints
- create architecture decision records
- create implementation backlog
- preserve existing working code

During coding:

- implement in vertical slices
- compile after each major change
- run unit tests frequently
- run E2E tests for completed flows
- do not leave TODO placeholders for P0 functionality
- create realistic seed data
- update docs when APIs change
- add migrations
- write rollback-safe migrations

After coding each milestone:

- run formatter
- run linter
- run unit tests
- run integration tests
- run E2E
- run security tests
- run type checks
- run production build

If a requested feature conflicts with security, reliability or privacy, implement the safest production-grade version and document the tradeoff.

Never hardcode API keys.

Never use fake network calls in production code just to make the UI appear functional.

For demo mode, isolate mocks behind a clear demo environment.

---

# 56. REQUIRED OUTPUT FROM THE CODING AGENT

At the end, produce:

1. architecture overview
2. repository structure
3. setup instructions
4. environment variable reference
5. database schema
6. API specification
7. local development instructions
8. test commands
9. E2E test report
10. known limitations
11. security notes
12. deployment instructions
13. backup/recovery instructions
14. user documentation
15. administrator documentation

The product must be runnable locally from a clean checkout.

A new engineer should be able to:

```bash
git clone ...
cp .env.example .env
npm install
npm run db:migrate
npm run seed
npm run dev
```

and immediately access a working API-development workspace.

---

# 57. REFERENCE SOURCES USED FOR THIS SPECIFICATION

[1] Postman Docs — Postman basics overview. https://learning.postman.com/docs/getting-started/basics/postman-basics

[2] Postman Docs — Request basics / supported protocols. https://learning.postman.com/docs/use/send-requests/create-requests/request-basics

[3] Postman Docs — Test API functionality / running collections. https://learning.postman.com/docs/tests-and-scripts/running-collections/running-collections-overview/

[4] Postman Docs — API specification design / Spec Hub. https://learning.postman.com/docs/design-apis/specifications/overview

[5] Postman Docs — Workspaces. https://learning.postman.com/docs/collaborating-in-postman/using-workspaces/overview

[6] Postman Docs — Postman API reference. https://learning.postman.com/docs/reference/overview

[7] Postman Docs — Agent Mode. https://learning.postman.com/docs/use/agent-mode/overview

[8] Postman Docs — AI features. https://learning.postman.com/docs/getting-started/basics/about-ai

[9] Postman Docs — Capture HTTP traffic / proxy / Interceptor. https://learning.postman.com/docs/use/capturing-request-data/browser-tool/agent-mode-web-apps and related capture documentation

[10] Postman Status — platform component inventory and status. https://status.postman.com/

[11] Postman Docs — Import data. https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data

[12] Postman Docs — Data import and export. https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-and-exporting-overview

[13] Postman Docs — Workspaces overview. https://learning.postman.com/docs/collaborating-in-postman/using-workspaces/overview

[14] Postman Community — request to filter run history by environment. https://community.postman.com/t/is-there-a-way-to-filter-history-based-on-environement-used/58186

[15] Postman Community — request for additional history search/filter capabilities. https://community.postman.com/t/is-it-possible-to-search-history-with-http-method/4976

[16] Postman Docs — Create collections. https://learning.postman.com/docs/collections/use-collections/create-collections

[17] Postman Docs — Environments. https://learning.postman.com/docs/use/send-requests/variables/managing-environments

[18] Postman Docs — Variables. https://learning.postman.com/docs/use/send-requests/variables/variables

[19] Postman Docs — Postman Vault / secure secret storage. https://learning.postman.com/docs/use/overview

[20] Postman Docs — Scripts. https://learning.postman.com/docs/tests-and-scripts/write-scripts/intro-to-scripts

[21] Postman Docs — Sandbox API reference. https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/overview

[22] Postman Docs — Spec Hub. https://learning.postman.com/docs/design-apis/specifications/overview

[23] Postman Docs — request protocols. https://learning.postman.com/docs/use/send-requests/create-requests/request-basics

[24] Postman Docs — WebSocket messages. https://learning.postman.com/docs/use/send-requests/protocols/websocket/work-with-websocket-messages/

[25] Postman Docs — Native Git. https://learning.postman.com/docs/use/native-git/develop-locally

[26] Postman Docs — import from Git repositories. https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data

[27] Postman Docs — collaboration. https://learning.postman.com/docs/collaborating-in-postman/collaborate-in-postman-overview

[28] Postman Docs — publish documentation. https://learning.postman.com/docs/publishing-your-api/publishing-your-docs

[29] Postman Docs — monitors. https://learning.postman.com/docs/monitoring-your-api/intro-monitors

[30] Postman Docs — Agent Mode. https://learning.postman.com/docs/use/agent-mode/overview

[31] Postman Docs — AI requests. https://learning.postman.com/docs/use/send-requests/protocols/ai-requests/create

[32] Postman Community — self-hosted AI integration discussion / feature request. https://community.postman.com/t/self-hosted-ai-integration/89439

[33] Postman Docs — Postman API. https://learning.postman.com/docs/reference/postman-api/intro-api

[34] Postman Docs — MCP server. https://learning.postman.com/docs/developer/postman-api/postman-mcp-server/overview

[35] Postman Docs — syncing changes across devices. https://learning.postman.com/docs/getting-started/basics/syncing

---

# START NOW

Use this document as the authoritative product and engineering specification. Do not reduce the implementation to a mockup. Build the functional system from the storage layer upward, with tests proving each major workflow. Prioritize P0, then P1, then P2/P3.

The result should be a credible professional API engineering platform that can replace the most common day-to-day Postman workflows while providing a differentiated, privacy-first Bring-Your-Own-Model experience for Agent Mode.
