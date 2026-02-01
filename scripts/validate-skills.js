#!/usr/bin/env node
/**
 * 技能结构验证脚本
 * 验证所有技能符合 OpenClaw 格式规范
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const EXIT_CODE = {
  SUCCESS: 0,
  WARNING: 1,
  ERROR: 2
};

let errors = 0;
let warnings = 0;

function logError(msg) {
  console.error(`❌ ${msg}`);
  errors++;
}

function logWarn(msg) {
  console.warn(`⚠️  ${msg}`);
  warnings++;
}

function logSuccess(msg) {
  console.log(`✅ ${msg}`);
}

function validateSkill(skillPath) {
  const skillName = path.basename(skillPath);
  console.log(`\n📁 检查技能: ${skillName}`);

  // 1. 检查 SKILL.md 存在
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    logError(`${skillName}: 缺少 SKILL.md`);
    return;
  }

  // 2. 读取并解析 SKILL.md
  const content = fs.readFileSync(skillMdPath, 'utf8');
  
  // 3. 检查 YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    logError(`${skillName}: 缺少 YAML frontmatter`);
    return;
  }

  try {
    const frontmatter = yaml.load(frontmatterMatch[1]);
    
    // 4. 检查必需字段
    const requiredFields = ['name', 'description'];
    for (const field of requiredFields) {
      if (!frontmatter[field]) {
        logError(`${skillName}: frontmatter 缺少 ${field}`);
      }
    }

    // 5. 检查 name 格式
    if (frontmatter.name) {
      if (!/^[a-z0-9-]+$/.test(frontmatter.name)) {
        logWarn(`${skillName}: name 应使用小写和连字符`);
      }
      if (frontmatter.name !== skillName) {
        logWarn(`${skillName}: name (${frontmatter.name}) 与目录名不匹配`);
      }
    }

    logSuccess(`${skillName}: 结构有效`);

  } catch (e) {
    logError(`${skillName}: YAML 解析失败 - ${e.message}`);
  }

  // 6. 检查脚本目录
  const scriptsDir = path.join(skillPath, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    const scripts = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.sh'));
    for (const script of scripts) {
      const scriptPath = path.join(scriptsDir, script);
      const stats = fs.statSync(scriptPath);
      // 检查执行权限 (Unix)
      if (process.platform !== 'win32') {
        const mode = stats.mode;
        if (!(mode & 0o111)) {
          logWarn(`${skillName}/${script}: 缺少执行权限`);
        }
      }
    }
  }

  // 7. 检查 references 目录
  const refsDir = path.join(skillPath, 'references');
  if (fs.existsSync(refsDir)) {
    const refs = fs.readdirSync(refsDir);
    if (refs.length === 0) {
      logWarn(`${skillName}: references 目录为空`);
    }
  }
}

function main() {
  console.log('🔍 技能结构验证\n');

  if (!fs.existsSync(SKILLS_DIR)) {
    logError(`技能目录不存在: ${SKILLS_DIR}`);
    process.exit(EXIT_CODE.ERROR);
  }

  const skills = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => path.join(SKILLS_DIR, dirent.name));

  if (skills.length === 0) {
    logWarn('没有找到任何技能');
  }

  for (const skillPath of skills) {
    validateSkill(skillPath);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`验证完成: ${skills.length} 个技能`);
  console.log(`错误: ${errors}, 警告: ${warnings}`);

  if (errors > 0) {
    process.exit(EXIT_CODE.ERROR);
  } else if (warnings > 0) {
    process.exit(EXIT_CODE.WARNING);
  } else {
    logSuccess('所有技能验证通过！');
    process.exit(EXIT_CODE.SUCCESS);
  }
}

main();
