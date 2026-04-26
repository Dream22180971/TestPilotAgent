# TestPilotAgent

TestPilotAgent 是一个面向测试工作的智能设计工作台，用来把需求内容逐步转成结构化测试资产。

## 项目结构

- `testpilot-web`：前端工程，基于 Next.js
- `testpilot-api`：后端工程，基于 FastAPI

## 当前进度

- [x] Step 1: PostgreSQL 替换内存存储 — 已完成
- [x] Step 2: 文档上传与解析 — 已完成（上传/列表/删除/文本提取，文档内容已接入分析流程）
- [x] Step 3: 大模型集成 — 已完成（阿里云 DashScope Qwen，支持结构化 JSON 输出）
- [ ] Step 4: 完整结构化输出
- [ ] Step 5: 追问、重生成、导出

## 启动方式

请在项目根目录打开两个 PowerShell 窗口，分别执行：

```powershell
.\start-api.ps1
```

```powershell
.\start-web.ps1
```

启动完成后可访问：

- 前端工作台：`http://127.0.0.1:3000/workspace`
- 后端健康检查：`http://127.0.0.1:8000/health`
- 后端接口文档：`http://127.0.0.1:8000/docs`

## 当前已实现能力

- 工作台页面基础布局
- 项目配置输入
- 需求文本输入
- 业务流程、角色、非功能要求补充
- 前后端联调的项目创建能力
- 前后端联调的需求保存能力
- 前后端联调的基础需求分析能力
- 测试策略、测试点、测试用例、测试脚本区域的 MVP 展示框架
- **文档上传与解析** — 支持 TXT/PDF/DOCX 格式，前端文档列表/删除 UI，后端文本提取并接入分析流程
- **大模型集成** — 阿里云 DashScope（Qwen），OpenAI 兼容接口，JSON 结构化输出，自动生成 + 追问支持

## 关键文件

- 前端工作台页面：`testpilot-web/src/app/workspace/page.tsx`
- 前端历史页面：`testpilot-web/src/app/history/page.tsx`
- 前端文档服务：`testpilot-web/src/services/generation.ts`
- 后端入口文件：`testpilot-api/app/main.py`
- 后端文档解析：`testpilot-api/app/services/document_parser.py`
- 后端数据库存储：`testpilot-api/app/services/db_store.py`
- 后端生成路由：`testpilot-api/app/api/routes/generation.py`
- LLM 客户端：`testpilot-api/app/services/llm_client.py`
- 提示词模板：`testpilot-api/app/prompts/*.txt`
- 前端启动脚本：`start-web.ps1`
- 后端启动脚本：`start-api.ps1`

## 当前实现说明

当前后端是轻量版实现，主要特点如下：

- 已接入 SQLAlchemy 数据库存储（SQLite / PostgreSQL）
- 预留规则驱动方式生成基础分析结果作为 LLM 不可用时的 fallback
- 已支持文档上传与解析（TXT/PDF/DOCX），上传文档内容自动纳入分析流程
- 已接入阿里云 DashScope Qwen 模型，支持结构化 JSON 输出
- 环境配置：设置 `DASHSCOPE_API_KEY` 启用 DashScope，未设置则回退到规则引擎

这意味着当前版本更适合做产品原型验证和主流程开发，不适合作为正式生产版本直接使用。

## 下一步建议

1. 完成测试策略、测试点、测试用例、测试脚本的结构化输出（Pydantic schema 校验 + prompt 调优）
2. 增加追问、局部重生成和导出能力
3. 按需切换模型（如 Qwen-VL 处理含图的文档）

## 说明

如果前端启动后无法连接后端，请先确认：

- `start-api.ps1` 是否已正常运行
- `8000` 端口是否被占用
- `3000` 端口是否被占用
- 前端环境变量中的后端地址是否为 `http://127.0.0.1:8000`

## LLM 配置

在 `testpilot-api` 目录下创建 `.env` 文件（或通过环境变量设置）：

```bash
# 阿里云 DashScope API Key（推荐）
DASHSCOPE_API_KEY="sk-xxxxxxxxxxxxxxxx"

# 可选：自定义模型和端点（默认使用 qwen3-vl-flash-2026-01-22 + dashscope 兼容端点）
# LLM_MODEL="qwen3-vl-flash-2026-01-22"
# LLM_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
```

未配置 API Key 时，系统会自动回退到规则引擎生成。
