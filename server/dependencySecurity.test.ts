import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const root=createRequire(import.meta.url);
const lock=readFileSync(path.resolve(import.meta.dirname,'../pnpm-lock.yaml'),'utf8');
function from(parent:string){return createRequire(root.resolve(parent));}
describe('critical dependency remediation',()=>{
 it('locks official same-major fixes and removes the vulnerable test pool',()=>{
  for(const id of ['dompurify@3.4.17','fast-xml-parser@5.11.2','proxy-addr@2.0.8','tar@7.5.22','vitest@4.1.10'])expect(lock).toContain('  '+id+':');
  expect(lock).not.toMatch(/^  tinypool@/m);
  expect(lock).not.toMatch(/^  vitest@2\./m);
  expect(lock).toContain('wouter@3.7.1:');
  expect(lock).toContain('path: patches/wouter@3.7.1.patch');
 });
 it('keeps pnpm 10.4 and newer workspace override settings identical',()=>{
  const p=JSON.parse(readFileSync(path.resolve(import.meta.dirname,'../package.json'),'utf8'));
  const workspace=readFileSync(path.resolve(import.meta.dirname,'../pnpm-workspace.yaml'),'utf8');
  for(const [name,version] of Object.entries(p.pnpm.overrides))expect(workspace).toContain(`${name}: ${version}`);
 });
 it('rejects the IPv4-mapped IPv6 short-prefix trust bypass',()=>{
  const proxyaddr=from('express')('proxy-addr');
  const trust=proxyaddr.compile(['::ffff:10.0.0.0/8']);
  expect(trust('203.0.113.1',0)).toBe(false);
  expect(proxyaddr.compile(['10.0.0.0/8'])('10.1.2.3',0)).toBe(true);
 });
 it('does not let dotted DOCTYPE names replace built-in XML entities',()=>{
  const builder=from('@aws-sdk/client-s3').resolve('@aws-sdk/xml-builder');
  const {XMLParser}=createRequire(builder)('fast-xml-parser');
  const xml='<!DOCTYPE foo [<!ENTITY l. "INJECTED">]><root>Hello &lt;b&gt;World&lt;/b&gt;</root>';
  const result=new XMLParser().parse(xml);
  expect(result.root).not.toContain('INJECTED');
  expect(result.root).toBe('Hello <b>World</b>');
 });
});
