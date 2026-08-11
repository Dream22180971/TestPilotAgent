# TestPilotAgent

> 把需求文档变成测试用例的 AI 工作台——上传需求，自动生成测试策略、测试点、测试用例与测试脚本。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=flat&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)

---

## 目录

- [它是什么](#它是什么)
- [为什么做](#为什么做)
- [功能清单（已实现）](#功能清单已实现)
- [功能清单（规划中）](#功能清单规划中)
- [核心生成资产说明](#核心生成资产说明)
- [快速开始](#快速开始)
- [使用示例](#使用示例)
- [技术架构](#技术架构)
- [Roadmap 总览](#roadmap-总览)
- [FAQ](#faq)
- [谁适合看这个](#谁适合看这个)
- [关于我](#关于我)

---

## 它是什么

TestPilotAgent 是一个**测试设计工作台**，帮你把需求文档变成结构化的测试资产。

**你可以用它来：**

- 上传需求文档（TXT / PDF / DOCX），AI 自动分析
- 生成测试策略、测试计划、测试点、测试用例、测试脚本
- 用自然语言追问和调整生成结果
- 导出 Excel / JSON / Markdown
- 在线查看和管理历史生成记录

当前版本处于**产品原型验证阶段**：主流程已跑通，适合学习、演示与真实试用反馈。

---

## 为什么做

测试工程师写测试用例是最耗时的环节之一。一份需求文档拿到手，要花几个小时拆解测试点、写用例、设计测试脚本。

TestPilotAgent 的思路：**让 AI 替你做重复性的分析工作**。你只需要上传或输入需求，AI 帮你拆解成测试策略、测试点、测试用例；你负责审查、追问和微调。

从测试工程视角出发：质量判断发生在写代码之前，AI 用来加速「可验证的测试设计」，而不是替代人的判断。

---

## 功能清单（已实现）

> 以下能力以当前代码实现为准（后端 FastAPI + 前端 Next.js 工作台）。

### 1. 项目与配置管理

| 功能 | 说明 | 状态 |
|------|------|------|
| 创建项目 | 填写项目名称、系统类型、测试类型、脚本语言、输出语言 | ✅ |
| 项目列表 | 查看所有历史项目 | ✅ |
| 项目详情 | 按 ID 获取项目配置 | ✅ |
| 项目配置项 | `name` / `system_type` / `test_types[]` / `script_language` / `output_language`（默认中文） | ✅ |
| 记录最后生成模块 | `last_generated_module` 字段 | ✅ |

### 2. 需求输入

| 功能 | 说明 | 状态 |
|------|------|------|
| 文本输入需求 | 直接在输入框写需求描述 | ✅ |
| 上传需求文档 | 支持 **TXT / PDF / DOCX** | ✅ |
| 文件大小限制 | 最大 **10MB** | ✅ |
| 文档解析 | PDF（pdfplumber）、DOCX（python-docx）、TXT | ✅ |
| 文档列表 / 详情 | 查看提取文本、预览、页数 | ✅ |
| 删除文档 | 删除已上传文档 | ✅ |
| 多文档合并上下文 | 生成时将相关文档文本一并送入 LLM | ✅ |

### 3. 需求分析（Analysis）

上传或输入需求后，可先生成结构化分析，字段包括：

| 字段 | 含义 |
|------|------|
| `business_goal` | 业务目标 |
| `system_type` | 系统类型 |
| `roles` | 用户角色 |
| `modules` | 功能模块（name + description） |
| `core_flows` | 核心业务流程 |
| `business_rules` | 业务规则 |
| `constraints` | 约束条件 |
| `risks` | 风险点 |
| `unknowns` | 待澄清问题 |
| `test_focus` | 测试关注点 |

| 功能 | 说明 | 状态 |
|------|------|------|
| LLM 需求分析 | 调用 DashScope Qwen 生成结构化分析 | ✅ |
| 规则引擎兜底 | 无 API Key 时用规则生成基础分析 | ✅ |
| 分析结果持久化 | 存入数据库，后续生成可复用 | ✅ |

### 4. 测试资产生成

支持按目标单独生成，或一键生成全部（`target=all`）。

| 目标 | 说明 | 状态 |
|------|------|------|
| `analysis` | 需求分析 | ✅ |
| `test_strategy` | 测试策略 | ✅ |
| `test_plan` | 测试计划 | ✅ |
| `test_points` | 测试点 | ✅ |
| `test_cases` | 测试用例（依赖测试点，可自动先生成） | ✅ |
| `test_script` | 测试脚本 | ✅ |
| 一键全量生成 | `target=all` 依次生成全部资产 | ✅ |
| 重新生成 | 支持 `regenerate` | ✅ |
| LLM 优先 + 规则兜底 | 有 Key 用大模型；无 Key 时测试点/用例有规则引擎 | ✅ |
| 输出持久化 | 每个 target 按项目唯一存储，可覆盖更新 | ✅ |
| 输出结构 Schema | Pydantic 定义策略/计划/点/用例/脚本结构 | ✅ |

### 5. 追问与调整（Follow-up）

| 功能 | 说明 | 状态 |
|------|------|------|
| 自然语言追问 | 对已有输出发指令（如「补充密码错误 5 次锁定场景」） | ✅ |
| 定向修改指定模块 | 指定 target 后局部重生成 | ✅ |
| 结合文档上下文 | 追问时仍会带上已上传文档内容 | ✅ |
| 无 LLM 时回退 | 返回原内容并提示 LLM 不可用 | ✅ |

### 6. 导出

| 格式 | 说明 | 状态 |
|------|------|------|
| Excel (`.xlsx`) | 多 Sheet；测试点/用例按表格写出 | ✅ |
| JSON | 结构化原始数据下载 | ✅ |
| Markdown | 可读文档格式下载 | ✅ |
| 可选导出目标 | 可指定导出哪些 target | ✅ |
| 前端一键下载 | 浏览器自动触发下载 | ✅ |

### 7. 工作台与历史

| 功能 | 说明 | 状态 |
|------|------|------|
| 工作台 `/workspace` | 项目配置、需求输入、生成、结果展示 | ✅ |
| 历史页 `/history` | 查看历史生成记录 | ✅ |
| 结果在线查看 | 各模块输出在线展示 | ✅ |
| 文档管理 UI | 上传、列表、删除 | ✅ |
| 导出按钮 | 触发 Excel / JSON / MD 下载 | ✅ |

### 8. 基础设施

| 能力 | 说明 | 状态 |
|------|------|------|
| 后端 | FastAPI + SQLAlchemy | ✅ |
| 前端 | Next.js + TypeScript | ✅ |
| 数据库 | SQLite / PostgreSQL 可切换 | ✅ |
| LLM | DashScope Qwen（JSON 结构化输出） | ✅ |
| 健康检查 | `GET /health` | ✅ |
| CI | GitHub Actions 基础 CI | ✅ |

---

## 功能清单（规划中）

> 用于产品深耕与迭代优先级参考，按主题分组。

### A. 生成质量与可控性（优先）

| 功能 | 说明 | 优先级建议 |
|------|------|------------|
| 完整结构化输出强校验 | 生成结果严格按 Pydantic schema 校验，失败自动重试/修复 | P0 |
| 局部重生成体验增强 | 仅重生成某一条用例/某一个模块字段，而非整份覆盖 | P0 |
| 用例质量评分 / 提示 | 基于覆盖、边界、可执行性等给出质量提示（结合测试工程经验） | P0 |
| 多轮对话上下文 | 完整会话记忆，支持连续追问而不丢上下文 | P1 |
| 人工审核工作流 | 标记「通过 / 需修改 / 驳回」，记录审核意见 | P1 |
| 提示词与模板可配置 | 按系统类型/行业切换策略与用例模板 | P1 |

### B. 输入与解析增强

| 功能 | 说明 | 优先级建议 |
|------|------|------------|
| 图片 / 扫描件 OCR | 支持截图、扫描 PDF 等含图文档 | P1 |
| 多模态文档理解 | Qwen-VL 等处理带图需求文档 | P2 |
| 需求版本管理 | 同一需求多次修订，可对比与回溯 | P1 |
| 需求澄清问答 | 针对 `unknowns` 发起结构化澄清问题 | P1 |
| 更多文档格式 | Markdown、Confluence 导出、飞书/语雀链接等 | P2 |

### C. 导出与对接

| 功能 | 说明 | 优先级建议 |
|------|------|------------|
| 用例导出为标准 Excel 模板 | 对齐常见用例管理系统字段 | P0 |
| 对接测试管理工具 | 导出/同步到 TestRail、禅道、Jira Xray 等 | P1 |
| 脚本与框架脚手架 | 一键生成可运行的 pytest / Playwright 项目骨架 | P1 |
| 批量导出与打包 | 按项目打包全部资产为 zip | P2 |

### D. 项目与协作

| 功能 | 说明 | 优先级建议 |
|------|------|------------|
| 项目编辑 / 删除 | 完善项目管理 CRUD | P0 |
| 用户体系与登录 | 账号、鉴权、个人数据隔离 | P0 |
| 团队与权限 | 角色（测试/开发/产品）、项目成员 | P1 |
| 评论与审批 | 对策略/用例进行评论、@、审批流 | P1 |
| 资产追溯 | 需求 → 分析 → 点 → 用例 → 脚本 链路可追溯 | P1 |

### E. 模型与平台

| 功能 | 说明 | 优先级建议 |
|------|------|------------|
| 多模型支持 | DeepSeek / 通义 / 其他 OpenAI 兼容模型可切换 | P1 |
| 成本与用量统计 | Token、调用次数、按项目统计 | P2 |
| 规则引擎增强 | 无 LLM 时更完整的策略/计划/脚本降级能力 | P2 |
| 生产级安全与错误处理 | 权限、限流、审计日志、更稳健的异常处理 | P0（上线前） |

### F. 产品化与体验

| 功能 | 说明 | 优先级建议 |
|------|------|------------|
| 在线演示环境 / 部署文档 | 一键部署或公开 Demo | P1 |
| 行业模板 | 电商、医疗、教育等预置测试策略与用例模板 | P1 |
| 个人免费版 + 团队专业版 | 计费与功能分层 | P2 |
| 与知识库/教程打通 | 与个人站测试方法论、教程形成「工具 + 方法」闭环 | P2 |

---

## 核心生成资产说明

### 测试策略（test_strategy）

- overview：策略概览
- scope / out_of_scope：测试范围与非范围
- test_levels：测试级别（单元 / 集成 / 系统 / 验收等）
- test_types：测试类型（功能 / UI / API / 性能 / 安全等）
- tools_and_env：工具与环境建议
- risks_and_mitigation：风险与缓解措施
- entry_criteria / exit_criteria：进入 / 退出准则

### 测试计划（test_plan）

- overview：计划概览
- phases：阶段列表（name / tasks / estimated_days / deliverables）
- resource_estimate：资源估算
- schedule_summary：进度摘要
- dependencies：依赖项

### 测试点（test_points）

每条包含：`id` / `module` / `scenario` / `point` / `type` / `priority`

### 测试用例（test_cases）

每条包含：`id` / `module` / `scenario` / `title` / `preconditions` / `steps` / `expected_results` / `priority`

### 测试脚本（test_script）

- language / framework
- files：`filename` / `language` / `code`
- setup_instructions：运行说明

---

## 快速开始

### 前置条件

- Node.js 18+
- Python 3.10+
- 阿里云 DashScope API Key（可选；没有也能用规则引擎）

### 启动

```bash
# 1. 启动后端
cd testpilot-api
pip install -r requirements.txt
.\start-api.ps1    # Windows PowerShell

# 2. 启动前端（另一个终端）
cd testpilot-web
npm install
.\start-web.ps1    # Windows PowerShell
```

启动后访问：

- 前端工作台：`http://127.0.0.1:3000/workspace`
- 后端接口文档：`http://127.0.0.1:8000/docs`

### 配置 AI 模型（可选）

在 `testpilot-api` 目录下创建 `.env` 文件：

```bash
DASHSCOPE_API_KEY="sk-你的Key"
```

不配置也能用——系统会自动回退到规则引擎生成基础结果。

---

## 使用示例

### 场景：测试登录功能

1. 打开工作台，创建或选择项目
2. 上传一份包含登录需求的文档（或直接在文本框输入需求描述）
3. 点击生成（可单模块或全量）
4. AI 输出：需求分析 → 测试策略 → 测试计划 → 测试点 → 测试用例 → 测试脚本
5. 对结果不满意？在追问框输入：`补充一下密码错误 5 次锁定的场景`
6. AI 针对指定模块重新生成
7. 导出 Excel / JSON / Markdown 保存或交给团队

---

## 技术架构

```
┌──────────────────────────────────┐
│     Frontend (Next.js)           │
│  App Router · TypeScript         │
│  Workspace + History + Chat      │
├──────────────────────────────────┤
│     Backend (FastAPI)            │
│  SQLAlchemy · Document Parser    │
│  Generation Routes · LLM Client  │
├──────────────────────────────────┤
│     AI Layer                     │
│  DashScope Qwen (JSON 输出)      │
│  规则引擎 (无 API Key 时兜底)     │
├──────────────────────────────────┤
│     Database                     │
│  SQLite / PostgreSQL             │
└──────────────────────────────────┘
```

主要 API 前缀：`/api/projects`

| 模块 | 能力 |
|------|------|
| projects | 创建 / 列表 / 详情 |
| documents | 上传 / 列表 / 详情 / 删除 |
| requirements | 保存需求 |
| analysis | 需求分析 |
| generation | 按 target 或 all 生成 |
| followup | 自然语言追问修改 |
| exports | Excel / JSON / Markdown 导出 |

---

## Roadmap 总览

### 已完成

- [x] PostgreSQL 替换内存存储（支持 SQLite / PostgreSQL）
- [x] 文档上传与解析（TXT / PDF / DOCX）
- [x] 大模型集成（DashScope Qwen）
- [x] 测试策略 / 计划 / 测试点 / 用例 / 脚本生成
- [x] 自然语言追问与局部重生成（基础版）
- [x] 导出 Excel / JSON / Markdown
- [x] 工作台与历史页

### 进行中 / 近期

- [ ] 完整结构化输出（Pydantic schema 强校验 + 失败修复）
- [ ] 追问、局部重生成体验增强
- [ ] 用例质量提示 / 评分
- [ ] 项目编辑与删除、用户鉴权
- [ ] 测试用例导出为更标准的 Excel 模板

### 中期

- [ ] 多模型支持
- [ ] 多模态文档（含图）
- [ ] 需求版本与资产追溯
- [ ] 团队协作与审批
- [ ] 与测试管理工具对接

### 长期

- [ ] 行业模板与方法论闭环
- [ ] 个人 / 团队产品分层
- [ ] 生产级安全、审计与可观测性

---

## FAQ

**Q: 没有 API Key 能用吗？**  
A: 能用。系统会自动回退到规则引擎，生成基础的测试分析结果。智能程度不如大模型。

**Q: 支持哪些文档格式？**  
A: 目前支持 TXT、PDF、DOCX。上传后自动提取文本。图片/扫描件 OCR 在规划中。

**Q: 前端连不上后端怎么办？**  
A: 检查三件事：后端是否启动（8000 端口）、前端是否启动（3000 端口）、前端环境变量中的后端地址是否为 `http://127.0.0.1:8000`。

**Q: 这个能用于生产环境吗？**  
A: 当前版本是产品原型验证阶段，适合学习和演示。生产使用需要完善错误处理、权限控制和数据校验（见「功能清单（规划中）」）。

---

## 谁适合看这个

- **测试工程师**：了解 AI 如何辅助测试设计，学习自动化测试新思路
- **想学 AI 应用开发的人**：FastAPI + Next.js + LLM 集成的完整案例
- **正在做毕设的学生**：AI + 测试方向的参考项目
- **产品经理**：了解 AI 工作台类产品的产品设计思路

---

## 关于我

我是**肖恩沃尔特**（Sean Walter），一个从测试工程师正在转型为 AI 独立开发者的程序员。

TestPilotAgent 是我把「AI + 测试」想法落地的核心项目。从测试工程师的视角出发，我知道写测试用例有多耗时——所以想让 AI 帮测试同学把「需求理解 + 风险判断 + 测试设计」做得更快、更可追溯。

- GitHub: [Dream22180971](https://github.com/Dream22180971)
- Twitter/X: [@sean_walter0717](https://x.com/sean_walter0717)
- 博客: [seanwalter.top](https://seanwalter.top)

---

## License

[MIT](./LICENSE)
