import Type, { type Static, type TProperties, type TSchema } from "typebox";
import { Check, Errors } from "typebox/value";

export const CONTRACT_API_VERSION = "technoledge.co/v1alpha1" as const;

export const IdSchema = Type.String({ minLength: 1, $id: "Id" });
export type Id = Static<typeof IdSchema>;

export const TimestampSchema = Type.Integer({ minimum: 0, $id: "Timestamp" });
export type Timestamp = Static<typeof TimestampSchema>;

export function strictObject<const Properties extends TProperties>(properties: Properties) {
	return Type.Object(properties, { additionalProperties: false });
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
const JsonValueRecursiveSchema = Type.Cyclic(
	{
		JsonValue: Type.Union([
			Type.Null(),
			Type.Boolean(),
			Type.Number(),
			Type.String(),
			Type.Array(Type.Ref("JsonValue")),
			Type.Record(Type.String(), Type.Ref("JsonValue")),
		]),
	},
	"JsonValue",
);
export const JsonValueSchema = Object.assign(Type.Unsafe<JsonValue>(JsonValueRecursiveSchema), {
	title: "JsonValue" as const,
});

export const ActorRefSchema = strictObject({
	kind: Type.Union([Type.Literal("position"), Type.Literal("agent")]),
	id: IdSchema,
});
export type ActorRef = Static<typeof ActorRefSchema>;

export const EntityKindSchema = Type.Union([
	Type.Literal("organization"),
	Type.Literal("department"),
	Type.Literal("position"),
	Type.Literal("agent"),
	Type.Literal("project"),
	Type.Literal("task"),
	Type.Literal("message"),
	Type.Literal("artifact"),
	Type.Literal("approval"),
	Type.Literal("tool-invocation"),
	Type.Literal("cost-record"),
	Type.Literal("audit-event"),
]);
export type EntityKind = Static<typeof EntityKindSchema>;

export const EntityRefSchema = strictObject({
	kind: EntityKindSchema,
	id: IdSchema,
});
export type EntityRef = Static<typeof EntityRefSchema>;

export const TokenUsageSchema = Type.Object(
	{
		input: Type.Integer({ minimum: 0 }),
		output: Type.Integer({ minimum: 0 }),
		cacheRead: Type.Integer({ minimum: 0 }),
		cacheWrite: Type.Integer({ minimum: 0 }),
		reasoning: Type.Optional(Type.Integer({ minimum: 0 })),
		totalTokens: Type.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false, $id: "TokenUsage" },
);
export type TokenUsage = Static<typeof TokenUsageSchema>;

export interface ContractIssue {
	path: string;
	message: string;
	keyword: string;
}

export class ContractValidationError extends Error {
	readonly contractName: string;
	readonly issues: readonly ContractIssue[];

	constructor(contractName: string, issues: readonly ContractIssue[]) {
		const summary = issues
			.slice(0, 3)
			.map((issue) => `${issue.path}: ${issue.message}`)
			.join("; ");
		super(`${contractName} contract validation failed${summary ? `: ${summary}` : ""}`);
		this.name = "ContractValidationError";
		this.contractName = contractName;
		this.issues = issues;
	}
}

function contractName(schema: TSchema): string {
	const namedSchema = schema as TSchema & { $id?: unknown; title?: unknown };
	if (typeof namedSchema.$id === "string" && namedSchema.$id.length > 0) return namedSchema.$id;
	return typeof namedSchema.title === "string" && namedSchema.title.length > 0 ? namedSchema.title : "Contract";
}

function isJsonCompatible(value: unknown, ancestors = new Set<object>()): boolean {
	if (value === null || typeof value === "boolean" || typeof value === "string") return true;
	if (typeof value === "number") return Number.isFinite(value);
	if (typeof value !== "object" || ancestors.has(value)) return false;

	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
	if (Reflect.ownKeys(value).some((key) => typeof key !== "string")) return false;

	ancestors.add(value);
	try {
		return Array.isArray(value)
			? value.every((item) => isJsonCompatible(item, ancestors))
			: Object.values(value).every((item) => isJsonCompatible(item, ancestors));
	} finally {
		ancestors.delete(value);
	}
}

export function parseContract<const Schema extends TSchema>(schema: Schema, value: unknown): Static<Schema> {
	const name = contractName(schema);
	if (!isJsonCompatible(value)) {
		throw new ContractValidationError(name, [
			{ path: "$", message: "must be a finite, acyclic JSON value without undefined fields", keyword: "json" },
		]);
	}
	if (!Check(schema, value)) {
		const issues = Errors(schema, value).map((error) => ({
			path: error.instancePath || "$",
			message: error.message,
			keyword: error.keyword,
		}));
		throw new ContractValidationError(name, issues);
	}
	return value as Static<Schema>;
}
