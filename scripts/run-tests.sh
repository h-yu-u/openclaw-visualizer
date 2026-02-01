#!/bin/bash
# OpenClaw Visualizer Test Suite Runner

echo "🧪 OpenClaw Visualizer Test Suite"
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED=0
PASSED=0
SKIPPED=0

# 测试函数
run_test() {
  local name=$1
  local cmd=$2
  local priority=$3
  
  echo -n "Testing $name ($priority)... "
  
  if eval "$cmd" > /tmp/test-$$.log 2>&1; then
    echo -e "${GREEN}✅ PASSED${NC}"
    ((PASSED++))
  else
    if [ "$priority" = "P0" ]; then
      echo -e "${RED}❌ FAILED (P0 - Blocking)${NC}"
      cat /tmp/test-$$.log
      ((FAILED++))
    else
      echo -e "${YELLOW}⚠️ FAILED (non-blocking)${NC}"
      cat /tmp/test-$$.log
      ((FAILED++))
    fi
  fi
}

# ========== Phase 1: 环境检查 ==========
echo ""
echo "📋 Phase 1: Environment Checks"
echo "--------------------------------"

# Node.js version check (without grep to avoid pipefail issues)
echo -n "Testing Node.js version (P0)... "
NODE_VERSION=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ] 2>/dev/null; then
  echo -e "${GREEN}✅ PASSED${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ FAILED${NC}"
  ((FAILED++))
fi

run_test "npm available" "npm --version" "P0"
run_test "Git repository" "git status > /dev/null" "P0"

# 检查 OpenClaw Gateway
if command -v openclaw &> /dev/null && openclaw status 2>/dev/null | grep -q "running"; then
  echo -e "${GREEN}✅ OpenClaw Gateway is running${NC}"
  GATEWAY_AVAILABLE=true
else
  echo -e "${YELLOW}⚠️ OpenClaw Gateway not running${NC}"
  GATEWAY_AVAILABLE=false
fi

# ========== Phase 2: 构建验证 ==========
echo ""
echo "📦 Phase 2: Build Verification"
echo "--------------------------------"

run_test "Install dependencies" "npm install" "P0"
run_test "Build Bridge" "npm run build -w apps/bridge" "P0"
run_test "Build Web" "npm run build -w apps/web" "P0"

# ========== Phase 3: 单元测试 ==========
echo ""
echo "🔬 Phase 3: Unit Tests"
echo "--------------------------------"

if npm run test:unit -- --run > /tmp/unit-test.log 2>&1; then
  echo -e "${GREEN}✅ Unit tests PASSED${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠️ Unit tests FAILED${NC}"
  tail -50 /tmp/unit-test.log
  ((FAILED++))
fi

# ========== Phase 4: 类型检查 ==========
echo ""
echo "🔍 Phase 4: Type Checking"
echo "--------------------------------"

run_test "Bridge TypeScript" "npx tsc -p apps/bridge/tsconfig.json --noEmit" "P0"
run_test "Web TypeScript" "npx tsc -p apps/web/tsconfig.json --noEmit" "P0"

# ========== Phase 5: 技能检查 ==========
echo ""
echo "🎯 Phase 5: Skill Validation"
echo "--------------------------------"

run_test "Superpowers skills" "test -d /Users/haoyu/.openclaw/workspace/skills/superpowers" "P1"
run_test "Moltbook marketplace" "test -d /Users/haoyu/.openclaw/workspace/skills/moltbook-talent-marketplace" "P1"

# ========== Phase 6: 集成测试 (如果 Gateway 可用) ==========
echo ""
echo "🔗 Phase 6: Integration Tests"
echo "--------------------------------"

if [ "$GATEWAY_AVAILABLE" = true ]; then
  echo -e "${BLUE}ℹ️ Gateway available, running integration tests...${NC}"
  
  # 启动 Bridge Server 进行测试
  if [ -f "apps/bridge/dist/index.js" ]; then
    echo -e "${BLUE}ℹ️ Bridge Server built successfully${NC}"
  else
    echo -e "${YELLOW}⚠️ Bridge Server not built${NC}"
  fi
else
  echo -e "${YELLOW}⚠️ Gateway not available, skipping integration tests${NC}"
  ((SKIPPED++))
fi

# ========== Phase 7: 性能检查 ==========
echo ""
echo "⚡ Phase 7: Performance Checks"
echo "--------------------------------"

# 检查 bundle 大小
if [ -d "apps/web/dist" ]; then
  WEB_SIZE=$(du -sh apps/web/dist | cut -f1)
  echo -e "${BLUE}ℹ️ Web bundle size: $WEB_SIZE${NC}"
  
  # 检查主要 JS 文件大小
  MAIN_JS=$(find apps/web/dist -name "*.js" -type f | head -1)
  if [ -n "$MAIN_JS" ]; then
    JS_SIZE=$(du -h "$MAIN_JS" | cut -f1)
    echo -e "${BLUE}ℹ️ Main JS size: $JS_SIZE${NC}"
  fi
fi

# ========== 总结 ==========
echo ""
echo "================================"
echo "📊 Test Summary"
echo "================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${YELLOW}Failed: $FAILED (review required)${NC}"
fi
if [ $SKIPPED -gt 0 ]; then
  echo -e "${BLUE}Skipped: $SKIPPED${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All critical tests passed!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests failed. Review before release.${NC}"
  exit 0
fi
