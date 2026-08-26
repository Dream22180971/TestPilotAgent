# TestPilotAgent

> 测试人的 AI 工作台——上传需求，自动生成测试策略、测试点和测试脚本。

> **2026-08-26 复活**：项目重启开发，定位从"能生成用例的 demo"升级为**测试人的 AI 副驾驶**。路线图见 [Roadmap](#roadmap)。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=flat&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)

---

## 目录

- [截图](#截图)
- [它是什么](#它是什么)
- [为什么做](#为什么做)
- [核心功能](#核心功能)
- [快速开始](#快速开始)
- [使用示例](#使用示例)
- [技术架构](#技术架构)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [谁适合看这个](#谁适合看这个)
- [关于我](#关于我)

---

## 截图

> TUI 工作台（Textual · GitHub Dark）：`tpa` 一键进入，三栏布局 = 需求文件/历史项目 ｜ 流水线/用例/详情 ｜ 追问输入框。

*截图整理中（v0.2 TUI 版）*

---

## 它是什么

TestPilotAgent 是一个**测试设计工作台**，帮你把需求文档变成结构化的测试资产。

**你可以用它来：**
- 上传需求文档（TXT / PDF / DOCX），AI 自动分析
- 生成测试策略、测试点、测试用例、测试脚本
- 用自然语言追问和调整生成结果
- 在线查看和管理所有历史生成记录

不用再手动写测试用例了——告诉它"帮我测登录功能"，它自己去分析、生成、输出。

---

## 为什么做

测试工程师写测试用例是最耗时的环节之一。一份需求文档拿到手，要花几个小时拆解测试点、写用例、设计测试脚本。

TestPilotAgent 的思路：**让 AI 替你做重复性的分析工作**。你只需要上传需求文档，AI 帮你拆解成测试策略、测试点、测试用例，你只需要审查和微调。

当前版本是产品原型验证阶段，主流程已跑通，适合学习和演示。

---

## 核心功能

| 你能做什么 | 说明 |
|-----------|------|
| **上传需求文档** | 支持 TXT / PDF / DOCX，上传后自动提取文本并分析 |
| **AI 生成测试资产** | 基于 DashScope Qwen 模型，输出测试策略、测试点、用例、脚本 |
| **追问和调整** | 对生成结果不满意？用自然语言追问，AI 会重新生成 |
| **历史记录** | 所有生成记录在线保存，随时查看和对比 |
| **规则引擎兜底** | 没有配置 API Key 时，自动回退到规则引擎生成基础结果 |

---

## 快速开始

### 前置条件

- Python 3.10+

### 安装与启动

```bash
git clone https://github.com/Dream22180971/TestPilotAgent.git
cd TestPilotAgent
python -m venv .venv
.\.venv\Scripts\pip install -e ".[api]"    # Windows PowerShell
.\.venv\Scripts\tpa.exe                    # 进入 TUI 终端工作台
```

### CLI 无头模式（可进 CI）

```bash
tpa gen 需求文档.md            # 生成全套测试资产 → testpilot-output/（md + xlsx）
tpa gen 需求文档.pdf --name 电商V2.3
tpa history                    # 查看历史项目
tpa ask "补充验证码过期场景" -p proj_xxx   # 追问调整（需 API Key）
tpa config                     # 查看引擎/数据库配置
```

### 配置 AI 模型（可选）

在项目根目录或 `~/.testpilot/` 下创建 `.env`：

```bash
DASHSCOPE_API_KEY="sk-你的Key"   # 阿里云 DashScope
# LLM_BASE_URL / LLM_MODEL 可选覆盖
```

不配置也能用——自动回退规则引擎，生成基础骨架用例。

### TUI 快捷键

`g` 生成 ｜ `e` 导出 ｜ `/` 追问 ｜ `1/2/3` 切换页签（流水线/用例/详情）｜ `r` 刷新 ｜ `q` 退出

### 可选：启动旧 FastAPI 层

```bash
.\start-api.ps1    # http://127.0.0.1:8000/docs
```

---

## 使用示例

### 场景：测试登录功能

1. 打开工作台，输入项目名称
2. 上传一份包含登录需求的文档（或直接在文本框输入需求描述）
3. 点击「生成」
4. AI 自动输出：测试策略 → 测试点 → 测试用例 → 测试脚本
5. 对结果不满意？在对话框追问："补充一下密码错误 5 次锁定的场景"
6. AI 会重新生成包含该场景的用例

---

## 技术架构

```
┌────────────────────────────────────────────┐
│  testpilot/tui (Textual)   testpilot/cli   │
│  终端工作台                  tpa 无头命令    │
├────────────────────────────────────────────┤
│  testpilot/core                            │
│  pipeline 编排 · 规则引擎兜底               │
│  LLM 客户端(Qwen) · Pydantic schema 校验    │
│  文档解析(txt/md/pdf/docx) · 导出(md/xlsx)  │
├────────────────────────────────────────────┤
│  SQLite (~/.testpilot/)                    │
├────────────────────────────────────────────┤
│  testpilot-api (FastAPI, 可选薄桥接层)      │
└────────────────────────────────────────────┘
```

单一代码库三层出口：**TUI 日常使用 · CLI 进 CI · API 留给未来的 MCP 化（L4）**。

---

## Roadmap

> 2026-08-26 路线重定：四层递进，一层跑通再开下一层，每层都以**真实日常使用**为验收标准（dogfooding）。

### L1 · 单点跑通（当前阶段）
- [x] 文档解析入库（TXT/MD/PDF/DOCX）
- [x] 大模型集成（DashScope Qwen，OpenAI 兼容）
- [x] 完整结构化输出（Pydantic schema 校验）
- [x] 追问重生成（`tpa ask` / TUI `/`）
- [x] 导出 Markdown / Excel / JSON
- [x] **v0.2 重构：TUI 终端工作台 + CLI 无头模式**（2026-08-26）
- [ ] 多模型支持（Qwen-VL 处理含图文档）
- [ ] 作者本人每周真实使用，形成反馈闭环

### L2 · 知识沉淀
- [ ] RAG 历史用例库：生成的用例带上项目记忆，不再每次从零开始

### L3 · 多 Agent 协作
- [ ] LangGraph 编排：评审 Agent / 执行 Agent / 归档 Agent 分工协作

### L4 · 生态接入
- [ ] MCP 化：成为个人 Agent 网络的测试垂直节点，任何 Agent 都能调用"生成测试用例"能力

---

## FAQ

**Q: 没有 API Key 能用吗？**
A: 能用。系统会自动回退到规则引擎，生成基础的测试分析结果。但智能程度不如大模型。

**Q: 支持哪些文档格式？**
A: 目前支持 TXT、PDF、DOCX 三种格式。上传后自动提取文本内容。

**Q: 前端连不上后端怎么办？**
A: 检查三件事：后端是否启动（8000 端口）、前端是否启动（3000 端口）、前端环境变量中的后端地址是否为 `http://127.0.0.1:8000`。

**Q: 这个能用于生产环境吗？**
A: 当前版本是产品原型验证阶段，适合学习和演示。生产使用需要完善错误处理、权限控制和数据校验。

---

## 谁适合看这个

- **测试工程师**：了解 AI 如何辅助测试设计，学习自动化测试新思路
- **想学 AI 应用开发的人**：FastAPI + Next.js + LLM 集成的完整案例
- **正在做毕设的学生**：AI + 测试方向的参考项目
- **产品经理**：了解 AI 工作台类产品的产品设计思路

---

## 关于我

我是**肖恩沃尔特**（Sean Walter），一个从测试工程师正在转型为 AI 独立开发者的程序员。

TestPilotAgent 是我把"AI + 测试"想法落地的第一个项目。从测试工程师的视角出发，我知道写测试用例有多耗时——所以想让 AI 帮我做这件事。

- GitHub: [Dream22180971](https://github.com/Dream22180971)
- Twitter/X: [@sean_walter0717](https://x.com/sean_walter0717)
- 博客: [seanwalter.top](https://seanwalter.top)

---

## License

[MIT](./LICENSE)
