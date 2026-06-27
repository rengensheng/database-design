// sql.js — SQL生成（完整建表脚本、增量迁移SQL）

import { store } from './store.js';

export function generateFullSQL(state = store.state) {
  const lines = [];
  const tables = state.tables || [];

  // Group foreign keys for later
  const allFKs = [];

  tables.forEach(table => {
    const colDefs = [];
    const pkCols = [];

    table.columns.forEach(col => {
      let def = `  \`${col.name}\` `;
      const typeWithLen = col.length ? `${col.type}(${col.length})` : col.type;
      def += typeWithLen;
      if (col.notNull) def += ' NOT NULL';
      if (col.default !== '' && col.default != null) {
        const isFunc = ['CURRENT_TIMESTAMP'].some(f => col.default.toUpperCase().includes(f));
        if (isFunc) def += ` DEFAULT ${col.default}`;
        else if (col.type === 'int' || col.type === 'bigint' || col.type === 'tinyint' || col.type === 'smallint' || col.type === 'mediumint' || col.type === 'decimal' || col.type === 'float' || col.type === 'double') def += ` DEFAULT ${col.default}`;
        else def += ` DEFAULT '${col.default}'`;
      }
      if (col.isPrimary) pkCols.push(`\`${col.name}\``);
      if (col.comment) def += ` COMMENT '${col.comment}'`;
      if (col.check) def += ` CHECK (${col.check})`;
      colDefs.push(def);
    });

    // Primary key
    if (pkCols.length > 0) {
      colDefs.push(`  PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // Indexes
    table.indexes.forEach(idx => {
      const colNames = idx.columns.map(cId => {
        const c = table.columns.find(c => c.id === cId);
        return c ? `\`${c.name}\`` : '?';
      }).join(', ');
      if (idx.type === '唯一索引') {
        colDefs.push(`  UNIQUE INDEX \`${idx.name}\` (${colNames})`);
      } else if (idx.type === '全文索引') {
        colDefs.push(`  FULLTEXT INDEX \`${idx.name}\` (${colNames})`);
      } else {
        colDefs.push(`  INDEX \`${idx.name}\` (${colNames})`);
      }
    });

    lines.push(`CREATE TABLE \`${table.name}\` (`);
    lines.push(colDefs.join(',\n'));

    // Collect FKs
    table.foreignKeys.forEach(fk => {
      const fromCol = table.columns.find(c => c.id === fk.fromColumn);
      const toTable = tables.find(t => t.id === fk.toTable);
      const toCol = toTable?.columns.find(c => c.id === fk.toColumn);
      if (fromCol && toTable && toCol) {
        allFKs.push({
          fromTable: table.name,
          fromCol: fromCol.name,
          toTable: toTable.name,
          toCol: toCol.name,
          onDelete: fk.onDelete,
          onUpdate: fk.onUpdate,
        });
        colDefs.push(`  CONSTRAINT \`fk_${table.name}_${fromCol.name}\` FOREIGN KEY (\`${fromCol.name}\`) REFERENCES \`${toTable.name}\` (\`${toCol.name}\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`);
      }
    });

    lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    lines.push('');
  });

  return lines.join('\n');
}

export function generateIncrementalSQL(oldState, newState) {
  const lines = [];
  const oldTables = new Map((oldState.tables || []).map(t => [t.name, t]));
  const newTables = new Map((newState.tables || []).map(t => [t.name, t]));

  // Dropped tables
  for (const [name, table] of oldTables) {
    if (!newTables.has(name)) {
      lines.push(`DROP TABLE IF EXISTS \`${name}\`;`);
    }
  }

  // New tables (generate full CREATE)
  for (const [name, table] of newTables) {
    if (!oldTables.has(name)) {
      const colDefs = [];
      const pkCols = [];
      table.columns.forEach(col => {
        let def = `  \`${col.name}\` `;
        const typeWithLen = col.length ? `${col.type}(${col.length})` : col.type;
        def += typeWithLen;
        if (col.notNull) def += ' NOT NULL';
        if (col.default) {
          const isFunc = col.default.toUpperCase().includes('CURRENT_TIMESTAMP');
          def += isFunc ? ` DEFAULT ${col.default}` : ` DEFAULT '${col.default}'`;
        }
        if (col.isPrimary) pkCols.push(`\`${col.name}\``);
        if (col.comment) def += ` COMMENT '${col.comment}'`;
        colDefs.push(def);
      });
      if (pkCols.length > 0) colDefs.push(`  PRIMARY KEY (${pkCols.join(', ')})`);
      lines.push(`CREATE TABLE \`${name}\` (`);
      lines.push(colDefs.join(',\n'));
      lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
      lines.push('');
    }
  }

  // Modified tables
  for (const [name, newTable] of newTables) {
    const oldTable = oldTables.get(name);
    if (!oldTable) continue;

    const oldCols = new Map(oldTable.columns.map(c => [c.name, c]));
    const newCols = new Map(newTable.columns.map(c => [c.name, c]));

    // Dropped columns
    for (const [colName, col] of oldCols) {
      if (!newCols.has(colName)) {
        lines.push(`ALTER TABLE \`${name}\` DROP COLUMN \`${colName}\`;`);
      }
    }

    // Added columns
    for (const [colName, col] of newCols) {
      if (!oldCols.has(colName)) {
        let def = `\`${colName}\` `;
        const typeWithLen = col.length ? `${col.type}(${col.length})` : col.type;
        def += typeWithLen;
        if (col.notNull) def += ' NOT NULL';
        if (col.default) {
          const isFunc = col.default.toUpperCase().includes('CURRENT_TIMESTAMP');
          def += isFunc ? ` DEFAULT ${col.default}` : ` DEFAULT '${col.default}'`;
        }
        if (col.comment) def += ` COMMENT '${col.comment}'`;
        lines.push(`ALTER TABLE \`${name}\` ADD COLUMN ${def};`);
      }
    }

    // Modified columns
    for (const [colName, newCol] of newCols) {
      const oldCol = oldCols.get(colName);
      if (!oldCol) continue;
      const oldTypeStr = oldCol.length ? `${oldCol.type}(${oldCol.length})` : oldCol.type;
      const newTypeStr = newCol.length ? `${newCol.type}(${newCol.length})` : newCol.type;

      if (oldTypeStr !== newTypeStr || oldCol.notNull !== newCol.notNull || oldCol.default !== newCol.default || oldCol.comment !== newCol.comment) {
        let def = `\`${colName}\` ${newTypeStr}`;
        if (newCol.notNull) def += ' NOT NULL';
        if (newCol.default) {
          const isFunc = newCol.default.toUpperCase().includes('CURRENT_TIMESTAMP');
          def += isFunc ? ` DEFAULT ${newCol.default}` : ` DEFAULT '${newCol.default}'`;
        }
        if (newCol.comment) def += ` COMMENT '${newCol.comment}'`;
        lines.push(`ALTER TABLE \`${name}\` MODIFY COLUMN ${def};`);
      }
    }

    // Index changes (simplified)
    const oldIdx = new Map(oldTable.indexes.map(i => [i.name, i]));
    const newIdx = new Map(newTable.indexes.map(i => [i.name, i]));

    for (const [idxName] of oldIdx) {
      if (!newIdx.has(idxName)) {
        lines.push(`ALTER TABLE \`${name}\` DROP INDEX \`${idxName}\`;`);
      }
    }

    for (const [idxName, idx] of newIdx) {
      if (!oldIdx.has(idxName)) {
        const colNames = idx.columns.map(cId => {
          const c = newTable.columns.find(c => c.id === cId);
          return c ? `\`${c.name}\`` : '?';
        }).join(', ');
        const idxType = idx.type === '唯一索引' ? 'UNIQUE INDEX' : idx.type === '全文索引' ? 'FULLTEXT INDEX' : 'INDEX';
        lines.push(`ALTER TABLE \`${name}\` ADD ${idxType} \`${idxName}\` (${colNames});`);
      }
    }

    // FK changes (simplified - just check by fromColumn+toTable)
    const oldFks = new Map(oldTable.foreignKeys.map(f => {
      const c = oldTable.columns.find(c => c.id === f.fromColumn);
      return [c?.name + '->' + f.toTable, f];
    }));
    const newFks = new Map(newTable.foreignKeys.map(f => {
      const c = newTable.columns.find(c => c.id === f.fromColumn);
      return [c?.name + '->' + f.toTable, f];
    }));

    for (const [key] of oldFks) {
      if (!newFks.has(key)) {
        const fromCol = oldTable.columns.find(c => c.id === oldFks.get(key).fromColumn);
        lines.push(`ALTER TABLE \`${name}\` DROP FOREIGN KEY \`fk_${name}_${fromCol?.name}\`;`);
      }
    }
  }

  if (lines.length === 0) {
    lines.push('-- No changes detected');
  }

  return lines.join('\n');
}
