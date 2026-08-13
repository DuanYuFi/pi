import Type, { type Static } from "typebox";
import { ActorRefSchema, IdSchema, strictObject, TimestampSchema } from "./common.ts";

export const AgentSchema = Type.Object(
	{
		id: IdSchema,
		positionRef: IdSchema,
		roleRefs: Type.Array(IdSchema, { minItems: 1, uniqueItems: true }),
		createdAt: TimestampSchema,
	},
	{ additionalProperties: false, $id: "Agent" },
);
export type Agent = Static<typeof AgentSchema>;

export const ProjectStatusSchema = Type.Union([
	Type.Literal("planned"),
	Type.Literal("active"),
	Type.Literal("blocked"),
	Type.Literal("completed"),
	Type.Literal("cancelled"),
]);
export type ProjectStatus = Static<typeof ProjectStatusSchema>;

export const ProjectSchema = Type.Object(
	{
		id: IdSchema,
		title: Type.String({ minLength: 1 }),
		objective: Type.String({ minLength: 1 }),
		owner: ActorRefSchema,
		createdBy: ActorRefSchema,
		status: ProjectStatusSchema,
		createdAt: TimestampSchema,
		updatedAt: TimestampSchema,
	},
	{ additionalProperties: false, $id: "Project" },
);
export type Project = Static<typeof ProjectSchema>;

export const TaskPrioritySchema = Type.Union([
	Type.Literal("low"),
	Type.Literal("normal"),
	Type.Literal("high"),
	Type.Literal("urgent"),
]);
export type TaskPriority = Static<typeof TaskPrioritySchema>;

const TaskProperties = {
	id: IdSchema,
	projectRef: Type.Optional(IdSchema),
	parentTaskRef: Type.Optional(IdSchema),
	type: IdSchema,
	objective: Type.String({ minLength: 1 }),
	createdBy: ActorRefSchema,
	assignedTo: ActorRefSchema,
	departmentRef: IdSchema,
	priority: TaskPrioritySchema,
	acceptanceCriteria: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
	createdAt: TimestampSchema,
	updatedAt: TimestampSchema,
} as const;

export const TaskSchema = Type.Union(
	[
		strictObject({ ...TaskProperties, status: Type.Literal("queued") }),
		strictObject({ ...TaskProperties, status: Type.Literal("running") }),
		strictObject({ ...TaskProperties, status: Type.Literal("blocked") }),
		strictObject({ ...TaskProperties, status: Type.Literal("completed"), completedAt: TimestampSchema }),
		strictObject({
			...TaskProperties,
			status: Type.Literal("failed"),
			completedAt: TimestampSchema,
			error: Type.String({ minLength: 1 }),
		}),
		strictObject({
			...TaskProperties,
			status: Type.Literal("cancelled"),
			completedAt: TimestampSchema,
			reason: Type.String({ minLength: 1 }),
		}),
	],
	{ $id: "Task" },
);
export type Task = Static<typeof TaskSchema>;

export const MessageSchema = Type.Object(
	{
		id: IdSchema,
		sender: ActorRefSchema,
		recipients: Type.Array(ActorRefSchema, { minItems: 1, uniqueItems: true }),
		body: Type.String({ minLength: 1 }),
		inReplyToMessageRef: Type.Optional(IdSchema),
		projectRef: Type.Optional(IdSchema),
		taskRef: Type.Optional(IdSchema),
		artifactRefs: Type.Optional(Type.Array(IdSchema, { minItems: 1, uniqueItems: true })),
		sentAt: TimestampSchema,
	},
	{ additionalProperties: false, $id: "Message" },
);
export type Message = Static<typeof MessageSchema>;

export const ArtifactSchema = Type.Object(
	{
		id: IdSchema,
		type: IdSchema,
		title: Type.String({ minLength: 1 }),
		uri: Type.String({ minLength: 1 }),
		mediaType: Type.String({ minLength: 1 }),
		createdBy: ActorRefSchema,
		projectRef: Type.Optional(IdSchema),
		taskRef: Type.Optional(IdSchema),
		createdAt: TimestampSchema,
	},
	{ additionalProperties: false, $id: "Artifact" },
);
export type Artifact = Static<typeof ArtifactSchema>;
