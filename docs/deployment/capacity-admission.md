# Capacity and admission

The confirmed target is Coolify in the homelab `paas-control` VM.
The CRM pilot belongs to Corporativo S&F. Infrastructure ownership remains Personal-Carlos.
Company data, credentials, volumes, release evidence, and operations records stay separate.
Host administrators retain privileged access. The data owner must accept that infrastructure trust boundary.

## Source constraints

| Source | Constraint |
| --- | --- |
| [COR-522](https://linear.app/corporativo-sf/issue/COR-522/f72-definir-capacidad-cuotas-y-placement-de-servicios-del-homelab) | Shared non-core pool: 2.5 GiB RAM and 3 vCPU total; not a CRM reservation |
| [COR-527](https://linear.app/corporativo-sf/issue/COR-527/f7g-gate-declarar-coolify-platform-ready-para-produccion-multi-entidad) | Platform-ready status does not admit a new workload |
| [COR-523](https://linear.app/corporativo-sf/issue/COR-523/f73-definir-alta-baja-y-catalogo-operativo-de-servicios) | Service lifecycle acceptance remains a separate gate |
| User task, 2026-10-02 | Complete the CRM version before installation; do not install now |

These references record the supplied task constraints. This task does not renew remote platform snapshots.
The local knowledge check reports stale remote evidence. It does not block bounded local package work.
Do not claim current platform capacity from an older graph or an HTTP health response.

## Resource contract

Compose persists per-service `mem_limit`, `cpus`, and log rotation settings.
The limits need measured, approved values. No default quota represents an allocation.
The static resource validator checks runtime and stopped-application maintenance phases against the entire shared pool.
It returns `capacityAdmission: false`. This result never proves spare capacity.

Runtime includes PostgreSQL, Redis, API, application, and cron. Enabled AI adds the agent.
Maintenance includes PostgreSQL, Redis, and the migration tool while application services stay stopped.
Backups, restores, image builds, and one-time provisioning also need measured operational headroom.
Never run image builds beside production workloads without accepted build capacity.

Use supported persistent Coolify or Compose configuration. Never use temporary `docker update` limits as acceptance evidence.
Verify effective container limits and log settings after recreation in an authorized test environment.
The supported field meanings appear in [Docker Compose services](https://docs.docker.com/reference/compose-file/services/).
Coolify documents measured resource configuration in [Resource limits](https://coolify.io/docs/applications/configuration/resource-limits).

## Admission record

`deploy/admission.pending.json` records every pending gate. The record contains no host addresses or credentials.
Preflight validates declarations. It does not authenticate approvals or remeasure the server.
Review every referenced receipt before trusting the record.

Admission requires:

- The complete CRM passes business and security acceptance.
- The frozen container images pass build and smoke tests.
- Restored data passes schema, permissions, login, and business smoke tests.
- File storage has an accepted recovery scope.
- Both HTTPS origins work through the approved private tailnet path.
- Effective limits survive container recreation.
- The service lifecycle and rollback plan receive acceptance.
- The owner provides explicit deployment authorization.

Capacity receipts must be less than 24 hours old at admission.
Record other non-core allocations before adding the CRM. Do not substitute idle CPU usage for allocated CPU limits.
Every phase plus other allocations must fit the shared pool.
Guest free space must reach 40 GiB. Projected host free space must remain at least 150 GiB.
Host free space below 200 GiB needs operator review under the source policy.
Document measured peaks, representative load, build headroom, restoration time, and PostgreSQL connection counts in the receipt.

## Issues

1. NOT DONE — No current capacity receipt or CRM quota exists.
   Fix: measure the complete release and obtain workload admission before installation.
2. NOT DONE — No accepted private routing, lifecycle record, or deployment authorization exists.
   Fix: obtain the separate pilot decisions after complete-version acceptance.
3. RISK — Synthetic declarations can pass syntax checks without valid external evidence.
   Fix: independently verify receipts and approval authority before installation.
