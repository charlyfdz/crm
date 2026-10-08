# CRM Corporativo product contract

Date: 2026-10-02.
Role: product specialist and business analyst. The role asserts no human professional credential.
Writing scope: `docs/product/**`, `PROJECT-CHARTER.md`, and `docs/team/README.md`.
Baseline revision: `6d4793d`.

## Approved direction

The product is a professional CRM for internal company use.
Each installation serves one client company and uses its own database.
The client operates the installation on a private server, homelab, or VPS.
The product also supports delivery and implementation for other companies.
The product does not use a shared SaaS control plane.
The project preserves the MIT license and the upstream copyright notice.

The current user mandate defines this scope.
Corporativo S&F is the first pilot company.
The future target is Coolify on `paas-control` inside homelab.
The user requires the complete version before that installation.
The current task authorizes no installation or external platform writes.
`PROJECT-CHARTER.md` and the [pilot contract](PILOT-CORPORATIVO-SF.md) describe the same approved direction.
Legacy plans remain historical evidence.

## Reading order

| Document | Purpose |
| --- | --- |
| [Corporativo S&F pilot](PILOT-CORPORATIVO-SF.md) | Dated decision, verified sources, complete-version gate, future admission, and open company questions. |
| [S&F business context](SF-BUSINESS-CONTEXT.md) | Public website evidence, source limits, proposed service fields, workflow, and synthetic rehearsal. |
| [PRD](PRD.md) | Outcomes, domain rules, functional scope, and implementation defaults. |
| [Baseline](BASELINE.md) | Inspected sources, existing capabilities, gaps, and verification limits. |
| [Sales workflow](SALES-WORKFLOW.md) | Current flow, target flow, exceptions, and code anchors. |
| [Roles and permissions](ROLES-PERMISSIONS.md) | Access catalogue, record scope, administrative authority, and negative cases. |
| [User stories](USER-STORIES.md) | Actionable stories and executable acceptance scenarios. |
| [Requirements matrix](REQUIREMENTS-MATRIX.md) | Requirement, story, evidence, dependency, release, and delivery owner. |
| [Acceptance](ACCEPTANCE.md) | Local, production, and commercial delivery gates. |
| [Roadmap](ROADMAP.md) | Releases, exit criteria, sequencing, and implementation handoff. |

## Status contract

Status has two independent dimensions.

| Dimension | Value | Meaning |
| --- | --- | --- |
| Implementation | EXISTING | The inspected code contains the capability. |
| Implementation | PARTIAL | The inspected code covers part of the target requirement. |
| Implementation | TO IMPLEMENT | The target capability needs implementation or adaptation. |
| Verification | INSPECTED | A reader checks source structure or documentation. |
| Verification | TEST PRESENT | A relevant test exists; this task does not execute it. |
| Verification | PROVEN | An execution receipt identifies revision, environment, scenario, and observed result. |
| Verification | PENDING | The required execution receipt does not exist in this product review. |

`TEST PRESENT` never means `PROVEN`.
`EXISTING` never means production acceptance.
Every requirement's complete runtime acceptance remains `PENDING` in this delivery.
The historical handoff reports 49 passing unit tests. The latest principal handoff reports 95 passing tests and static checks.
Those partial results never promote a complete requirement or release.

The principal subsequently records [260 selected passing tests](../verification/2026-10-02-local-foundations.md) and integrated builds.
That dated receipt supersedes test totals, not the 44 pending full acceptance decisions.
This specialist inspects sources and validates documents without rerunning application tests.

## Complete-version rule

R1 supplies local foundations. It never authorizes the S&F homelab installation.
R2 completes manual workflows and configurable features.
R3 supplies recovery, security, production-artifact, and measured-capacity evidence.
R4 technical rehearsals prove independent delivery, portability, training, and support revocation.
Real commercial terms remain separate decisions for future sales.
Required disabled-state tests cover optional services. Optional AI implementation never blocks the manual core.
The company reviews the complete candidate before a separate installation decision.
Final pilot acceptance also requires observed results after an authorized installation.

## Traceability

`REQ-001` maps to `US-001` and acceptance scenario `AC-001`.
The same numbering rule covers all 44 requirements.
Evidence IDs use `E-xx` in [BASELINE.md](BASELINE.md).
Operational gates use `L-xx`, `P-xx`, and `D-xx` in [ACCEPTANCE.md](ACCEPTANCE.md).
Release IDs use `R0` through `R5` in [ROADMAP.md](ROADMAP.md).

The principal agent owns dependencies, integration, and verification execution.
This specialist changes only the stated document paths.
Cross-area changes and knowledge-engine registration remain principal-agent handoffs.
This delivery does not install dependencies, run servers, deploy, publish, or write to external platforms or graphs.

## Issues

1. NOT DONE — Runtime acceptance remains pending for every target requirement.
   Fix: execute the linked scenarios in an isolated environment.
2. RISK — Legacy documents describe narrower scope and conflicting capabilities.
   Fix: use the source inventory and current mandate during implementation.
