import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {readFile,writeFile} from 'node:fs/promises';
const root='/data/openclaw/workspaces/roscoe-supervisor/dashboard/quest-update-plan-2026-09-14/implementation/code-kg-review';
const bindings=JSON.parse(await readFile(root+'/preserved-work-bindings.json','utf8'));
const proof=[];
for(const binding of bindings){
 const transport=new StdioClientTransport({command:'/data/bin/code-kg',args:['mcp'],cwd:binding.projectRoot,stderr:'pipe'});
 const client=new Client({name:'roscoe-installation-verification',version:'1.0.0'});
 try{
  await client.connect(transport);const tools=await client.listTools();const names=tools.tools.map(t=>t.name).sort();
  for(const name of ['codekg_search','codekg_work_seal','codekg_work_adopt','codekg_work_close'])if(!names.includes(name))throw Error('Missing '+name);
  const denial=await client.callTool({name:'codekg_work_close',arguments:{id:'ck-installation-negative-probe',force:true}});
  if(!denial.isError || !JSON.stringify(denial).includes('Only the operator may authorize'))throw Error('Worker override not refused');
  proof.push({package:binding.package,projectRoot:binding.projectRoot,toolCount:names.length,tools:names,workerOverrideRefused:true});
  await writeFile(root+'/installed-worker-mcp-proof.json',JSON.stringify(proof,null,2)+'\n');
  console.log(JSON.stringify({package:binding.package,toolCount:names.length,workerOverrideRefused:true}));
 }finally{await client.close();await transport.close();}
}
