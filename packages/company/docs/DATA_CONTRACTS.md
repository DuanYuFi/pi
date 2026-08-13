# Technoledge Co. 核心数据契约

## 1. 文档状态

- API 版本：`technoledge.co/v1alpha1`
- 状态：已定义
- 适用范围：公司组织配置、业务协作记录、Tool 调用记录、Token 成本和审计事件
- 唯一类型来源：`src/contracts/` 中的 TypeBox Schema

本阶段只定义数据形状和组织内部的静态引用约束。数据库表、跨记录引用完整性、权限、通信拓扑、预算、工作流、Agent 生命周期和模型配置由后续控制层实现。

## 2. 通用约定

- 所有对象必须是有限、无环、可 JSON 序列化的数据，不允许 `undefined`、`Date`、`BigInt` 或自定义类实例。
- 对象拒绝未声明字段，不执行字符串到数字等隐式类型转换。
- ID 是非空、不透明字符串；调用方不得依赖 ID 前缀推断对象类型。
- 时间戳是大于或等于 0 的 Unix 毫秒整数。
- 可选字段不存在时应省略。只有 `Position.staffing.max` 使用 `null` 明确表示人数无上限。
- `roleRef`、`roleRefs` 和 `requiredRoleCoverage` 只检查为非空字符串；Role 目录尚未定义。

### 2.1 ActorRef

`ActorRef` 表示业务记录的参与者：

```json
{ "kind": "position", "id": "executive.general-manager" }
```

```json
{ "kind": "agent", "id": "agent-chief-secretary-1" }
```

CEO 通过 `executive.general-manager` 岗位端点与公司交互，大秘书是对人的组织窗口。数据契约只记录参与者，不决定谁可以联系谁；通信限制由后续权限层执行。

### 2.2 EntityRef

`EntityRef` 用 `{ kind, id }` 指向一个公司对象，供审批和审计使用。`kind` 可以是 organization、department、position、agent、project、task、message、artifact、approval、tool-invocation、cost-record 或 audit-event。

## 3. 组织契约

`Organization` 保留现有 YAML 的 `apiVersion`、`kind`、`metadata` 和 `spec` 结构，内嵌 `Department` 与 `Position`。

除字段类型外，解析时还检查：

- Department ID 和 Position ID 分别唯一。
- `departmentRef`、`reportsTo` 和 `workAssignedBy` 指向已有对象。
- 岗位不能向自己汇报或给自己分配工作，汇报图中不能出现环。
- 有限的 `staffing.max` 不得小于 `staffing.min`。

`ReportingRelationship` 是从 Position 的 `reportsTo` 派生的只读视图，不作为第二份组织真相保存。

## 4. 运行记录

### 4.1 协作对象

| 对象 | 用途 | 状态 |
|---|---|---|
| `Agent` | 将具体 Agent 实例关联到 Position 和 Role 引用 | 本阶段不定义生命周期 |
| `Project` | 记录目标、负责人、创建者和更新时间 | planned、active、blocked、completed、cancelled |
| `Task` | 记录项目内或独立工作、负责人、部门、优先级和验收条件 | queued、running、blocked、completed、failed、cancelled |
| `Message` | 记录公司级业务消息及其 Project、Task、Artifact 上下文 | 不复制模型 transcript，也不记录投递状态 |
| `Artifact` | 用 URI 指向代码、报告或其他交付物 | Artifact 内容由后续存储层管理 |

Task 的 completed、failed 和 cancelled 终态必须提供 `completedAt`；failed 还必须提供 `error`，cancelled 必须提供 `reason`。

### 4.2 治理与可观测对象

| 对象 | 用途 | 状态或结果 |
|---|---|---|
| `Approval` | 记录请求者、审批者、被审批对象和决定 | pending、approved、rejected、cancelled |
| `ToolInvocation` | 记录 Agent 发起的 Tool 输入、执行时间和结果 | requested、running、succeeded、failed、cancelled |
| `CostRecord` | 按 Agent、Provider、Model 及工作上下文记录 Token | input、output、cacheRead、cacheWrite、可选 reasoning、totalTokens |
| `AuditEvent` | 记录谁对哪个对象执行了什么动作 | succeeded、failed、denied |

Approval 的非 pending 状态必须包含决定时间；rejected 和 cancelled 还必须包含原因。ToolInvocation 的终态必须包含结束时间，failed 和 cancelled 分别必须包含错误或取消原因。

AuditEvent 是只追加记录。更新或删除策略属于后续持久化层，不由 TypeScript 对象本身强制执行。

## 5. 公共接口

包入口导出：

- 每种对象的 `*Schema` 和由 Schema 推导的同名 TypeScript 类型。
- `ActorRef`、`EntityRef`、`JsonValue`、`TokenUsage` 等公共值对象。
- `parseContract(schema, value)`：执行严格的通用运行时校验。
- `parseOrganization(value)` 与 `parseOrganizationYaml(text)`：执行结构及组织语义校验。
- `deriveReportingRelationships(organization)`：生成只读汇报关系。
- `ContractValidationError`：提供契约名称和不包含输入值的结构化问题列表。

运行时记录之间的引用是否真实存在，需要等控制层拥有统一状态存储后校验。本契约层不会假设数据库或直接读取系统状态。
