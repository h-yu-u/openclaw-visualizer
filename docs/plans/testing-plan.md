# OpenClaw Visualizer 测试计划

**版本:** v1.0  
**日期:** 2026-02-01  
**范围:** Phase 1 + Phase 2 完整功能验证  
**状态:** 待审批

---

## 📋 测试概述

### 目标
验证 OpenClaw Visualizer 在 Bridge Server 和 Web Frontend 两个层面的功能完整性、稳定性和性能表现。

### 测试范围
| 阶段 | 组件 | 状态 |
|------|------|------|
| Phase 1 | Bridge Server Core (SQLite, WebSocket) | ✅ 待验证 |
| Phase 1 | React Frontend Shell | ✅ 待验证 |
| Phase 2 | Gateway Client 连接 | ✅ 待验证 |
| Phase 2 | Overview Tab (Recharts) | ✅ 待验证 |
| Phase 2 | Timeline Tab (Gantt) | ✅ 待验证 |
| Phase 2 | Logs Tab (搜索/高亮) | ✅ 待验证 |
| Phase 2 | Decision Graph (React Flow) | ✅ 待验证 |
| Phase 2 | Performance Tab | ✅ 待验证 |

---

## 🧪 测试环境

### 硬件/软件要求
```bash
# 系统要求
- Node.js >= 18
- macOS / Linux / Windows WSL
- 内存 >= 4GB
- Chrome/Firefox/Safari 最新版本

# 依赖检查
npm --version
node --version
```

### 测试配置文件
```bash
# 环境变量
cp apps/bridge/.env.example apps/bridge/.env.test

# 测试数据库
DATABASE_PATH=./data/test.db
OPENCLAW_TOKEN=test-token
BRIDGE_PORT=3001
VITE_BRIDGE_URL=ws://localhost:3001
```

---

## 📊 测试分类

### 1. 单元测试 (Unit Tests)

#### 1.1 Bridge Server 模块

| 模块 | 测试项 | 预期结果 | 优先级 |
|------|--------|----------|--------|
| `database.ts` | SQLite 初始化 | 成功创建表结构 | P0 |
| `database.ts` | CRUD 操作 | 增删改查正常 | P0 |
| `database.ts` | 成本计算 | 各模型价格计算准确 | P0 |
| `event-parser.ts` | 事件解析 | 正确解析所有事件类型 | P0 |
| `event-parser.ts` | 边界情况 | 处理异常数据不崩溃 | P1 |
| `gateway-client.ts` | WebSocket 连接 | 成功连接 Gateway | P0 |
| `gateway-client.ts` | 自动重连 | 断线后指数退避重连 | P0 |
| `gateway-client.ts` | 心跳机制 | 定期发送 ping/pong | P1 |

#### 1.2 Frontend 组件

| 组件 | 测试项 | 预期结果 | 优先级 |
|------|--------|----------|--------|
| `useWebSocket.ts` | 连接建立 | 成功连接 Bridge | P0 |
| `useWebSocket.ts` | 重连逻辑 | 断线自动重连 | P1 |
| `store/index.ts` | 状态管理 | Zustand 状态正确更新 | P0 |
| `store/index.ts` | 选择器 | 派生数据计算正确 | P1 |

### 2. 集成测试 (Integration Tests)

#### 2.1 端到端数据流

```
[OpenClaw Gateway] → [Bridge Server] → [Web Frontend]
```

| 场景 | 步骤 | 验证点 |
|------|------|--------|
| 会话启动 | 1. Gateway 发送 session_start<br>2. Bridge 解析存储<br>3. Frontend 显示 | 侧边栏出现新会话 |
| 工具调用流 | 1. Gateway 发送 tool_call<br>2. Bridge 存储<br>3. Frontend 实时更新 | 各 Tab 数据同步 |
| 会话结束 | 1. Gateway 发送 session_end<br>2. 状态更新<br>3. 成本计算 | 状态为 completed/failed |

#### 2.2 多客户端并发

| 场景 | 测试方法 | 预期结果 |
|------|----------|----------|
| 多浏览器标签 | 打开 3+ 个标签页 | 所有标签数据同步 |
| 长连接稳定性 | 保持连接 30 分钟 | 无内存泄漏 |
| 快速刷新 | 连续 F5 刷新 10 次 | 正常恢复连接 |

### 3. UI/UX 测试

#### 3.1 Overview Tab

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| 空状态 | 选择无工具调用的会话 | 显示空状态提示 |
| 数据展示 | 选择有数据的会话 | 6个统计卡片正确显示 |
| Token 饼图 | 查看图表 | Input/Output 比例正确 |
| 工具使用图 | 悬停柱状图 | 显示具体数值 |
| 响应式 | 调整窗口大小 | 图表自适应 |

#### 3.2 Timeline Tab

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| Gantt 渲染 | 选择会话 | 工具条正确排列 |
| 缩放控制 | 点击 +/- | 时间轴缩放 |
| 颜色编码 | 查看不同工具 | 每种工具有独特颜色 |
| 状态边框 | 查看运行中/完成/错误 | 边框颜色对应状态 |
| 悬停提示 | 鼠标悬停工具条 | 显示详细信息 |

#### 3.3 Logs Tab

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| 搜索功能 | 输入关键词 | 实时过滤结果 |
| 状态筛选 | 点击状态按钮 | 只显示对应状态 |
| JSON 高亮 | 查看参数/结果 | 语法高亮正确 |
| 复制功能 | 点击复制按钮 | 内容复制到剪贴板 |
| 导出功能 | 点击导出 | 下载 JSON 文件 |
| 大量日志 | 选择 100+ 调用的会话 | 滚动流畅无卡顿 |

#### 3.4 Decision Graph Tab

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| 流程图渲染 | 选择会话 | 节点正确排列 |
| 节点类型 | 查看不同类型 | Start/Tool/End 样式不同 |
| 连线动画 | 查看运行中会话 | 连线有流动动画 |
| 迷你地图 | 查看右下角 | 显示整体概览 |
| 拖拽平移 | 拖动画布 | 视角跟随移动 |
| 缩放控制 | 使用滚轮 | 平滑缩放 |

#### 3.5 Performance Tab

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| 面积图 | 查看 Token 趋势 | 时间序列正确显示 |
| 箱线图 | 查看执行时间分布 | 统计指标正确 |
| 工具对比 | 查看各工具性能 | 平均耗时准确 |
| 成本明细 | 查看成本分布 | 各模型费用正确 |

### 4. 性能测试

#### 4.1 加载性能

| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| 首次内容绘制 (FCP) | < 1.5s | Lighthouse |
| 可交互时间 (TTI) | < 3s | Lighthouse |
| 页面完全加载 | < 5s | Chrome DevTools |

#### 4.2 运行时性能

| 场景 | 目标 | 测试方法 |
|------|------|----------|
| 100 个工具调用 | 渲染 < 500ms | React DevTools Profiler |
| 1000 个工具调用 | 滚动 FPS > 30 | Chrome Performance |
| WebSocket 消息 | 处理延迟 < 100ms | 自定义计时 |

#### 4.3 内存使用

| 场景 | 目标 | 测试方法 |
|------|------|----------|
| 初始加载 | < 50MB | Chrome Memory |
| 长时间运行 | 无持续增长 | 30分钟监控 |
| 大数据集 | < 200MB | 加载1000条记录 |

### 5. 兼容性测试

#### 5.1 浏览器兼容性

| 浏览器 | 版本 | 状态 |
|--------|------|------|
| Chrome | 最新 | 待测 |
| Firefox | 最新 | 待测 |
| Safari | 最新 | 待测 |
| Edge | 最新 | 待测 |

#### 5.2 分辨率兼容性

| 分辨率 | 类型 | 状态 |
|--------|------|------|
| 1920x1080 | Desktop | 待测 |
| 1440x900 | Laptop | 待测 |
| 1366x768 | Small Laptop | 待测 |
| 2560x1440 | HiDPI | 待测 |

---

## 🐛 边界情况测试

### 异常输入

| 场景 | 输入 | 预期行为 |
|------|------|----------|
| 超长会话名 | 1000字符 | 正确截断显示 |
| 特殊字符 | Emoji/Unicode | 正确渲染 |
| 极大 Token 数 | > 1M tokens | 科学计数法显示 |
| 负数时间戳 | 错误数据 | 显示为 Invalid |
| 缺失字段 | 不完整事件 | 使用默认值 |

### 网络异常

| 场景 | 模拟方法 | 预期行为 |
|------|----------|----------|
| Gateway 离线 | 停止 OpenClaw | 显示离线状态 |
| 网络抖动 | 限流/延迟 | 自动重连 |
| Bridge 重启 | kill -9 | 客户端自动重连 |
| 消息丢失 | 丢包 10% | 最终一致性 |

---

## 📈 测试工具

### 推荐工具链

```bash
# 单元测试
npm install -D vitest @testing-library/react @testing-library/jest-dom

# E2E 测试
npm install -D playwright

# 性能测试
npm install -D lighthouse

# 代码覆盖率
npm install -D @vitest/coverage-v8
```

### 测试命令

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行 E2E 测试
npm run test:e2e

# 生成覆盖率报告
npm run test:coverage

# 性能审计
npm run lighthouse
```

---

## ✅ 验收标准

### P0 (必须完成)
- [ ] Bridge Server 正常启动并连接 Gateway
- [ ] Web Frontend 正常渲染所有 Tab
- [ ] 数据流端到端通畅
- [ ] 无控制台报错
- [ ] 内存无泄漏

### P1 (重要)
- [ ] 所有图表正常显示
- [ ] 搜索过滤功能正常
- [ ] 响应式布局正常
- [ ] 性能指标达标

### P2 (加分)
- [ ] 代码覆盖率 > 80%
- [ ] 完整 E2E 测试通过
- [ ] 跨浏览器兼容

---

## 📅 测试时间表

| 阶段 | 内容 | 预计时间 |
|------|------|----------|
| 准备 | 环境搭建、工具安装 | 30 分钟 |
| 单元测试 | Bridge + Frontend 单元测试 | 2 小时 |
| 集成测试 | 端到端数据流验证 | 1 小时 |
| UI 测试 | 各 Tab 功能验证 | 2 小时 |
| 性能测试 | 加载、运行时、内存 | 1 小时 |
| 修复 | Bug 修复回归测试 | 2 小时 |
| 报告 | 生成测试报告 | 30 分钟 |

**总计: ~9 小时**

---

## 📝 测试报告模板

### 测试执行记录

```markdown
## 测试执行报告

**执行日期:** YYYY-MM-DD
**执行人:** 
**版本:** commit-hash

### 结果汇总
| 分类 | 通过 | 失败 | 跳过 | 总计 |
|------|------|------|------|------|
| 单元测试 |  |  |  |  |
| 集成测试 |  |  |  |  |
| UI 测试 |  |  |  |  |
| 性能测试 |  |  |  |  |

### 发现的问题
1. **问题描述:**
   - 严重程度: Critical/Major/Minor
   - 复现步骤:
   - 期望结果:
   - 实际结果:
   - 截图/日志:

### 风险评估
- 发布建议: Go / No Go / Conditional Go
- 已知问题:
- 降级方案:
```

---

## 🤔 需要确认的问题

在正式执行测试前，请确认以下几点：

1. **测试范围**
   - [ ] 是否包含 Moltbook 技能测试？
   - [ ] 是否需要测试真实 OpenClaw Gateway 连接？
   - [ ] 是否测试多用户并发场景？

2. **优先级**
   - [ ] P0 未通过是否阻止发布？
   - [ ] 性能指标不达标是否可降级？

3. **资源**
   - [ ] 是否需要我创建测试脚本？
   - [ ] 是否需要 CI/CD 集成？
   - [ ] 是否需要性能基准数据？

4. **后续计划**
   - [ ] 是否立即进入 Phase 3 开发？
   - [ ] 是否需要先修复发现的问题？

---

**审批后请回复确认，我将开始执行测试计划。**
