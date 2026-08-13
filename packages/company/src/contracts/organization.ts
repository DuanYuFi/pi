import Type, { type Static } from "typebox";
import { parse } from "yaml";
import {
	CONTRACT_API_VERSION,
	type ContractIssue,
	ContractValidationError,
	IdSchema,
	parseContract,
	strictObject,
} from "./common.ts";

export const DepartmentSchema = Type.Object(
	{
		id: IdSchema,
		name: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false, $id: "Department" },
);
export type Department = Static<typeof DepartmentSchema>;

export const StaffingSchema = strictObject({
	min: Type.Integer({ minimum: 0 }),
	max: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
});
export type Staffing = Static<typeof StaffingSchema>;

export const PositionSchema = Type.Object(
	{
		id: IdSchema,
		name: Type.String({ minLength: 1 }),
		actorType: Type.Union([Type.Literal("human"), Type.Literal("agent"), Type.Literal("agent-pool")]),
		departmentRef: Type.Optional(IdSchema),
		roleRef: Type.Optional(IdSchema),
		reportsTo: Type.Optional(IdSchema),
		workAssignedBy: Type.Optional(Type.Array(IdSchema, { minItems: 1, uniqueItems: true })),
		requiredRoleCoverage: Type.Optional(Type.Array(IdSchema, { minItems: 1, uniqueItems: true })),
		staffing: StaffingSchema,
	},
	{ additionalProperties: false, $id: "Position" },
);
export type Position = Static<typeof PositionSchema>;

export const OrganizationSchema = Type.Object(
	{
		apiVersion: Type.Literal(CONTRACT_API_VERSION),
		kind: Type.Literal("Organization"),
		metadata: strictObject({
			id: IdSchema,
			name: Type.String({ minLength: 1 }),
			phase: Type.Integer({ minimum: 1 }),
		}),
		spec: strictObject({
			departments: Type.Array(DepartmentSchema, { minItems: 1 }),
			positions: Type.Array(PositionSchema, { minItems: 1 }),
		}),
	},
	{ additionalProperties: false, $id: "Organization" },
);
export type Organization = Static<typeof OrganizationSchema>;

export const ReportingRelationshipSchema = Type.Object(
	{
		positionRef: IdSchema,
		reportsToPositionRef: IdSchema,
	},
	{ additionalProperties: false, $id: "ReportingRelationship" },
);
export type ReportingRelationship = Static<typeof ReportingRelationshipSchema>;

function duplicateIdIssues(kind: "department" | "position", ids: readonly string[]): ContractIssue[] {
	const seen = new Set<string>();
	const issues: ContractIssue[] = [];
	for (const [index, id] of ids.entries()) {
		if (seen.has(id)) {
			issues.push({
				path: `/spec/${kind === "department" ? "departments" : "positions"}/${index}/id`,
				message: `duplicate ${kind} id`,
				keyword: "unique",
			});
		} else {
			seen.add(id);
		}
	}
	return issues;
}

function reportingCycleIssues(positions: readonly Position[]): ContractIssue[] {
	const state = new Map<string, "visiting" | "visited">();
	const positionById = new Map(positions.map((position, index) => [position.id, { position, index }]));
	const issues: ContractIssue[] = [];

	function visit(positionId: string): void {
		const current = positionById.get(positionId);
		if (!current || state.get(positionId) === "visited") return;
		if (state.get(positionId) === "visiting") return;

		state.set(positionId, "visiting");
		const managerId = current.position.reportsTo;
		if (managerId) {
			if (state.get(managerId) === "visiting" && managerId !== positionId) {
				issues.push({
					path: `/spec/positions/${current.index}/reportsTo`,
					message: "reporting cycle detected",
					keyword: "acyclic",
				});
			} else {
				visit(managerId);
			}
		}
		state.set(positionId, "visited");
	}

	for (const position of positions) visit(position.id);
	return issues;
}

function organizationIssues(organization: Organization): ContractIssue[] {
	const issues = [
		...duplicateIdIssues(
			"department",
			organization.spec.departments.map((department) => department.id),
		),
		...duplicateIdIssues(
			"position",
			organization.spec.positions.map((position) => position.id),
		),
	];
	const departmentIds = new Set(organization.spec.departments.map((department) => department.id));
	const positionIds = new Set(organization.spec.positions.map((position) => position.id));

	for (const [index, position] of organization.spec.positions.entries()) {
		if (position.departmentRef && !departmentIds.has(position.departmentRef)) {
			issues.push({
				path: `/spec/positions/${index}/departmentRef`,
				message: "references an unknown department",
				keyword: "reference",
			});
		}
		if (position.reportsTo === position.id) {
			issues.push({
				path: `/spec/positions/${index}/reportsTo`,
				message: "position cannot report to itself",
				keyword: "reference",
			});
		} else if (position.reportsTo && !positionIds.has(position.reportsTo)) {
			issues.push({
				path: `/spec/positions/${index}/reportsTo`,
				message: "references an unknown position",
				keyword: "reference",
			});
		}
		for (const [assignerIndex, assigner] of (position.workAssignedBy ?? []).entries()) {
			if (assigner === position.id) {
				issues.push({
					path: `/spec/positions/${index}/workAssignedBy/${assignerIndex}`,
					message: "position cannot assign work to itself",
					keyword: "reference",
				});
			} else if (!positionIds.has(assigner)) {
				issues.push({
					path: `/spec/positions/${index}/workAssignedBy/${assignerIndex}`,
					message: "references an unknown position",
					keyword: "reference",
				});
			}
		}
		if (position.staffing.max !== null && position.staffing.max < position.staffing.min) {
			issues.push({
				path: `/spec/positions/${index}/staffing/max`,
				message: "staffing.max must be greater than or equal to staffing.min",
				keyword: "minimum",
			});
		}
	}

	issues.push(...reportingCycleIssues(organization.spec.positions));
	return issues;
}

export function parseOrganization(value: unknown): Organization {
	const organization = parseContract(OrganizationSchema, value);
	const issues = organizationIssues(organization);
	if (issues.length > 0) throw new ContractValidationError("Organization", issues);
	return organization;
}

export function parseOrganizationYaml(text: string): Organization {
	let value: unknown;
	try {
		value = parse(text);
	} catch {
		throw new ContractValidationError("Organization", [
			{ path: "$", message: "contains invalid YAML", keyword: "yaml" },
		]);
	}
	return parseOrganization(value);
}

export function deriveReportingRelationships(organization: Organization): ReportingRelationship[] {
	return organization.spec.positions.flatMap((position) =>
		position.reportsTo ? [{ positionRef: position.id, reportsToPositionRef: position.reportsTo }] : [],
	);
}
