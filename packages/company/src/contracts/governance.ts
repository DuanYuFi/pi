import Type, { type Static } from "typebox";
import {
	ActorRefSchema,
	EntityRefSchema,
	IdSchema,
	JsonValueSchema,
	strictObject,
	TimestampSchema,
	TokenUsageSchema,
} from "./common.ts";

const ApprovalProperties = {
	id: IdSchema,
	requestedBy: ActorRefSchema,
	approver: ActorRefSchema,
	subject: EntityRefSchema,
	summary: Type.String({ minLength: 1 }),
	requestedAt: TimestampSchema,
} as const;

export const ApprovalSchema = Type.Union(
	[
		strictObject({ ...ApprovalProperties, status: Type.Literal("pending") }),
		strictObject({
			...ApprovalProperties,
			status: Type.Literal("approved"),
			decidedAt: TimestampSchema,
			reason: Type.Optional(Type.String({ minLength: 1 })),
		}),
		strictObject({
			...ApprovalProperties,
			status: Type.Literal("rejected"),
			decidedAt: TimestampSchema,
			reason: Type.String({ minLength: 1 }),
		}),
		strictObject({
			...ApprovalProperties,
			status: Type.Literal("cancelled"),
			decidedAt: TimestampSchema,
			reason: Type.String({ minLength: 1 }),
		}),
	],
	{ $id: "Approval" },
);
export type Approval = Static<typeof ApprovalSchema>;

const ToolInvocationProperties = {
	id: IdSchema,
	agentRef: IdSchema,
	toolName: IdSchema,
	projectRef: Type.Optional(IdSchema),
	taskRef: Type.Optional(IdSchema),
	approvalRef: Type.Optional(IdSchema),
	input: JsonValueSchema,
	requestedAt: TimestampSchema,
} as const;

export const ToolInvocationSchema = Type.Union(
	[
		strictObject({ ...ToolInvocationProperties, status: Type.Literal("requested") }),
		strictObject({ ...ToolInvocationProperties, status: Type.Literal("running"), startedAt: TimestampSchema }),
		strictObject({
			...ToolInvocationProperties,
			status: Type.Literal("succeeded"),
			startedAt: TimestampSchema,
			finishedAt: TimestampSchema,
			result: Type.Optional(JsonValueSchema),
		}),
		strictObject({
			...ToolInvocationProperties,
			status: Type.Literal("failed"),
			startedAt: TimestampSchema,
			finishedAt: TimestampSchema,
			error: Type.String({ minLength: 1 }),
		}),
		strictObject({
			...ToolInvocationProperties,
			status: Type.Literal("cancelled"),
			startedAt: Type.Optional(TimestampSchema),
			finishedAt: TimestampSchema,
			reason: Type.String({ minLength: 1 }),
		}),
	],
	{ $id: "ToolInvocation" },
);
export type ToolInvocation = Static<typeof ToolInvocationSchema>;

export const CostRecordSchema = Type.Object(
	{
		id: IdSchema,
		agentRef: IdSchema,
		provider: IdSchema,
		model: IdSchema,
		projectRef: Type.Optional(IdSchema),
		taskRef: Type.Optional(IdSchema),
		toolInvocationRef: Type.Optional(IdSchema),
		usage: TokenUsageSchema,
		recordedAt: TimestampSchema,
	},
	{ additionalProperties: false, $id: "CostRecord" },
);
export type CostRecord = Static<typeof CostRecordSchema>;

export const AuditEventSchema = Type.Object(
	{
		id: IdSchema,
		actor: ActorRefSchema,
		action: IdSchema,
		target: EntityRefSchema,
		outcome: Type.Union([Type.Literal("succeeded"), Type.Literal("failed"), Type.Literal("denied")]),
		projectRef: Type.Optional(IdSchema),
		taskRef: Type.Optional(IdSchema),
		toolInvocationRef: Type.Optional(IdSchema),
		correlationId: Type.Optional(IdSchema),
		details: Type.Optional(JsonValueSchema),
		occurredAt: TimestampSchema,
	},
	{ additionalProperties: false, $id: "AuditEvent" },
);
export type AuditEvent = Static<typeof AuditEventSchema>;
