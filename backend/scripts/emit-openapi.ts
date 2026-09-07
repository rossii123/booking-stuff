import { writeFileSync } from 'node:fs';
import path from 'node:path';
// Importing the app module registers every route's schema with the registry.
import '../src/app';
import { buildOpenApiDocument } from '../src/lib/openapi';

const out = path.resolve(__dirname, '../openapi.json');
writeFileSync(out, JSON.stringify(buildOpenApiDocument('http://localhost:5006'), null, 2) + '\n');
console.log(`OpenAPI document written to ${out}`);
