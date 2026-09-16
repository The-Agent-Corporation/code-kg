import { defineToolPlugin } from 'openclaw/plugin-sdk/tool-plugin';
import manifest from './openclaw.plugin.json' with { type: 'json' };
import { createBridge, validateConfig, hostHookBudgets } from './bridge.mjs';
import { TOOL_NAMES, toolMetadata } from './definitions.mjs';

const bridges = new WeakMap();
const getBridge = (api) => {
  let bridge = bridges.get(api);
  if (!bridge) { bridge = createBridge(api); bridges.set(api, bridge); }
  return bridge;
};
const entry = defineToolPlugin({
  id: 'code-kg',
  name: 'Code-KG',
  description: manifest.description,
  configSchema: manifest.configSchema,
  activation: { onStartup: true },
  tools: (tool) => TOOL_NAMES.map(name => tool({
    ...toolMetadata(name),
    factory: ({ api, toolContext }) => getBridge(api).toolFactory(toolContext)?.find(t => t.name === name) ?? null,
  })),
});
const registerTools = entry.register;
entry.register = (api) => {
  const bridge = getBridge(api);
  const budgets = hostHookBudgets(validateConfig(api.pluginConfig));
  api.on('before_prompt_build', bridge.beforePrompt, { timeoutMs: budgets.before_prompt_build });
  api.on('before_tool_call', bridge.beforeTool, { priority: 100, timeoutMs: budgets.before_tool_call });
  api.on('after_tool_call', bridge.afterTool, { timeoutMs: budgets.after_tool_call });
  api.on('before_agent_finalize', bridge.finalize, { priority: 100, timeoutMs: budgets.before_agent_finalize });
  registerTools(api);
};
export default entry;
