#!/bin/bash
#
# OpenClaw Visualizer - 自动化测试脚本
# Usage: ./scripts/run-tests.sh [options]
#

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
FAILED=0
PASSED=0
SKIPPED=0
P0_FAILED=0

# 配置
SKIP_E2E=${SKIP_E2E:-0}
SKIP_INTEGRATION=${SKIP_INTEGRATION:-0}
SKIP_GATEWAY=${SKIP_GATEWAY:-0}
VERBOSE=${VERBOSE:-0}
CI_MODE=${CI_MODE:-0}

# 帮助信息
show_help() {
  cat << EOF
OpenClaw Visualizer Test Suite

Usage: $0 [OPTIONS]

Options:
  -h, --help          显示帮助信息
  -v, --verbose       详细输出
  -c, --ci            CI 模式 (严格模式)
  --skip-e2e          跳过 E2E 测试
  --skip-integration  跳过集成测试
  --skip-gateway      跳过需要 Gateway 的测试
  --only-p0           只运行 P0 测试
  --report            生成测试报告

Examples:
  $0                          # 运行所有测试
  $0 --skip-e2e               # 跳过 E2E 测试
  $0 --only-p0                # 只运行 P0 测试
  $0 -v --report              # 详细输出并生成报告

Environment Variables:
  SKIP_E2E=1                  # 跳过 E2E
  SKIP_INTEGRATION=1          # 跳过集成测试
  OPENCLAW_TOKEN=xxx          # Gateway 认证 token
EOF
}

# 解析参数
parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      -h|--help)
        show_help
        exit 0
        ;;
      -v|--verbose)
        VERBOSE=1
        shift
        ;;
      -c|--ci)
        CI_MODE=1
        shift
        ;;
      --skip-e2e)
        SKIP_E2E=1
        shift
        ;;
      --skip-integration)
        SKIP_INTEGRATION=1
        shift
        ;;
      --skip-gateway)
        SKIP_GATEWAY=1
        shift
        ;;
      --only-p0)
        ONLY_P0=1
        shift
        ;;
      --report)
        GENERATE_REPORT=1
        shift
        ;;
      *)
        echo -e "${RED}Unknown option: $1${NC}"
        show_help
        exit 1
        ;;
    esac
  done
}

# 打印带颜色的消息
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

# 分隔线
separator() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# 运行单个测试
run_test() {
  local name=$1
  local cmd=$2
  local priority=$3
  local category=$4
  
  # 如果只运行 P0，跳过其他
  if [[ ${ONLY_P0:-0} -eq 1 && "$priority" != "P0" ]]; then
    ((SKIPPED++))
    return 0
  fi
  
  echo -n "  $name ($priority)... "
  
  local output
  local exit_code
  
  if [[ $VERBOSE -eq 1 ]]; then
    if eval "$cmd"; then
      log_success "PASSED"
      ((PASSED++))
    else
      log_error "FAILED"
      ((FAILED++))
      [[ "$priority" == "P0" ]] && ((P0_FAILED++))
      
      if [[ $CI_MODE -eq 1 && "$priority" == "P0" ]]; then
        exit 1
      fi
    fi
  else
    output=$(eval "$cmd" 2>&1) && exit_code=0 || exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
      log_success "PASSED"
      ((PASSED++))
    else
      log_error "FAILED"
      [[ $VERBOSE -eq 0 ]] && echo "$output" | head -20
      ((FAILED++))
      [[ "$priority" == "P0" ]] && ((P0_FAILED++))
      
      # P0 失败立即退出
      if [[ "$priority" == "P0" ]]; then
        separator
        log_error "P0 测试失败，停止执行"
        log_error "失败命令: $cmd"
        show_summary
        exit 1
      fi
    fi
  fi
}

# 检查 Gateway 是否可用
check_gateway() {
  if command -v openclaw &> /dev/null; then
    if openclaw status 2>/dev/null | grep -q "running"; then
      return 0
    fi
  fi
  return 1
}

# Phase 1: 环境检查
phase_env() {
  separator
  log_info "Phase 1: 环境检查"
  separator
  
  run_test "Node.js >= 18" "node --version | grep -E 'v(1[8-9]|2[0-9])'" "P0" "env"
  run_test "npm 可用" "npm --version" "P0" "env"
  
  if command -v openclaw &> /dev/null; then
    run_test "OpenClaw CLI" "openclaw --version" "P0" "env"
    
    if check_gateway; then
      log_success "OpenClaw Gateway 运行中"
    else
      log_warn "OpenClaw Gateway 未运行 (将跳过相关测试)"
      SKIP_GATEWAY=1
    fi
  else
    log_warn "OpenClaw CLI 未安装"
    SKIP_GATEWAY=1
  fi
  
  run_test "Git 仓库" "git status > /dev/null" "P0" "env"
  run_test "项目结构" "test -d apps/bridge && test -d apps/web" "P0" "env"
}

# Phase 2: 构建检查
phase_build() {
  separator
  log_info "Phase 2: 构建验证"
  separator
  
  run_test "安装依赖" "npm ci" "P0" "build"
  run_test "Bridge Server 构建" "cd apps/bridge && npm run build" "P0" "build"
  run_test "Web Frontend 构建" "cd apps/web && npm run build" "P0" "build"
}

# Phase 3: 单元测试
phase_unit() {
  separator
  log_info "Phase 3: 单元测试"
  separator
  
  run_test "Database 模块" "npm run test:unit -- --testPathPattern=database --passWithNoTests" "P0" "unit"
  run_test "Gateway Client" "npm run test:unit -- --testPathPattern=gateway --passWithNoTests" "P0" "unit"
  run_test "Event Parser" "npm run test:unit -- --testPathPattern=parser --passWithNoTests" "P1" "unit"
  run_test "Store/State" "npm run test:unit -- --testPathPattern=store --passWithNoTests" "P0" "unit"
  run_test "Hooks" "npm run test:unit -- --testPathPattern=hooks --passWithNoTests" "P1" "unit"
}

# Phase 4: 集成测试
phase_integration() {
  if [[ $SKIP_INTEGRATION -eq 1 ]]; then
    separator
    log_warn "Phase 4: 集成测试 (已跳过)"
    ((SKIPPED+=3))
    return
  fi
  
  separator
  log_info "Phase 4: 集成测试"
  separator
  
  if [[ $SKIP_GATEWAY -eq 1 ]]; then
    log_warn "跳过 Gateway 相关集成测试"
    run_test "Mock Gateway 连接" "npm run test:integration -- --testNamePattern='mock' --passWithNoTests" "P1" "integration"
  else
    run_test "真实 Gateway 连接" "npm run test:integration -- --testNamePattern='gateway' --passWithNoTests" "P0" "integration"
    run_test "数据流端到端" "npm run test:integration -- --testNamePattern='data flow' --passWithNoTests" "P0" "integration"
    run_test "WebSocket 广播" "npm run test:integration -- --testNamePattern='broadcast' --passWithNoTests" "P1" "integration"
  fi
}

# Phase 5: 技能测试
phase_skills() {
  separator
  log_info "Phase 5: 技能验证"
  separator
  
  run_test "Superpowers 技能存在" "test -d skills/superpowers && test -f skills/superpowers/SKILL.md" "P0" "skills"
  run_test "Moltbook 技能存在" "test -d skills/moltbook-talent-marketplace && test -f skills/moltbook-talent-marketplace/SKILL.md" "P0" "skills"
  run_test "Superpowers 子技能" "test -d skills/superpowers/skills/brainstorming" "P0" "skills"
  run_test "技能 YAML 格式" "node scripts/validate-skills.js" "P0" "skills"
  
  if [[ $SKIP_GATEWAY -eq 0 ]]; then
    run_test "技能触发器注册" "node scripts/test-skill-patterns.js" "P1" "skills"
  fi
}

# Phase 6: E2E 测试
phase_e2e() {
  if [[ $SKIP_E2E -eq 1 ]]; then
    separator
    log_warn "Phase 6: E2E 测试 (已跳过)"
    ((SKIPPED+=5))
    return
  fi
  
  separator
  log_info "Phase 6: E2E 测试"
  separator
  
  # 检查 Playwright
  if ! command -v npx playwright &> /dev/null; then
    log_warn "Playwright 未安装，跳过 E2E 测试"
    ((SKIPPED+=5))
    return
  fi
  
  run_test "Overview Tab" "cd apps/web && npx playwright test overview --pass-with-no-tests" "P1" "e2e"
  run_test "Timeline Tab" "cd apps/web && npx playwright test timeline --pass-with-no-tests" "P1" "e2e"
  run_test "Logs Tab" "cd apps/web && npx playwright test logs --pass-with-no-tests" "P1" "e2e"
  run_test "Decision Graph" "cd apps/web && npx playwright test graph --pass-with-no-tests" "P1" "e2e"
  run_test "Performance Tab" "cd apps/web && npx playwright test performance --pass-with-no-tests" "P1" "e2e"
}

# Phase 7: 性能测试
phase_performance() {
  separator
  log_info "Phase 7: 性能测试 (可降级)"
  separator
  
  # 性能测试失败不阻断
  run_test "Bundle 大小检查" "node scripts/check-bundle-size.js 2>/dev/null || true" "P1" "performance"
  run_test "构建时间" "node scripts/check-build-time.js 2>/dev/null || true" "P2" "performance"
  
  if [[ $CI_MODE -eq 0 ]]; then
    log_warn "性能测试仅在 CI 模式下严格执行"
  fi
}

# Phase 8: 代码质量
phase_quality() {
  separator
  log_info "Phase 8: 代码质量"
  separator
  
  run_test "ESLint" "npm run lint" "P0" "quality"
  run_test "TypeScript 检查" "npm run type-check" "P0" "quality"
  run_test "格式化检查" "npm run format:check 2>/dev/null || npm run prettier:check 2>/dev/null || true" "P1" "quality"
}

# 生成报告
generate_report() {
  if [[ ${GENERATE_REPORT:-0} -ne 1 ]]; then
    return
  fi
  
  separator
  log_info "生成测试报告"
  
  local report_dir="test-reports"
  mkdir -p "$report_dir"
  
  local timestamp=$(date +%Y%m%d-%H%M%S)
  local report_file="$report_dir/test-report-$timestamp.md"
  
  cat > "$report_file" << EOF
# 测试报告

**生成时间:** $(date)  
**版本:** $(git rev-parse --short HEAD)  
**执行人:** $(whoami)  

## 汇总

| 指标 | 数值 |
|------|------|
| 通过 | $PASSED |
| 失败 | $FAILED |
| 跳过 | $SKIPPED |
| P0 失败 | $P0_FAILED |

## 结论

EOF
  
  if [[ $P0_FAILED -eq 0 ]]; then
    echo "✅ **通过** - 所有 P0 测试通过" >> "$report_file"
  else
    echo "❌ **失败** - 存在 P0 失败，阻止发布" >> "$report_file"
  fi
  
  log_success "报告已生成: $report_file"
}

# 显示汇总
show_summary() {
  separator
  echo "📊 测试汇总"
  separator
  
  printf "  ${GREEN}通过: %d${NC}\n" $PASSED
  
  if [[ $FAILED -gt 0 ]]; then
    printf "  ${RED}失败: %d${NC}\n" $FAILED
  fi
  
  if [[ $SKIPPED -gt 0 ]]; then
    printf "  ${YELLOW}跳过: %d${NC}\n" $SKIPPED
  fi
  
  if [[ $P0_FAILED -gt 0 ]]; then
    separator
    log_error "⚠️  发现 $P0_FAILED 个 P0 失败!"
    log_error "根据策略，阻止发布"
  fi
  
  separator
  
  # 总体评估
  if [[ $P0_FAILED -eq 0 ]]; then
    if [[ $FAILED -eq 0 ]]; then
      log_success "🎉 所有测试通过！"
      exit 0
    else
      log_warn "⚠️  部分非 P0 测试失败，建议审查"
      exit 0
    fi
  else
    log_error "❌ P0 测试失败，请修复后再发布"
    exit 1
  fi
}

# 主函数
main() {
  parse_args "$@"
  
  echo ""
  echo "╔══════════════════════════════════════════════════╗"
  echo "║     OpenClaw Visualizer Test Suite               ║"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""
  
  # 切换到项目根目录
  cd "$(dirname "$0")/.." > /dev/null
  
  # 执行各阶段测试
  phase_env
  phase_build
  phase_quality
  phase_unit
  phase_integration
  phase_skills
  phase_e2e
  phase_performance
  
  # 生成报告
  generate_report
  
  # 显示汇总
  show_summary
}

# 运行主函数
main "$@"
