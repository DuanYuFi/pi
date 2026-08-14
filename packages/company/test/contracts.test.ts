import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
	type ActorRef,
	AgentSchema,
	ApprovalSchema,
	ArtifactSchema,
	AuditEventSchema,
	ContractValidationError,
	CostRecordSchema,
	deriveReportingRelationships,
	MessageSchema,
	ProjectSchema,
	parseContract,
	parseOrganization,
	parseOrganizationYaml,
	TaskSchema,
	TokenUsageSchema,
	ToolInvocationSchema,
} from "../src/index.ts";

const organizationYaml = readFileSync(new URL("../spec/organization.yaml", import.meta.url), "utf8");

const ceo: ActorRef = { kind: "position", id: "executive.general-manager" };
const chiefSecretary: ActorRef = { kind: "agent", id: "agent-chief-secretary-1" };
const projectManager: ActorRef = { kind: "agent", id: "agent-project-manager-1" };

const agent = {
	id: "agent-chief-secretary-1",
	positionRef: "administration.chief-secretary",
	roleRefs: ["chief-secretary"],
	createdAt: 1,
} as const;

const project = {
	id: "project-contracts",
	title: "核心数据契约",
	objective: "建立公司的标准运行对象",
	owner: projectManager,
	createdBy: ceo,
	status: "active",
	createdAt: 2,
	updatedAt: 3,
} as const;

const task = {
	id: "task-contracts-1",
	projectRef: project.id,
	type: "implementation",
	objective: "实现契约 Schema",
	createdBy: projectManager,
	assignedTo: { kind: "position", id: "engineering.pool" } as const,
	departmentRef: "engineering",
	priority: "normal",
	acceptanceCriteria: ["Schema 和 TypeScript 类型同源"],
	status: "running",
	createdAt: 4,
	updatedAt: 5,
} as const;

const message = {
	id: "message-1",
	sender: ceo,
	recipients: [chiefSecretary],
	body: "请启动核心数据契约项目。",
	projectRef: project.id,
	taskRef: task.id,
	sentAt: 6,
} as const;

const artifact = {
	id: "artifact-contracts-1",
	type: "source-code",
	title: "核心数据契约实现",
	uri: "packages/company/src/contracts",
	mediaType: "text/typescript",
	createdBy: { kind: "position", id: "engineering.pool" } as const,
	projectRef: project.id,
	taskRef: task.id,
	createdAt: 7,
} as const;

const approval = {
	id: "approval-tool-1",
	requestedBy: chiefSecretary,
	approver: ceo,
	subject: { kind: "artifact", id: artifact.id } as const,
	summary: "批准发布核心数据契约",
	status: "approved",
	requestedAt: 8,
	decidedAt: 9,
} as const;

const toolInvocation = {
	id: "tool-invocation-1",
	agentRef: agent.id,
	toolName: "write_contract",
	projectRef: project.id,
	taskRef: task.id,
	approvalRef: approval.id,
	input: { artifactId: artifact.id },
	status: "succeeded",
	requestedAt: 10,
	startedAt: 11,
	finishedAt: 12,
	result: { written: true },
} as const;

const costRecord = {
	id: "cost-1",
	agentRef: agent.id,
	provider: "openai",
	model: "gpt-example",
	projectRef: project.id,
	taskRef: task.id,
	toolInvocationRef: toolInvocation.id,
	usage: {
		input: 100,
		output: 50,
		cacheRead: 20,
		cacheWrite: 0,
		totalTokens: 170,
	},
	recordedAt: 13,
} as const;

const auditEvent = {
	id: "audit-1",
	actor: chiefSecretary,
	action: "tool.invoke",
	target: { kind: "tool-invocation", id: toolInvocation.id } as const,
	outcome: "succeeded",
	projectRef: project.id,
	taskRef: task.id,
	toolInvocationRef: toolInvocation.id,
	correlationId: "contract-flow-1",
	details: { artifactId: artifact.id, costRecordId: costRecord.id },
	occurredAt: 14,
} as const;

describe("organization contract", () => {
	test("parses the checked-in organization and derives reporting relationships", () => {
		const organization = parseOrganizationYaml(organizationYaml);

		expect(organization.metadata.id).toBe("technoledge");
		expect(organization.spec.positions).toHaveLength(7);
		expect(deriveReportingRelationships(organization)).toEqual([
			{
				positionRef: "administration.chief-secretary",
				reportsToPositionRef: "executive.general-manager",
			},
			{
				positionRef: "operations-support.specialist",
				reportsToPositionRef: "administration.chief-secretary",
			},
			{
				positionRef: "finance.token-accountant",
				reportsToPositionRef: "administration.chief-secretary",
			},
			{
				positionRef: "human-resources.agent-trainer",
				reportsToPositionRef: "administration.chief-secretary",
			},
			{
				positionRef: "operations.project-manager",
				reportsToPositionRef: "administration.chief-secretary",
			},
			{
				positionRef: "engineering.pool",
				reportsToPositionRef: "operations.project-manager",
			},
		]);
	});

	test("uses the consolidated human-resources position and review-capable engineering pool", () => {
		const organization = parseOrganizationYaml(organizationYaml);
		const positionById = new Map(organization.spec.positions.map((position) => [position.id, position]));

		expect(positionById.has("human-resources.workforce-planner")).toBe(false);
		expect(positionById.has("human-resources.agent-trainer")).toBe(true);
		expect(positionById.get("engineering.pool")).toMatchObject({
			requiredRoleCoverage: ["developer", "tester", "security-engineer", "reviewer"],
			staffing: { min: 2, max: null },
		});
	});

	test("rejects duplicate identifiers", () => {
		const organization = parseOrganizationYaml(organizationYaml);
		organization.spec.departments[1]!.id = organization.spec.departments[0]!.id;

		expect(() => parseOrganization(organization)).toThrow(/duplicate department id/i);
	});

	test("rejects dangling organization references", () => {
		const organization = parseOrganizationYaml(organizationYaml);
		organization.spec.positions[1]!.departmentRef = "missing";

		expect(() => parseOrganization(organization)).toThrow(/unknown department/i);
	});

	test("rejects self-reporting and reporting cycles", () => {
		const selfReporting = parseOrganizationYaml(organizationYaml);
		selfReporting.spec.positions[1]!.reportsTo = selfReporting.spec.positions[1]!.id;
		expect(() => parseOrganization(selfReporting)).toThrow(/cannot report to itself/i);

		const cyclic = parseOrganizationYaml(organizationYaml);
		cyclic.spec.positions[0]!.reportsTo = "administration.chief-secretary";
		expect(() => parseOrganization(cyclic)).toThrow(/reporting cycle/i);
	});

	test("rejects staffing maximums below their minimum", () => {
		const organization = parseOrganizationYaml(organizationYaml);
		organization.spec.positions[1]!.staffing = { min: 2, max: 1 };

		expect(() => parseOrganization(organization)).toThrow(/staffing\.max/i);
	});

	test("rejects malformed YAML without echoing source text", () => {
		const invalid = "secret-value: [";
		try {
			parseOrganizationYaml(invalid);
			expect.unreachable("expected YAML parsing to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(ContractValidationError);
			expect((error as Error).message).not.toContain("secret-value");
		}
	});
});

describe("runtime contracts", () => {
	test.each([
		["Agent", AgentSchema, agent],
		["Project", ProjectSchema, project],
		["Task", TaskSchema, task],
		["Message", MessageSchema, message],
		["Artifact", ArtifactSchema, artifact],
		["Approval", ApprovalSchema, approval],
		["ToolInvocation", ToolInvocationSchema, toolInvocation],
		["CostRecord", CostRecordSchema, costRecord],
		["AuditEvent", AuditEventSchema, auditEvent],
	] as const)("parses a minimal valid %s", (_name, schema, value) => {
		expect(parseContract(schema, value)).toEqual(value);
	});

	test("keeps the end-to-end object chain correlated", () => {
		expect(message.sender).toEqual(ceo);
		expect(message.recipients).toEqual([chiefSecretary]);
		expect(task.projectRef).toBe(project.id);
		expect(artifact.taskRef).toBe(task.id);
		expect(toolInvocation.approvalRef).toBe(approval.id);
		expect(costRecord.toolInvocationRef).toBe(toolInvocation.id);
		expect(auditEvent.details).toEqual({ artifactId: artifact.id, costRecordId: costRecord.id });
	});

	test("rejects unknown fields, implicit coercion, negative timestamps, and empty ids", () => {
		expect(() => parseContract(AgentSchema, { ...agent, extra: true })).toThrow(ContractValidationError);
		expect(() => parseContract(AgentSchema, { ...agent, createdAt: "1" })).toThrow(ContractValidationError);
		expect(() => parseContract(AgentSchema, { ...agent, createdAt: -1 })).toThrow(ContractValidationError);
		expect(() => parseContract(AgentSchema, { ...agent, id: "" })).toThrow(ContractValidationError);
	});

	test("does not include input values in validation errors", () => {
		try {
			parseContract(AgentSchema, { ...agent, createdAt: "sensitive-value" });
			expect.unreachable("expected contract validation to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(ContractValidationError);
			expect((error as Error).message).not.toContain("sensitive-value");
		}
	});

	test("rejects invalid states and incomplete terminal records", () => {
		expect(() => parseContract(ProjectSchema, { ...project, status: "unknown" })).toThrow(ContractValidationError);
		expect(() => parseContract(TaskSchema, { ...task, status: "completed" })).toThrow(ContractValidationError);

		const incompleteApproval: Record<string, unknown> = { ...approval };
		delete incompleteApproval.decidedAt;
		expect(() => parseContract(ApprovalSchema, incompleteApproval)).toThrow(ContractValidationError);

		const incompleteInvocation: Record<string, unknown> = { ...toolInvocation, status: "failed" };
		delete incompleteInvocation.finishedAt;
		delete incompleteInvocation.result;
		expect(() => parseContract(ToolInvocationSchema, incompleteInvocation)).toThrow(ContractValidationError);
	});

	test("rejects an empty recipient list and negative token counts", () => {
		expect(() => parseContract(MessageSchema, { ...message, recipients: [] })).toThrow(ContractValidationError);
		expect(() => parseContract(TokenUsageSchema, { ...costRecord.usage, input: -1 })).toThrow(
			ContractValidationError,
		);
	});
});
