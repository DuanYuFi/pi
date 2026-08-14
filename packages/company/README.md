# Technoledge Co.

Technoledge Co. is an Agent-operated company built as a private application package on Pi.

The package currently defines the company structure and its versioned core data contracts:

- [`spec/organization.yaml`](spec/organization.yaml) is the machine-readable organization definition.
- [`docs/ORGANIZATION.md`](docs/ORGANIZATION.md) is the human-readable explanation.
- [`docs/DATA_CONTRACTS.md`](docs/DATA_CONTRACTS.md) defines the runtime contract semantics and boundaries.
- [`docs/BUSINESS_CATALOG.md`](docs/BUSINESS_CATALOG.md) is the M2 catalog and template for describing business types and tracing their requirements into M3.
- [`src/index.ts`](src/index.ts) exports TypeBox schemas, derived TypeScript types, and validation helpers.

Database storage, Agent runtime behavior, permissions, tools, budgets, workflows, and role instructions are intentionally left for later phases.
