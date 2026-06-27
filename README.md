# DBForge — Database Design Studio

一个可视化的数据库设计工具，支持拖拽建模、外键连线、SQL生成、版本比对、逆向工程等功能。

## ✨ 功能特性

### 第一阶段：核心建模与拖拽连线
- ✅ **无限画布**：支持缩放、平移、网格对齐
- ✅ **表组件**：拖拽创建，圆角矩形卡片，可编辑表名
- ✅ **字段管理**：添加/删除字段，支持字段名、MySQL数据类型、长度、非空、默认值、注释
- ✅ **主键标识**：每个字段可勾选主键，支持联合主键
- ✅ **连线设外键**：从字段左侧或右侧连接桩拖拽到目标表主键字段建立外键（非主键拒绝连接）
- ✅ **正交自动布线**：连线走直角拐弯，自动选择最优起始侧，避免穿过表格
- ✅ **方向箭头**：连线终点显示箭头标识外键引用方向（子表→父表）
- ✅ **外键属性编辑**：双击连线设置 ON DELETE / ON UPDATE 规则

### 第二阶段：高阶建模与智能辅助
- ✅ **主题域分组**：左侧主题域管理器，不同背景色区分，支持折叠/展开
- ✅ **智能字段补齐**：输入 `created_at` 自动推荐 `datetime` + `CURRENT_TIMESTAMP`；输入 `is_deleted` 自动推荐 `tinyint(1)` + 默认值 `0`
- ✅ **索引管理**：支持普通索引、唯一索引、全文索引，可视化选择索引字段
- ✅ **CHECK约束**：字段属性中可输入CHECK表达式

### 第三阶段：工程化能力与差异比对
- ✅ **版本比对**：导入另一个JSON模型文件，自动对比表结构差异
- ✅ **增量迁移SQL**：一键生成 ALTER TABLE ADD/DROP/MODIFY COLUMN 语句
- ✅ **SQL预览与导出**：生成完整建表脚本（CREATE TABLE + 索引 + 外键）
- ✅ **数据字典**：导出Markdown格式数据字典，支持复制到剪贴板

### 第四阶段：逆向工程与团队协作
- ✅ **逆向工程**：粘贴 SHOW CREATE TABLE SQL，自动解析生成表和字段
- ✅ **差异高亮**：逆向工程导入的表显示"DB"图标
- ✅ **自动保存**：所有操作实时保存在 localStorage
- ✅ **项目导入导出**：支持 .json 项目文件导入导出

### 第五阶段：AI 辅助建模（默认 DeepSeek）
- ✅ **AI 建表**：自然语言描述需求，AI 自动生成多张表、字段、索引并落布到画布
- ✅ **AI 改表**：选中表后用自然语言描述修改，AI 增量调整字段与索引
- ✅ **AI 改字段**：选中字段后用自然语言优化类型、约束、注释等
- ✅ **AI 自动连线**：AI 分析当前所有表，自动推断并创建外键关系
- ✅ **AI 设置**：配置 DeepSeek API Key、Base URL、模型与 Temperature
## 🎨 设计系统

采用 FLAW Industrial Design System — 工业暗色风格：
- 核心色：背景 `#161618` / 面板 `#1e1e22` / 强调色 `#f0a500`（警示橙）
- 字体：JetBrains Mono（代码/标题）+ Inter（正文）
- 图标：Lucide Icons（1.5px 描边）
- 支持亮色/暗色主题切换

## 🚀 快速开始

### 方式一：纯前端运行（开发模式）

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
# 然后在浏览器打开 http://localhost:1420
```

### 方式二：构建生产版本

```bash
npm run build
# 产物在 dist/ 目录，可直接用浏览器打开
```

### 方式三：Tauri 打包为 macOS App

```bash
# 安装 Tauri CLI
npm install -g @tauri-apps/cli

# 开发模式（带热重载）
npm run tauri dev

# 打包为 macOS 应用
npm run tauri build
# 产物在 src-tauri/target/release/bundle/
```

## 🤖 AI 功能使用说明

DBForge 默认接入 DeepSeek 大模型，使用 AI 功能前请先配置 API Key：

1. 点击工具栏 **AI设置** 按钮
2. 填入你的 DeepSeek API Key（格式如 `sk-xxxxxxxx`）
3. 保持默认 Base URL `https://api.deepseek.com` 和模型 `deepseek-chat`
4. 点击保存

配置完成后即可使用：
- **AI建表**：点击工具栏按钮，输入需求描述，生成后点击"应用到画布"
- **AI改表**：选中表，在右侧属性面板点击"AI 改表"
- **AI改字段**：选中字段，在右侧属性面板点击"AI 优化字段"
- **AI连线**：点击工具栏"AI连线"，AI 会自动推断外键关系并创建连线

> 注意：AI 功能通过浏览器 `fetch` 直接调用 DeepSeek API。在 Tauri 桌面端无 CORS 限制；在浏览器开发模式下，请确保 DeepSeek 服务允许跨域，或使用支持跨域的代理。

### Tauri 环境要求

- Node.js >= 18
- Rust (通过 rustup 安装)
- Xcode Command Line Tools (macOS)

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Xcode CLI tools
xcode-select --install
```

## 📁 项目结构

```
database-design/
├── index.html              # 应用入口 HTML
├── package.json            # Node 依赖配置
├── vite.config.js          # Vite 构建配置
├── styles/
│   └── main.css            # FLAW Design System 完整样式
├── src/
│   ├── main.js             # 应用入口，组装所有模块
│   ├── store.js            # 数据存储与状态管理 (localStorage)
│   ├── canvas.js           # 画布交互（缩放/平移/网格）
│   ├── table.js            # 表格组件渲染与拖拽
│   ├── connection.js       # 外键连线 SVG 渲染
│   ├── sidebar.js          # 左侧主题域管理器
│   ├── properties.js       # 右侧属性面板
│   ├── modal.js            # 模态框系统
│   ├── toast.js            # Toast 通知
│   ├── sql.js              # SQL 生成（建表脚本 + 增量迁移）
│   ├── parser.js           # CREATE TABLE SQL 解析器（逆向工程）
│   ├── diff.js             # 版本差异比对
│   ├── dict.js             # 数据字典生成
│   ├── utils.js            # 工具函数、MySQL类型、智能补全映射
│   └── ai/                 # AI 功能模块
│       ├── index.js        # AI 模块入口
│       ├── aiConfig.js     # AI 配置管理 (localStorage)
│       ├── deepseekClient.js # DeepSeek API 客户端
│       ├── promptBuilder.js  # AI 提示词构建
│       ├── aiService.js    # AI 业务服务层
│       └── aiUI.js         # AI 功能 UI 层
├── src-tauri/
│   ├── Cargo.toml          # Rust 依赖
│   ├── tauri.conf.json     # Tauri 配置
│   ├── build.rs            # 构建脚本
│   ├── src/main.rs         # Rust 入口
│   ├── capabilities/       # Tauri 权限配置
│   └── icons/              # 应用图标 (icns/ico/png)
└── generate_icons.py       # 图标生成脚本
```

## 💾 数据模型

所有数据使用统一的 JSON 结构存储：

```json
{
  "projectName": "电商系统",
  "domains": [{ "id": "d1", "name": "用户域", "color": "#e6f7ff" }],
  "tables": [{
    "id": "t1", "name": "user", "domainId": "d1",
    "x": 100, "y": 150,
    "columns": [{ "id": "c1", "name": "id", "type": "int", "length": "11", "notNull": true, "default": "", "comment": "用户ID", "isPrimary": true, "check": "" }],
    "indexes": [{ "id": "i1", "name": "idx_name", "type": "普通索引", "columns": ["c2"] }],
    "foreignKeys": [{ "id": "fk1", "fromColumn": "c4", "toTable": "t1", "toColumn": "c1", "onDelete": "CASCADE", "onUpdate": "RESTRICT" }]
  }],
  "version": 1,
  "lastSaved": "2026-06-27T10:00:00Z"
}
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Delete` / `Backspace` | 删除选中的表或外键 |
| `鼠标滚轮` | 缩放画布 |
| `空白处拖拽` | 平移画布 |
| `表头拖拽` | 移动表格位置 |
| `双击字段名` | 编辑字段名 |
| `双击连线` | 编辑外键属性 |

## 📝 许可证

MIT License