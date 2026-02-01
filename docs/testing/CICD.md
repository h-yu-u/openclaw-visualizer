# CI/CD 配置指南

**文档版本:** v1.0  
**目标:** 自动化测试、构建和部署流程

---

## 🔄 工作流概览

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Push     │───→│    Test     │───→│    Build    │───→│   Release   │
│    / PR     │    │   Suite     │    │   & Check   │    │   (Tag)     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │
                    ┌─────┴─────┐
                    │  P0 Fail  │──→ ❌ Block
                    └───────────┘
```

---

## 📁 配置文件

### 1. 主测试工作流

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [ main, develop, 'feature/*' ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '20'
  BRIDGE_PORT: 3001
  DATABASE_PATH: './data/test.db'

jobs:
  # ========== 代码质量检查 ==========
  lint-and-type-check:
    name: Code Quality
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run ESLint
      run: npm run lint
    
    - name: Run TypeScript check
      run: npm run type-check
    
    - name: Check formatting
      run: npm run format:check

  # ========== 单元测试 ==========
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint-and-type-check
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit -- --coverage --reporter=verbose
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
        fail_ci_if_error: false
        verbose: true

  # ========== 构建验证 ==========
  build:
    name: Build Verification
    runs-on: ubuntu-latest
    needs: lint-and-type-check
    
    strategy:
      matrix:
        app: [bridge, web]
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build ${{ matrix.app }}
      run: |
        cd apps/${{ matrix.app }}
        npm run build
    
    - name: Check bundle size
      if: matrix.app == 'web'
      run: |
        cd apps/web
        npm run build
        node ../../scripts/check-bundle-size.js
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v4
      with:
        name: ${{ matrix.app }}-build
        path: apps/${{ matrix.app }}/dist

  # ========== 集成测试 (可选) ==========
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: [unit-tests, build]
    continue-on-error: true  # Gateway 可能不可用
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Download bridge build
      uses: actions/download-artifact@v4
      with:
        name: bridge-build
        path: apps/bridge/dist
    
    - name: Check OpenClaw Gateway availability
      id: check-gateway
      run: |
        if command -v openclaw &> /dev/null && openclaw status | grep -q "running"; then
          echo "available=true" >> $GITHUB_OUTPUT
          echo "Gateway is available"
        else
          echo "available=false" >> $GITHUB_OUTPUT
          echo "Gateway not available, will use mock"
        fi
    
    - name: Start Mock Gateway
      if: steps.check-gateway.outputs.available == 'false'
      run: |
        node scripts/mock-gateway.js &
        sleep 5
    
    - name: Start Bridge Server
      run: |
        cd apps/bridge
        npm run start:test &
        sleep 5
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        OPENCLAW_GATEWAY_URL: ${{ steps.check-gateway.outputs.available == 'true' && 'ws://127.0.0.1:18789' || 'ws://localhost:18889' }}

  # ========== E2E 测试 ==========
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: build
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install Playwright
      run: |
        cd apps/web
        npx playwright install --with-deps chromium
    
    - name: Download web build
      uses: actions/download-artifact@v4
      with:
        name: web-build
        path: apps/web/dist
    
    - name: Start application
      run: |
        npm run preview &
        sleep 10
    
    - name: Run E2E tests
      run: |
        cd apps/web
        npx playwright test
    
    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: apps/web/playwright-report/
        retention-days: 30

  # ========== 技能验证 ==========
  skill-validation:
    name: Skill Validation
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
    
    - name: Validate skill structure
      run: node scripts/validate-skills.js
    
    - name: Check skill references
      run: |
        for skill in skills/*/; do
          echo "Checking $skill..."
          if [ -f "$skill/SKILL.md" ]; then
            echo "✅ $skill has SKILL.md"
          else
            echo "❌ $skill missing SKILL.md"
            exit 1
          fi
        done
    
    - name: Generate skill manifest
      run: node scripts/generate-skill-manifest.js

  # ========== 安全扫描 ==========
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Run npm audit
      run: npm audit --audit-level=moderate
      continue-on-error: true  # 记录但不阻断
    
    - name: Run CodeQL Analysis
      uses: github/codeql-action/init@v2
      with:
        languages: javascript
    
    - name: Autobuild
      uses: github/codeql-action/autobuild@v2
    
    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v2

  # ========== 性能测试 ==========
  performance:
    name: Performance Audit
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'  # 只在 main 分支运行
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Download web build
      uses: actions/download-artifact@v4
      with:
        name: web-build
        path: apps/web/dist
    
    - name: Run Lighthouse CI
      run: |
        npm install -g @lhci/cli@0.12.x
        lhci autorun
      env:
        LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

  # ========== 发布工作流 ==========
  release:
    name: Create Release
    runs-on: ubuntu-latest
    needs: [unit-tests, build, e2e-tests]
    if: startsWith(github.ref, 'refs/tags/v')
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Generate changelog
      run: |
        echo "## Changes" > CHANGELOG.md
        git log $(git describe --tags --abbrev=0 HEAD~1)..HEAD --oneline >> CHANGELOG.md
    
    - name: Create Release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        body_path: CHANGELOG.md
        draft: false
        prerelease: false
```

### 2. Lighthouse 配置

```json
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:5173'],
      startServerCommand: 'npm run preview',
      startServerReadyTimeout: 10000,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.7 }],  // 可降级
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'interactive': ['warn', { maxNumericValue: 3500 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

---

## 🚀 本地模拟 CI

### 脚本运行

```bash
# 模拟完整 CI 流程
npm run ci:local

# 仅运行 P0 测试
npm run ci:p0

# 跳过耗时测试
SKIP_E2E=1 npm run ci:local
```

### act 工具 (本地 GitHub Actions)

```bash
# 安装 act
brew install act

# 运行完整工作流
act

# 运行特定 job
act -j unit-tests

# 使用特定镜像
act -P ubuntu-latest=node:20-buster
```

---

## 📊 状态徽章

添加到 README.md：

```markdown
![CI](https://github.com/h-yu-u/openclaw-visualizer/workflows/CI/badge.svg)
![Codecov](https://codecov.io/gh/h-yu-u/openclaw-visualizer/branch/main/graph/badge.svg)
![License](https://img.shields.io/github/license/h-yu-u/openclaw-visualizer)
```

---

## 🔔 通知配置

### Slack 集成

```yaml
# .github/workflows/notify.yml
name: Notifications

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]

jobs:
  notify:
    runs-on: ubuntu-latest
    if: github.event.workflow_run.conclusion == 'failure'
    
    steps:
    - name: Notify Slack
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ github.event.workflow_run.conclusion }}
        channel: '#openclaw-dev'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 📝 环境变量

### Secrets 配置

在 GitHub Settings > Secrets 中配置：

| Secret | 用途 | 必需 |
|--------|------|------|
| `CODECOV_TOKEN` | 覆盖率上传 | 否 |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI | 否 |
| `SLACK_WEBHOOK` | 失败通知 | 否 |
| `OPENCLAW_TOKEN` | 真实 Gateway 测试 | 否 |

### 环境变量文档

```bash
# .env.example
# 测试配置
NODE_ENV=test
DATABASE_PATH=./data/test.db
BRIDGE_PORT=3001

# Gateway 连接 (可选)
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_TOKEN=your-token-here

# 测试选项
SKIP_E2E=0
SKIP_INTEGRATION=0
MOCK_GATEWAY=0
```

---

## 🎯 发布流程

### 版本发布

```bash
# 1. 更新版本
npm version patch  # or minor, major

# 2. 推送标签
git push --follow-tags

# 3. CI 自动创建 Release
```

### 紧急修复

```bash
# 从最新 tag 创建修复分支
git checkout -b hotfix/critical-fix v1.0.0

# 修复并提交
git commit -m "fix: critical bug"

# 打补丁版本标签
git tag v1.0.1
git push origin v1.0.1
```

---

**配置完成后，每次 Push/PR 将自动运行完整测试套件！**
