# TestPilotAgent

> 把需求文档变成测试用例的 AI 工作台——上传需求，自动生成测试策略、测试点和测试脚本。

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

<img width="1905" height="907" alt="工作台界面" src="https://github.com/user-attachments/assets/91fafcbb-f987-4fb3-befa-99bff8884d6a" />

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

- Node.js 18+
- Python 3.10+
- 阿里云 DashScope API Key（可选，没有也能用规则引擎）

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

不配置也能用——系统会自动回退到规则引擎生成。

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
┌──────────────────────────────────┐
│     Frontend (Next.js)           │
│  App Router · TypeScript         │
│  Workspace + History + Chat      │
├──────────────────────────────────┤
│     Backend (FastAPI)            │
│  SQLAlchemy · Document Parser    │
│  Generation Routes · LLM Client  │
├──────────────────────────────────┤
│     AI Layer                    │
│  DashScope Qwen (JSON 输出)     │
│  规则引擎 (无 API Key 时兜底)    │
├──────────────────────────────────┤
│     Database                     │
│  SQLite / PostgreSQL             │
└──────────────────────────────────┘
```

---

## Roadmap

- [x] PostgreSQL 替换内存存储
- [x] 文档上传与解析（TXT/PDF/DOCX）
- [x] 大模型集成（DashScope Qwen）
- [ ] 完整结构化输出（Pydantic schema 校验）
- [ ] 追问、局部重生成、导出
- [ ] 多模型支持（Qwen-VL 处理含图文档）
- [ ] 测试用例导出为 Excel

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
