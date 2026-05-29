# LLED Essay Feedback —— 迁入 HelpMe 集成说明

> 本文件是给 **helpme 仓库里的 Cursor Agent** 看的「任务书」。  
> 你不需要把本 MVP 仓库的文件原样搬过去，而是要按 helpme 的工程约定（NestJS 风格的 `@koh/server` + Next.js `@koh/frontend`），把本 MVP 提供的"作文结构化反馈"能力作为 **新功能** 加入 helpme。

---

## 0. 给 Agent 的执行须知（先读这一节）

1. **不要直接复制 `src/backend/server.ts` 到 helpme。** helpme 用 NestJS 控制器/服务/仓储分层，请按该分层重写。
2. **不要复制 MVP 的纯 HTML/CSS 前端。** helpme 用 Next.js + React + Antd/Tailwind，请用 React 组件重写界面，并复用现有 hooks/UI 风格。
3. **保留并复用** 这两块"硬资产"——它们是这次迁移的核心价值，**不要重写**：
   - **Prompt**：`src/backend/lib/prompts/prompt.md`（学术写作矩阵 + 严格 JSON 输出契约）
   - **响应 Schema**：`src/shared/schema.ts` + `src/backend/lib/openaiClient.ts` 中的 `feedbackJsonSchema` + `src/backend/lib/schemaValidator.ts` 中的 Zod 校验
4. 若 helpme 已有"AI 调用 / OpenAI client / 课程材料引用"基础设施，**优先复用**，不要新建一份。
5. 任何无法在 helpme 当前结构下做出决定的地方，**列入 PR 描述的"待确认"**，不要擅自硬编码。
6. 严格遵守 helpme 仓库已有的 `.cursor/rules/`（如 `backend-rule.mdc` / `frontend-rule.mdc`）：分层、类型安全、权限校验、迁移走 migration、提交前过 lint/typecheck。

---

## 1. 业务背景（一句话）

LLED 200（UBC 学术写作课）的学生上传 Descriptive Report（`.txt/.md/.doc/.docx/.pdf`，≤10MB），系统调用 LLM 按"学术写作矩阵"（Content/Interpersonal/Organization × Text/Section/Clause-Word）返回**结构化批注 + 整体反馈**，前端在原文上做高亮、按维度/层级筛选、在右侧展示卡片。**不打分，不重写学生句子，只做诊断 + 修改方向。**

---

## 2. 功能范围

### 必做（MUST）
- 教师在课程下"创建作文反馈作业"，配置：标题、说明、是否允许重复提交（先做"允许"）。
- 学生在课程页面看到该作业，能上传文件或粘贴文本，触发一次反馈生成。
- 服务端：抽取文本 → 切段 → 调用 LLM（结构化输出）→ 校验/规范化 → 落库 → 返回。
- 前端"批注阅读视图"：原文左侧带高亮和 pin、右侧侧栏展示卡片（按 function/level 过滤、Annotations / Summary 切换）。
- 学生可重新查看之前的提交结果。

### 可做（SHOULD）
- 教师查看本课程下所有学生的提交与反馈结果。
- 同一份提交支持多次"重新生成"（保留历史 N 次，方便对比）。

### 不做（OUT OF SCOPE，本次迁移先不上）
- 自动评分。
- 学生与 AI 多轮对话/追问。
- 教师在 AI 反馈上做手批（评论/覆盖）——可作为后续迭代。
- 直接对 PDF 文件做坐标级标注（MVP 是基于纯文本字符 offset 的）。

---

## 3. 本 MVP 仓库地图（你需要参考这些文件）

```
LLED_bot_MVP/
├─ src/
│  ├─ backend/
│  │  ├─ server.ts                        # Express 入口，2 个路由
│  │  ├─ lib/
│  │  │  ├─ fileExtractor.ts              # 文件 → 纯文本（mammoth / pdf-parse / word-extractor）
│  │  │  ├─ essayParser.ts                # 文本 → Paragraph[]（按空行切段，id = p1, p2…）
│  │  │  ├─ promptBuilder.ts              # 加载 prompt.md + 拼接段落
│  │  │  ├─ openaiClient.ts               # OpenAI chat.completions + json_schema 强约束
│  │  │  ├─ schemaValidator.ts            # Zod 校验 + 段落归一化 + 越界标注剔除
│  │  │  └─ prompts/prompt.md             # 系统 Prompt，**核心资产，原样使用**
│  │  └─ types/
│  ├─ shared/
│  │  ├─ schema.ts                        # FeedbackResponse 等核心 DTO，**核心资产**
│  │  └─ constants.ts                     # 维度/层级/严重度的展示标签
│  └─ frontend/                           # 纯 TS/HTML/CSS，仅供 React 重写时参考交互
│     ├─ index.html
│     ├─ app.ts                           # 状态机 + 事件绑定
│     ├─ api.ts                           # fetch 两个后端接口
│     ├─ styles.css                       # 视觉参考
│     └─ lib/
│        ├─ essayRenderer.ts              # 把 paragraphs + annotations 渲染成带 <span class="hl">…</span> 的 HTML
│        ├─ sidebarRenderer.ts            # 卡片 + Summary 渲染
│        └─ interactions.ts               # 过滤/激活态/Tab 切换的纯函数
├─ mock/sampleFeedback.json               # 示例响应，可用于前端 mock & 联调
├─ tsconfig.json / tsconfig.frontend.json
└─ package.json                           # 依赖清单：express, multer, openai, zod, mammoth, pdf-parse, word-extractor
```

---

## 4. 对外契约（迁移时**必须保留语义**）

> 即使在 helpme 里换路由前缀，下面的 **DTO 字段名、字段语义、枚举值** 都必须保持一致——前端渲染/Prompt 都依赖它们。

### 4.1 HTTP 接口（MVP 现状，仅供参考）

| 方法 | 路径 | 入参 | 出参 |
|---|---|---|---|
| POST | `/api/extract-text` | `multipart/form-data`，字段 `file` | `{ essay_text: string, filename: string }` |
| POST | `/api/essay-feedback` | `application/json`，`{ essay_text: string }` | `FeedbackResponse`（见 4.2） |

迁到 helpme 后建议（**待 helpme 侧确认**）：
- `POST /api/v1/courses/:courseId/essay-feedback/extract-text`
- `POST /api/v1/courses/:courseId/essay-feedback/submissions`（创建提交并触发生成）
- `GET  /api/v1/courses/:courseId/essay-feedback/submissions/:id`
- `GET  /api/v1/courses/:courseId/essay-feedback/submissions?studentId=…`（教师视角）

### 4.2 核心 DTO（**字段名/枚举值不允许改**）

```ts
type FunctionDimension = "content" | "interpersonal" | "organization";
type LinguisticLevel   = "text" | "section" | "clause_word";
type Severity          = "low" | "medium" | "high";

interface Paragraph {
  id: string;     // "p1", "p2", ... 小写
  text: string;
}

interface Citation {
  type: "rubric" | "course_material";
  label: string;
  url: string | null;
}

interface Evidence {
  quote: string;  // 必须是段落原文的精确子串
  reason: string;
}

interface Annotation {
  id: number;                  // 在一次响应里唯一，从 1 开始
  paragraph_id: string;        // 对应 Paragraph.id
  char_start: number;          // 段落内字符 offset
  char_end: number;            // > char_start 且 ≤ paragraph.text.length
  function: FunctionDimension;
  level: LinguisticLevel;
  issue_type: string;
  severity: Severity;
  evidence: Evidence;
  feedback: string;            // 解释问题，不重写句子
  revision_guidance: string;   // 给方向，不给改写
  citations: Citation[];
}

interface OverallFeedback {
  summary: string;
  priority_issues: string[];
  next_steps: string[];
  reflection_questions: string[];   // 2–4 条
}

interface FeedbackResponse {
  submission_id: string | null;     // 由 helpme 业务层填充（MVP 是 null）
  created_at: string | null;        // 由 helpme 业务层填充（MVP 是 null）
  essay: { paragraphs: Paragraph[] };
  annotations: Annotation[];
  overall_feedback: OverallFeedback;
}
```

> `submission_id` / `created_at` 在 LLM 输出里固定为 `null`，由 **业务层** 在落库后回填。

### 4.3 Prompt 与 LLM 契约

- Prompt 位置：`src/backend/lib/prompts/prompt.md`，**原样作为 system message**。
- 调用方式：`chat.completions.create` + `response_format = { type: "json_schema", json_schema: { name: "feedback", strict: true, schema: <见 openaiClient.ts> } }`。
- 用户 message：`"P1: …\nP2: …\nP3: …"` 这样的拼接字符串（见 `essayParser.formatParagraphsForPrompt`）。
- 失败重试：MVP 是简单 try / catch 重试一次，迁移时建议改为带退避的 1 次重试，并记录 Prompt token 用量。

### 4.4 后处理规则（**别忘了搬这些**）

`schemaValidator.ts` 里做了两件不能省的事，迁移后仍要做：

1. `paragraph_id` 统一转成小写。
2. **剔除越界 / 找不到段落 / `char_end <= char_start`** 的 annotation——LLM 偶尔会算错 offset，这步是兜底，前端依赖它。

---

## 5. helpme 侧落点建议

下面是基于 helpme 已知 `.cursor/rules/` 的推荐结构。具体路径以仓库现状为准；若已有同名模块/约定，请以仓库现状优先。

### 5.1 后端（`packages/server`）

建议新增模块（命名仅供参考，按 helpme 现有命名风格调整）：

```
packages/server/src/essay-feedback/
├─ essay-feedback.module.ts
├─ essay-feedback.controller.ts        # 路由 + DTO 校验，编排 service
├─ essay-feedback.service.ts           # 业务编排：抽文本 → 切段 → 调 LLM → 校验 → 落库
├─ essay-feedback.entity.ts            # TypeORM 实体（见 6 节数据模型）
├─ essay-feedback.repository.ts        # 数据访问
├─ dto/
│  ├─ create-submission.dto.ts
│  ├─ feedback-response.dto.ts         # 等价于本 MVP 的 FeedbackResponse
│  └─ extract-text.dto.ts
├─ lib/
│  ├─ file-extractor.ts                # 等价于 src/backend/lib/fileExtractor.ts
│  ├─ essay-parser.ts                  # 等价于 src/backend/lib/essayParser.ts
│  ├─ prompt-builder.ts                # 加载 prompt.md
│  ├─ openai-feedback.client.ts        # 等价于 openaiClient.ts；优先复用 helpme 已有 OpenAI service
│  └─ feedback-validator.ts            # 等价于 schemaValidator.ts
└─ prompts/
   └─ prompt.md                        # 原样从 MVP 拷过来
```

要点：
- **控制器**只做参数校验、鉴权、调 service（遵循 helpme backend-rule）。
- **OpenAI 客户端**：如果 helpme 已经有统一的 LLM gateway，请改成调它，不要再读一遍 `process.env.OPENAI_API_KEY`。
- **配置项**通过 helpme 的 ConfigService 读取，**不要**像 MVP 那样直接 `process.env.X`。
- **multer 限制**：保留 10MB 上限和 memoryStorage，但要走 helpme 已有的上传中间件/守卫（病毒扫描、文件类型白名单等）如果有的话。

### 5.2 前端（`packages/frontend`）

建议新增页面与组件（路径以 helpme `app/` 路由现状为准）：

```
packages/frontend/app/course/[cid]/essay-feedback/
├─ page.tsx                              # 学生入口：上传 / 历史提交列表
├─ [submissionId]/page.tsx               # 阅读视图（左原文 + 右反馈）
└─ components/
   ├─ EssayUploader.tsx                  # 拖拽 + 文件选择 + Sample（参考 src/frontend/app.ts 的 setupDropzone）
   ├─ EssayReader.tsx                    # 高亮原文（参考 essayRenderer.ts）
   ├─ AnnotationCard.tsx                 # 单条卡片（参考 sidebarRenderer.renderSidebarCards）
   ├─ FeedbackSidebar.tsx                # 过滤 + Tab + 卡片列表
   └─ SummaryPanel.tsx                   # 整体反馈
```

要点：
- 用 helpme 已有的 SWR 风格 hook 封装 `useEssaySubmission` / `useCreateSubmission`，**不要**直接在组件里 `fetch`。
- 三态（loading / empty / error）齐全。
- 视觉沿用 helpme 的 Antd/Tailwind 主题；MVP 里的 `styles.css` 仅供颜色与层级参考，不要原样引入。
- 高亮的核心算法（按 char offset 切段、插入 `<span>` 包裹）建议作为纯函数放在 `lib/`，并写单元测试。
- "维度/层级"过滤的状态机参考 `src/frontend/lib/interactions.ts`，可直接抽成 hook。

### 5.3 共享类型

将 `src/shared/schema.ts` 与 `src/shared/constants.ts` 的内容放入 helpme 的 `packages/common`（或同等"前后端共享类型"包），保持字段名/枚举值不变。

---

## 6. 数据模型建议（MVP 没有持久化，需要新增）

> helpme 后端规则要求：变更数据库结构必须走 migration，不允许直接改线上表。

最小一组表：

### `essay_feedback_assignment`（教师配置的"反馈作业"）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid / serial | 主键 |
| course_id | FK → courses | 所属课程 |
| title | varchar | 显示标题 |
| description | text | 学生看到的说明 |
| allow_resubmit | boolean | 是否允许重复提交（MVP 期默认 true）|
| created_by | FK → users | 教师 ID |
| created_at / updated_at | timestamp | |

### `essay_feedback_submission`（学生的一次提交）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 主键，前端会拿它当 `submission_id` |
| assignment_id | FK | |
| student_id | FK → users | |
| filename | varchar nullable | 原始文件名 |
| essay_text | text | 抽取后的纯文本（用于复算和审计） |
| status | enum | `pending` / `succeeded` / `failed` |
| error_message | text nullable | 失败原因 |
| created_at | timestamp | |

### `essay_feedback_result`（一次提交对应的反馈结果，可多次重试）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | |
| submission_id | FK | |
| feedback_json | jsonb | 完整 `FeedbackResponse`（除 `submission_id` / `created_at` 由数据库回填）|
| model | varchar | 实际使用的模型名 |
| prompt_tokens / completion_tokens | int | 计费用 |
| created_at | timestamp | |

> 是否需要把 `annotations` 拆成独立表，取决于 helpme 是否有"教师在 annotation 上加二次评论"的需求。**MVP 阶段建议先存 jsonb**，避免过早拆分。

---

## 7. 配置与环境变量

| MVP 变量 | 语义 | helpme 侧建议 |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI 鉴权 | 走 helpme 的 secrets/ConfigService，**不允许**在业务代码里直接读 `process.env` |
| `OPENAI_MODEL` | 模型名 | 同上；建议放 `essayFeedback.model` 配置项 |
| `PORT` | 服务端口 | 删除，由 helpme 主进程托管 |

**新增建议配置**：
- `essayFeedback.maxFileSizeMb`（默认 10）
- `essayFeedback.maxAnnotations`（默认 12，与 prompt 一致）
- `essayFeedback.requestTimeoutMs`
- `essayFeedback.retry.maxAttempts`

---

## 8. 鉴权与权限

- 学生提交接口：必须登录 + 必须是该 `course_id` 的学生 → 走 helpme 现有的 course-membership guard。
- 教师查看接口：必须是该课程的 instructor/TA → 走现有 role guard。
- 文件上传：沿用 helpme 现有的上传中间件（限大小、限 MIME、限频率）；**不要**新写一份。

---

## 9. 验收标准（PR 合并前必须全过）

### 自动化
- [ ] `yarn workspace @koh/server lint` 通过
- [ ] `yarn workspace @koh/frontend lint` 通过
- [ ] 后端类型检查 + 单元测试通过（覆盖：`feedback-validator` 的越界剔除、`essay-parser` 的切段、`file-extractor` 三种格式）
- [ ] migration 在干净库上 `up` / `down` 都不报错

### 手动
- [ ] 教师能在课程下创建一个 essay-feedback 作业。
- [ ] 学生上传 `.docx` 与 `.pdf` 各一篇短文，能在 30s 内拿到反馈，渲染无报错。
- [ ] 反馈页：点击卡片高亮原文中对应 span；点击高亮反向激活卡片；过滤 function/level 工作正常；Annotations / Summary Tab 切换工作正常。
- [ ] 当 LLM 返回 offset 越界时，越界的 annotation 被静默丢弃，其余正常显示（用 mock 数据触发）。
- [ ] 配置项可通过 ConfigService 覆盖，业务代码不直接读 `process.env`。
- [ ] 非课程成员访问接口返回 403。

### 联调用 mock
本 MVP 提供了 `mock/sampleFeedback.json`，结构就是 `FeedbackResponse`。前端开发期可以用它作为 SWR fallback 数据，避免每次都打 LLM。

---

## 10. 风险与待确认（请在 PR 描述里逐项回答）

1. helpme 是否已有统一 OpenAI gateway？若有，是否支持 `response_format: json_schema strict`？
2. helpme 现有的文件上传中间件是否支持 `.doc`（非 docx）？`word-extractor` 是 Node 原生依赖，需确认部署环境兼容性。
3. `pdf-parse` 在 helpme 当前 Node 版本（≥20）下能否正常工作？是否与现有 PDF 处理代码冲突？
4. 课程结构里"作业"是否已有抽象（Assignment / Activity）？是直接挂在它下面作为子类型，还是新建独立模块？
5. 学生重复提交策略：保留全部历史还是只保留最近 N 次？
6. 反馈结果是否需要导出（PDF / JSON）？MVP 不做，但若 helpme 已有导出体系可顺便对齐。
7. 多语言：MVP 的 prompt 与 UI 文案都是英文，helpme 是否需要 i18n？

---

## 11. 严禁事项（来自 helpme 既有规则与本次约束）

- 严禁把 LLM 调用直接写在 controller 里。
- 严禁把私有 entity 直接当 API 返回（必须经过 DTO）。
- 严禁绕过课程成员身份检查。
- 严禁在业务代码里硬编码模型名、API key、URL。
- 严禁直接改库表结构而不写 migration。
- 严禁未跑通 lint / typecheck / 单测就提交 PR。
- 严禁修改 4.2 节里 DTO 的字段名/枚举值（前端渲染与 prompt 都依赖它们）。

---

## 12. 推荐的 PR 拆分

为便于 review，建议拆成 3 个 PR：

1. **PR-1（共享类型 + Prompt 资产）**：把 `FeedbackResponse` 等类型与 `prompt.md` 放进 `packages/common`（或等价位置）+ 单元测试。
2. **PR-2（后端模块 + 数据库）**：`essay-feedback` 模块、migration、controller / service / repository、与 helpme OpenAI gateway 接线。
3. **PR-3（前端页面）**：教师配置 + 学生上传 + 阅读视图 + hooks，配 mock/sampleFeedback.json 做演示。

每个 PR 的描述里都列出：本 PR 涉及的本文档章节、回答了哪些"待确认"、剩余 TODO。

---

## 13. 一行总结

> 把 MVP 的 **Prompt + Schema + 越界兜底 + 高亮算法** 作为不可变契约保留下来，**其它一切都按 helpme 既有工程规范重写**。
