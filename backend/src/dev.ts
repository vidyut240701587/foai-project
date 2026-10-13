import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.resolve(backendDirectory, '.env') });
dotenv.config({ path: path.resolve(backendDirectory, '..', '.env') });

await import('./index.js');
