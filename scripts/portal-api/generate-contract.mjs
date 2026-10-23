import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
if (args.some((a,i)=>a !== '--check' && a !== '--out' && args[i-1] !== '--out')) throw new Error('Unknown argument');
const outIndex = args.indexOf('--out');
if (outIndex >= 0 && !args[outIndex+1]) throw new Error('Missing output directory');
const out = path.resolve(outIndex<0 ? path.join(root,'artifacts/portal-api/v1') : args[outIndex+1]);
const files = {};
const bytes = {};
for (const name of ['v1.ts','sdk.server.ts']) {
 bytes[name] = await readFile(path.join(root,'contracts/portal-api',name));
 files[name] = createHash('sha256').update(bytes[name]).digest('hex');
}
const source = bytes['v1.ts'].toString();
const contractVersion = source.match(/export const CONTRACT_VERSION = '([^']+)';/)?.[1];
const major = Number(source.match(/export const CONTRACT_MAJOR = (\d+);/)?.[1]);
if(!contractVersion || !major || Number(contractVersion.split('.')[0])!==major) throw new Error('Invalid contract version');
const operations = [...source.matchAll(/\{\s*id:\s*'([^']+)',\s*method:\s*'([^']+)',\s*path:\s*'([^']+)',\s*authMode:\s*'([^']+)'\s*\}/g)].map(([,id,method,path,authMode])=>({id,method,path,authMode}));
if(operations.length!==24) throw new Error('Expected 24 explicit remote operations (30 flows including 6 local/inactive)');
bytes['manifest.json'] = Buffer.from(JSON.stringify({contractVersion,major,sourceRevision:'portal-api-canonica-20261023-aria-v1.0',files,operations},null,2)+'\n');
if(!args.includes('--check')) await mkdir(out,{recursive:true});
for(const [name,content] of Object.entries(bytes)) {
 if(args.includes('--check')) {if(!(await readFile(path.join(out,name))).equals(content)) throw new Error('Contract drift: '+name);}
 else await writeFile(path.join(out,name),content);
}
console.info(args.includes('--check')?'Contract verified':'Contract generated');
