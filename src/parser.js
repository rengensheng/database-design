// parser.js — SHOW CREATE TABLE SQL解析器（逆向工程）

import { uid } from './utils.js';

/**
 * Parse SHOW CREATE TABLE SQL and extract table structure
 * Supports basic MySQL CREATE TABLE syntax
 */
export function parseCreateTableSQL(sql) {
  const results = [];
  const statements = sql.split(/;(?!\s*['"`])/);

  for (const stmtRaw of statements) {
    const stmt = stmtRaw.trim();
    if (!stmt) continue;

    // Skip non-CREATE statements
    if (!stmt.match(/^CREATE\s+TABLE/i)) continue;

    const result = parseSingleTable(stmt);
    if (result) results.push(result);
  }

  return results;
}

function parseSingleTable(stmt) {
  // Extract table name
  const tableMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*)\)\s*(ENGINE|DEFAULT|CHARSET|;|$)/i);
  if (!tableMatch) return null;

  const tableName = tableMatch[1];
  const body = tableMatch[2];

  const table = {
    id: uid('t'),
    name: tableName,
    domainId: null,
    x: 100,
    y: 100,
    isFromDB: true,
    columns: [],
    indexes: [],
    foreignKeys: [],
  };

  // Parse columns and constraints from body
  const lines = splitColumns(body);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // PRIMARY KEY
    const pkMatch = trimmed.match(/^PRIMARY\s+KEY\s*\((.+?)\)/i);
    if (pkMatch) {
      const pkColNames = pkMatch[1].split(',').map(s => s.replace(/`/g, '').trim());
      pkColNames.forEach(name => {
        const col = table.columns.find(c => c.name === name);
        if (col) col.isPrimary = true;
      });
      continue;
    }

    // UNIQUE INDEX/KEY
    const uniqueMatch = trimmed.match(/^UNIQUE\s+(?:INDEX|KEY)\s+`?(\w+)`?\s*\((.+?)\)/i);
    if (uniqueMatch) {
      const colNames = uniqueMatch[2].split(',').map(s => s.replace(/`/g, '').trim());
      const colIds = colNames.map(n => {
        const c = table.columns.find(c => c.name === n);
        return c ? c.id : null;
      }).filter(Boolean);
      table.indexes.push({ id: uid('i'), name: uniqueMatch[1], type: '唯一索引', columns: colIds });
      continue;
    }

    // FULLTEXT INDEX/KEY
    const fulltextMatch = trimmed.match(/^FULLTEXT\s+(?:INDEX|KEY)\s+`?(\w+)`?\s*\((.+?)\)/i);
    if (fulltextMatch) {
      const colNames = fulltextMatch[2].split(',').map(s => s.replace(/`/g, '').trim());
      const colIds = colNames.map(n => {
        const c = table.columns.find(c => c.name === n);
        return c ? c.id : null;
      }).filter(Boolean);
      table.indexes.push({ id: uid('i'), name: fulltextMatch[1], type: '全文索引', columns: colIds });
      continue;
    }

    // INDEX/KEY
    const indexMatch = trimmed.match(/^(?:INDEX|KEY)\s+`?(\w+)`?\s*\((.+?)\)/i);
    if (indexMatch) {
      const colNames = indexMatch[2].split(',').map(s => s.replace(/`/g, '').trim());
      const colIds = colNames.map(n => {
        const c = table.columns.find(c => c.name === n);
        return c ? c.id : null;
      }).filter(Boolean);
      table.indexes.push({ id: uid('i'), name: indexMatch[1], type: '普通索引', columns: colIds });
      continue;
    }

    // FOREIGN KEY
    const fkMatch = trimmed.match(/^CONSTRAINT\s+`?(\w+)`?\s+FOREIGN\s+KEY\s*\((.+?)\)\s+REFERENCES\s+`?(\w+)`?\s*\((.+?)\)\s*(?:ON\s+DELETE\s+(\w+))?\s*(?:ON\s+UPDATE\s+(\w+))?/i);
    if (fkMatch) {
      const fromColName = fkMatch[2].replace(/`/g, '').trim();
      const toTableName = fkMatch[3];
      const toColName = fkMatch[4].replace(/`/g, '').trim();
      const fromCol = table.columns.find(c => c.name === fromColName);
      if (fromCol) {
        table.foreignKeys.push({
          id: uid('fk'),
          fromColumn: fromCol.id,
          toTable: null, // will be resolved after all tables are loaded
          toColumn: null,
          toTableName: toTableName,
          toColumnName: toColName,
          onDelete: (fkMatch[5] || 'RESTRICT').toUpperCase(),
          onUpdate: (fkMatch[6] || 'RESTRICT').toUpperCase(),
        });
      }
      continue;
    }

    // CHECK constraint
    const checkMatch = trimmed.match(/^CHECK\s*\((.+?)\)/i);
    if (checkMatch) {
      // Attach to last column (simplified)
      if (table.columns.length > 0) {
        table.columns[table.columns.length - 1].check = checkMatch[1];
      }
      continue;
    }

    // Regular column definition
    const col = parseColumn(trimmed);
    if (col) {
      table.columns.push(col);
    }
  }

  return table;
}

function splitColumns(body) {
  const lines = [];
  let current = '';
  let inParen = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (inString) {
      current += ch;
      if (ch === stringChar && body[i - 1] !== '\\') inString = false;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    if (ch === '(') inParen++;
    if (ch === ')') inParen--;

    if (ch === ',' && inParen === 0) {
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  return lines;
}

function parseColumn(line) {
  // Match: `col_name` TYPE(length) [modifiers...]
  const match = line.match(/^`?(\w+)`?\s+(\w+)(?:\s*\(([^)]+)\))?\s*(.*)/);
  if (!match) return null;

  const name = match[1];
  const type = match[2].toLowerCase();
  const length = match[3] || '';
  const rest = (match[4] || '').trim();

  // Skip if this is actually a constraint keyword
  if (['primary', 'unique', 'fulltext', 'index', 'key', 'constraint', 'foreign', 'check'].includes(type.toLowerCase())) {
    return null;
  }

  const col = {
    id: uid('c'),
    name,
    type,
    length,
    notNull: false,
    default: '',
    comment: '',
    isPrimary: false,
    check: '',
  };

  // Parse NOT NULL
  if (rest.match(/\bNOT\s+NULL\b/i)) col.notNull = true;

  // Parse DEFAULT
  const defaultMatch = rest.match(/\bDEFAULT\s+(?:'(.*?)'|"(.*?)"|(\w+(?:\(\))?))/i);
  if (defaultMatch) {
    col.default = defaultMatch[1] ?? defaultMatch[2] ?? defaultMatch[3] ?? '';
  }

  // Parse COMMENT
  const commentMatch = rest.match(/\bCOMMENT\s+'(.*?)'/i);
  if (commentMatch) col.comment = commentMatch[1];

  // Parse AUTO_INCREMENT as primary key hint
  if (rest.match(/\bAUTO_INCREMENT\b/i)) col.isPrimary = true;

  // Parse CHECK
  const checkMatch = rest.match(/\bCHECK\s*\((.+?)\)/i);
  if (checkMatch) col.check = checkMatch[1];

  return col;
}

/**
 * Resolve FK references after all tables are loaded
 */
export function resolveFKReferences(tables) {
  tables.forEach(table => {
    table.foreignKeys.forEach(fk => {
      if (fk.toTableName) {
        const targetTable = tables.find(t => t.name === fk.toTableName);
        if (targetTable) {
          fk.toTable = targetTable.id;
          const targetCol = targetTable.columns.find(c => c.name === fk.toColumnName);
          if (targetCol) {
            fk.toColumn = targetCol.id;
          }
        }
        delete fk.toTableName;
        delete fk.toColumnName;
      }
    });
  });
}
