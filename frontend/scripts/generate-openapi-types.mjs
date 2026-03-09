#!/usr/bin/env node
/**
 * Generate TypeScript types from OpenAPI schema.
 * Usage: node scripts/generate-openapi-types.mjs
 * 
 * Reads openapi.json from project root (or fetches from backend)
 * and writes generated types to src/lib/api/openapi.ts
 * 
 * For full generation, install: npm install -D openapi-typescript
 * Then run: npx openapi-typescript openapi.json -o lib/api/openapi.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

console.log('Transfer Window Simulator — OpenAPI Type Generator');
console.log('===================================================');

let schema;

// Try loading local openapi.json first
const localPath = join(root, 'openapi.json');
if (existsSync(localPath)) {
  console.log('📄 Loading from local openapi.json...');
  schema = JSON.parse(readFileSync(localPath, 'utf8'));
} else {
  // Try fetching from backend
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || 'http://localhost:8000';
  console.log(`🌐 Fetching from ${BACKEND}/openapi.json...`);
  try {
    const res = await fetch(`${BACKEND}/openapi.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    schema = await res.json();
  } catch (e) {
    console.error('❌ Failed to fetch schema:', e.message);
    console.log('💡 Place your openapi.json in the project root and run again.');
    process.exit(1);
  }
}

console.log(`✅ Schema loaded: ${schema.info?.title} v${schema.info?.version}`);

// Simple type generator from JSON Schema
function schemaToTs(schema, name, schemas) {
  if (!schema) return 'unknown';
  if (schema.$ref) {
    const ref = schema.$ref.split('/').pop();
    return ref;
  }
  if (schema.anyOf) {
    return schema.anyOf.map(s => schemaToTs(s, name, schemas)).join(' | ');
  }
  if (schema.allOf) {
    return schema.allOf.map(s => schemaToTs(s, name, schemas)).join(' & ');
  }
  switch (schema.type) {
    case 'string':
      if (schema.enum) return schema.enum.map(v => `'${v}'`).join(' | ');
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `${schemaToTs(schema.items, name, schemas)}[]`;
    case 'object':
      if (schema.properties) {
        const props = Object.entries(schema.properties).map(([k, v]) => {
          const required = schema.required?.includes(k);
          const nullable = v.anyOf?.some(s => s.type === 'null') ?? false;
          return `  ${k}${required ? '' : '?'}: ${schemaToTs(v, k, schemas)}${nullable ? ' | null' : ''};`;
        });
        return `{\n${props.join('\n')}\n}`;
      }
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

const components = schema.components?.schemas ?? {};
let output = `// AUTO-GENERATED from openapi.json\n// Run: npm run generate-types\n\n`;

for (const [name, def] of Object.entries(components)) {
  if (def.enum) {
    output += `export type ${name} = ${def.enum.map(v => `'${v}'`).join(' | ')};\n\n`;
  } else if (def.type === 'object' || def.properties) {
    const props = Object.entries(def.properties ?? {}).map(([k, v]) => {
      const required = def.required?.includes(k);
      const ts = schemaToTs(v, k, components);
      return `  ${k}${required ? '' : '?'}: ${ts};`;
    });
    output += `export interface ${name} {\n${props.join('\n')}\n}\n\n`;
  }
}

const outPath = join(root, 'lib', 'api', 'openapi-generated.ts');
writeFileSync(outPath, output);
console.log(`✅ Types written to lib/api/openapi-generated.ts`);
console.log(`📝 ${Object.keys(components).length} schemas processed`);
