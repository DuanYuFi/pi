# Technoledge Co.

Technoledge Co. is an Agent-operated software company built as a private application package on Pi.

M1—M3 are complete. The package currently provides the versioned organization, core data contracts, simplified business catalog, and the design for the first company runtime:

- [`spec/organization.yaml`](spec/organization.yaml) is the machine-readable organization truth.
- [`docs/ORGANIZATION.md`](docs/ORGANIZATION.md) explains the departments, positions, and responsibility boundaries.
- [`docs/DATA_CONTRACTS.md`](docs/DATA_CONTRACTS.md) defines the current TypeBox runtime contracts.
- [`docs/BUSINESS_CATALOG.md`](docs/BUSINESS_CATALOG.md) defines the five first-version business types.
- [`docs/RUNTIME_DESIGN.md`](docs/RUNTIME_DESIGN.md) is the authoritative M3 design for dispatch, software delivery, permissions, background work, notifications, cost access, and recovery.
- [`src/index.ts`](src/index.ts) exports the schemas, derived TypeScript types, and validation helpers.

M3 is a design milestone. SQLite storage, task control, Tools, employee Agent definitions, Pi subagent integration, background execution, email delivery, and the external Supervisor are intentionally deferred to M4.
