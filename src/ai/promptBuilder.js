// promptBuilder.js — AI 提示词构建

const BASE_SCHEMA_PROMPT = `你是一个资深 MySQL 数据库架构师。请严格按下面的 JSON 格式返回结果，不要包含任何额外解释。

字段类型必须从以下列表中选择：
int, bigint, smallint, tinyint, mediumint, decimal, float, double, varchar, char, text, longtext, mediumtext, tinytext, date, datetime, timestamp, time, year, json, blob, enum, set, boolean, serial

每个字段对象包含：
- name: 字段名（小写英文，下划线分隔）
- type: 数据类型
- length: 长度或精度（如 255、10,2；不需要时为空字符串）
- notNull: 是否非空（布尔）
- default: 默认值（不需要时为空字符串）
- comment: 字段中文注释
- isPrimary: 是否主键（布尔）
- check: CHECK 约束表达式（不需要时为空字符串）

每个索引对象包含：
- name: 索引名
- type: 普通索引 | 唯一索引 | 全文索引
- columns: 字段名数组

每个外键对象包含：
- fromTable: 子表名
- fromColumn: 子表字段名
- toTable: 父表名
- toColumn: 父表字段名
- onDelete: CASCADE | RESTRICT | SET NULL | NO ACTION
- onUpdate: CASCADE | RESTRICT | SET NULL | NO ACTION

返回格式：
{
  "tables": [
    {
      "name": "表名",
      "domain": "主题域名称（可选）",
      "columns": [...],
      "indexes": [...]
    }
  ],
  "foreignKeys": [...]
}`;

export function buildCreateTablePrompt(description, existingTables = []) {
  const context = existingTables.length
    ? `\n当前项目已有表：${existingTables.map(t => t.name).join(', ')}。请避免重复创建同名表，如果用户要求扩展已有表，请直接返回已有表名进行扩展。`
    : '';

  return [
    { role: 'system', content: BASE_SCHEMA_PROMPT },
    { role: 'user', content: `请根据以下描述设计数据库表结构：\n${description}${context}` },
  ];
}

export function buildModifyTablePrompt(table, requirement) {
  const schema = JSON.stringify(table, null, 2);
  return [
    { role: 'system', content: BASE_SCHEMA_PROMPT + '\n你只返回一张表的完整 JSON（包含 columns 和 indexes），不允许改变表名和已有字段的语义，只根据需求做增删改。' },
    { role: 'user', content: `现有表结构：\n${schema}\n\n请根据以下需求修改该表：\n${requirement}` },
  ];
}

export function buildModifyColumnPrompt(table, column, requirement) {
  const schema = JSON.stringify({ tableName: table.name, column }, null, 2);
  return [
    { role: 'system', content: BASE_SCHEMA_PROMPT + '\n你只返回一个字段对象的完整 JSON，不允许改变字段名，只根据需求优化类型、长度、默认值、注释、约束等属性。' },
    { role: 'user', content: `现有字段：\n${schema}\n\n请根据以下需求优化该字段：\n${requirement}` },
  ];
}

export function buildAutoConnectPrompt(tables) {
  const schema = JSON.stringify(tables.map(t => ({ name: t.name, columns: t.columns })), null, 2);
  return [
    { role: 'system', content: BASE_SCHEMA_PROMPT + '\n你只返回 foreignKeys 数组，不要返回 tables。基于字段命名和业务语义推断外键关系。' },
    { role: 'user', content: `请分析以下表结构，自动推断合理的外键关系（只推断明确的父子关系，避免猜测）：\n${schema}` },
  ];
}
