# Superpowers 术语表能力实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 `dsh-superpowers-zh` 中提供全局/工作区隔离的可视化术语表、受限模型 CRUD 工具以及每轮确定性术语上下文注入。

**架构：** 一个 host 插件拥有 SQLite 仓储、同源 HTTP API、模型工具与用户消息注入；一个 Web client 插件提供 Superpowers 设置页。术语数据在 DSH home 下单文件持久化，工作区术语按标准化绝对 workspace 路径隔离，全局术语始终参与当前 workspace 的扫描。

**技术栈：** Node.js 22+、`node:sqlite`、DeepSeek Harness Cordis host/client bundle、React client module、现有 `dsh-superpowers-zh` ESM 包。

---

## 文件结构

- 修改：`package.json` — 增加 host/client 所需的 DSH peer 依赖、构建和测试脚本。
- 修改：`index.js` — 保留技能注册，并组合 glossary host 服务、工具和每轮注入入口。
- 创建：`lib/glossary-store.js` — SQLite schema、事务 CRUD、作用域查询和输入校验。
- 创建：`lib/glossary-match.js` — 纯函数匹配、workspace 优先和注入文本构造。
- 创建：`lib/glossary-routes.js` — 同源 HTTP CRUD 与升降级 API。
- 创建：`lib/glossary-tools.js` — 仅注册四个 glossary 模型工具。
- 创建：`client/index.tsx` — DSH `settings.section` 注册与 Superpowers Tab。
- 创建：`client/GlossarySection.tsx` — 全局/工作区列表、编辑和移动表单。
- 创建：`client/glossary-api.ts` — API 客户端、错误处理和刷新逻辑。
- 创建：`client/glossary.css` — 术语表页面最小布局样式。
- 创建：`tests/glossary-match.test.js` — 匹配、优先级、去重、零命中单测。
- 创建：`tests/glossary-store.test.js` — SQLite CRUD、作用域和移动持久化单测。

### 任务 1：建立可验证的 SQLite 术语仓储

**文件：**
- 创建：`lib/glossary-store.js`
- 创建：`tests/glossary-store.test.js`
- 修改：`package.json`

- [ ] **步骤 1：编写失败的仓储测试**

```js
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { GlossaryStore } from '../lib/glossary-store.js'

test('workspace entries do not appear in another workspace and move preserves the entry', () => {
  const store = new GlossaryStore(join(mkdtempSync(join(tmpdir(), 'glossary-')), 'terms.sqlite'))
  const term = store.upsert({ scope: 'workspace', workspace: '/work/a', name: 'dev', aliases: ['开发机'], definition: '开发服务器' })
  assert.equal(store.list({ scope: 'workspace', workspace: '/work/b' }).length, 0)
  store.move(term.id, { scope: 'global' })
  assert.equal(store.list({ scope: 'global' }).at(0).name, 'dev')
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/glossary-store.test.js`

预期：FAIL，报错 `ERR_MODULE_NOT_FOUND`，因为 `lib/glossary-store.js` 尚不存在。

- [ ] **步骤 3：实现最小仓储**

实现 `GlossaryStore`：创建 `terms` 表；`id, scope, workspace, name, aliases_json, definition, created_at, updated_at`；用 SQLite 事务实现 `list/upsert/delete/move`。拒绝空名称、空定义、非法 scope、workspace scope 缺 workspace、超过 64 个别名、超过 256 字符的名称或别名、超过 4096 字符的定义。

```js
upsert({ id, scope, workspace, name, aliases, definition }) {
  validateTerm({ scope, workspace, name, aliases, definition })
  const now = new Date().toISOString()
  const row = { id: id ?? randomUUID(), scope, workspace: scope === 'global' ? null : workspace, name, aliases_json: JSON.stringify(unique(aliases)), definition, updated_at: now }
  this.db.prepare(`INSERT INTO terms (...) VALUES (...) ON CONFLICT(id) DO UPDATE SET ...`).run(row)
  return this.get(row.id)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test tests/glossary-store.test.js`

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add package.json lib/glossary-store.js tests/glossary-store.test.js
git commit -m "feat: add glossary SQLite store"
```

### 任务 2：实现确定性匹配和术语消息构造

**文件：**
- 创建：`lib/glossary-match.js`
- 创建：`tests/glossary-match.test.js`

- [ ] **步骤 1：编写失败的匹配测试**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { injectGlossary } from '../lib/glossary-match.js'

test('workspace wins and aliases of one term inject only once', () => {
  const result = injectGlossary('小蓝与蓝鲸怎么用？', [
    { id: 'global', scope: 'global', name: '蓝鲸', aliases: ['小蓝'], definition: '全局定义' },
    { id: 'workspace', scope: 'workspace', name: '蓝鲸', aliases: ['小蓝'], definition: '项目定义' },
  ])
  assert.equal(result, '【术语说明】\n- 蓝鲸：项目定义\n\n小蓝与蓝鲸怎么用？')
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/glossary-match.test.js`

预期：FAIL，报错 `ERR_MODULE_NOT_FOUND`。

- [ ] **步骤 3：实现最小匹配器**

`injectGlossary(userText, terms)` 按 `name` 和 `aliases` 子串命中，按同一规范名去重，workspace 条目覆盖同名全局条目，按输入 terms 的稳定顺序输出。若无命中，严格返回原字符串。

```js
const chosen = new Map()
for (const term of terms) {
  if ([term.name, ...term.aliases].some(candidate => candidate && userText.includes(candidate))) {
    if (!chosen.has(term.name) || term.scope === 'workspace') chosen.set(term.name, term)
  }
}
return chosen.size === 0 ? userText : `【术语说明】\n${[...chosen.values()].map(term => `- ${term.name}：${term.definition}`).join('\n')}\n\n${userText}`
```

添加 `// ponytail:` 注释，记录纯子串英文短别名误触的天花板和未来词边界升级路径。

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test tests/glossary-match.test.js`

预期：PASS，覆盖 global 命中、workspace 隔离、workspace 优先、同词多别名去重、零命中不变。

- [ ] **步骤 5：Commit**

```bash
git add lib/glossary-match.js tests/glossary-match.test.js
git commit -m "feat: match glossary terms deterministically"
```

### 任务 3：接入 DSH host 生命周期、模型工具和用户消息注入

**文件：**
- 修改：`index.js`
- 创建：`lib/glossary-tools.js`

- [ ] **步骤 1：调查当前 DSH 0.1.0-rc.7 的工具注册与 prompt pre-step seam**

运行：

```bash
rg -n "tools\.register|tool.*register|session/prompt|pre-step" /tmp/deepseek-harness/packages
```

预期：定位官方工具定义和在最新用户消息进入模型前注入上下文的 seam；禁止猜测不存在的接口。

- [ ] **步骤 2：编写 host 集成失败测试或最小 stub**

以官方 seam 的真实接口写一个 stub，验证 `glossary_list/upsert/delete/move` 的 schema、workspace 默认值和 `scope: global` 显式写入。若官方工具层没有可在纯 Node 下隔离的构造器，则至少对 `createGlossaryToolHandlers(store, workspaceOf)` 的四个 handler 写 `node:test`。

- [ ] **步骤 3：实现 host integration**

在 `index.js` 保留现有 `ctx.skills.register`。用 `$DSH_HOME/superpowers/glossary.sqlite` 初始化 store，权限为 owner-only。按步骤 1 发现的真实 seam：

- 注册四个模型工具；
- 从当前 session/workspace 导出 canonical workspace key；
- 为每次 prompt 拉取 `global + workspace` entries；
- 使用 `injectGlossary` 仅替换当轮用户消息文本；
- 在无 workspace 时将 workspace key 固定为 `global` 以外的空值，且只扫描 global scope。

工具不得接受 SQL、数据库路径、shell 参数或任意 scope 以外的字段。

- [ ] **步骤 4：运行 targeted checks**

运行：

```bash
node --check index.js
node --test tests/glossary-store.test.js tests/glossary-match.test.js tests/glossary-tools.test.js
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add index.js lib/glossary-tools.js tests/glossary-tools.test.js
git commit -m "feat: expose glossary tools and prompt context"
```

### 任务 4：实现同源 Glossary HTTP API

**文件：**
- 创建：`lib/glossary-routes.js`
- 修改：`index.js`

- [ ] **步骤 1：编写 API 路由测试**

对一个 fake webServer 捕获 route handler。验证缺少或不匹配 `Origin`/`Host` 的写请求返回 403，GET list 返回正确 scope 数据，POST/PUT/DELETE/move 的非法 body 返回 400。

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test tests/glossary-routes.test.js`

预期：FAIL，报错缺少 routes module。

- [ ] **步骤 3：实现最小 API**

注册以下精确路径，全部返回 `cache-control: no-store` JSON：

```text
GET    /superpowers/glossary?scope=global|workspace&workspace=<path>
POST   /superpowers/glossary
PUT    /superpowers/glossary/:id
DELETE /superpowers/glossary/:id
POST   /superpowers/glossary/:id/move
```

所有 mutation 要求 Origin 与 Host 相同，body 最大 16 KiB，只允许计划中定义的字段。

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test tests/glossary-routes.test.js`

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add lib/glossary-routes.js tests/glossary-routes.test.js index.js
git commit -m "feat: add glossary management API"
```

### 任务 5：实现 Superpowers Web Tab

**文件：**
- 创建：`client/index.tsx`
- 创建：`client/GlossarySection.tsx`
- 创建：`client/glossary-api.ts`
- 创建：`client/glossary.css`
- 修改：`package.json`

- [ ] **步骤 1：编写 client smoke test**

用 jsdom/React testing library 渲染 GlossarySection，断言 Global / Current workspace tabs、创建按钮和空状态；mock API，断言点击 promote 发出 `POST /superpowers/glossary/:id/move` 且 body `{ scope: 'global' }`。

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test:web -- --run client/GlossarySection.test.tsx`

预期：FAIL，组件尚不存在。

- [ ] **步骤 3：实现页面与 client bundle**

按 dsh-market 的 `settings.section` 注册模式，新增 label 为 `Superpowers` 的设置页。页面有 Global 和 Current workspace tab、搜索输入、列表、编辑表单、删除按钮及 move action。workspace 不可用时禁用 workspace tab 并解释原因。所有 mutation 后重新 fetch，显示 host API 的错误文本。

只写必要布局 CSS；不引入新的设计系统或 UI 框架。构建输出 `client/client.js`，`package.json` 的 `dsh.client` 声明 `platform: web` 与所需 inject；导出 `./client`。

- [ ] **步骤 4：运行 client 测试与构建**

运行：

```bash
npm run test:web -- --run client/GlossarySection.test.tsx
npm run build:client
```

预期：PASS，且 `client/client.js` 存在。

- [ ] **步骤 5：Commit**

```bash
git add package.json client
 git commit -m "feat: add Superpowers glossary settings tab"
```

### 任务 6：在 dev 的 DSH 实际安装验证并发布修复版本

**文件：**
- 修改：`README.md`
- 修改：`package.json`

- [ ] **步骤 1：补充 README**

写明全局/工作区范围、匹配仅注入当前用户消息、模型术语工具和 Web 管理入口；不承诺自动语义匹配或跨 DSH 实例同步。

- [ ] **步骤 2：发布前验证包内容**

运行：

```bash
npm pack --dry-run
node --check index.js
node --test tests/*.test.js
```

预期：包包含 host、client、skills、LICENSE、UPSTREAM-LICENSE，所有测试通过。

- [ ] **步骤 3：在 dev 安装 tarball 并验证**

通过本机 Clash 反向 SSH 代理在 `dev` 更新 profile 包，重启 `dsh-web`。在浏览器经 `http://127.0.0.1:13080`：新增一个 workspace 术语、发起同名用户问题、确认 DSH 看到一次术语说明；移动至 global 后切换另一个 workspace，确认仍可见。

- [ ] **步骤 4：发布版本和推送**

将版本从 `0.1.0` 升至下一未发布 patch 版本，提交并推送：

```bash
git add README.md package.json
git commit -m "feat: add glossary capability"
git push origin main
npm publish --access public
```

预期：npm registry 返回新版本，`dsh plugin --profile web add dsh-superpowers-zh@<version>` 能安装。
