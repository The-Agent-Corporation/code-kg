export const WORK_COMMANDS = Object.freeze({
  init: 'workInitCommand', create: 'workCreateCommand', list: 'workListCommand', ready: 'workReadyCommand', show: 'workShowCommand',
  claim: 'workClaimCommand', update: 'workUpdateCommand', close: 'workCloseCommand', verify: 'workVerifyCommand',
  interview: 'workInterviewCommand', answer: 'workAnswerCommand', assume: 'workAssumeCommand', accept: 'workAcceptCommand', seal: 'workSealCommand',
  dep: 'workDepCommand', start: 'workStartCommand', prime: 'workPrimeCommand', remember: 'workRememberCommand', memories: 'workMemoriesCommand',
  isolate: 'workIsolateCommand', adopt: 'workAdoptCommand', cleanup: 'workCleanupCommand',
  'evidence-attach': 'workEvidenceAttachCommand', 'evidence-pair': 'workEvidencePairCommand', 'evidence-list': 'workEvidenceListCommand',
});
export const TOOL_NAMES = ['codekg_cli', 'codekg_mcp', 'codekg_work', 'codekg_bridge_status'];
export function toolMetadata(name) { return { name,
      description: {
        codekg_cli: 'Run any Code-KG CLI command in the configured repository. Use codekg_work for trusted work mutations; no shell interpolation or environment arguments.',
        codekg_mcp: 'Access the complete Code-KG MCP server. Omit name to list all tools and schemas; supply name and arguments to call one.',
        codekg_work: 'Full Code-KG work lifecycle with host-bound reviewer identity. command names map to shared work command functions; options use their camelCase names. Explicit operator overrides are not reviewer authority.',
        codekg_bridge_status: 'Inspect process counters and this session’s Code-KG hook receipts and failures; registration counts alone are not live verification.',
      }[name],
      parameters: { type: 'object', properties: name === 'codekg_cli' ? { argv: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 100 } } : name === 'codekg_mcp' ? { name: { type: 'string' }, arguments: { type: 'object' } } : name === 'codekg_work' ? { command: { type: 'string', enum: Object.keys(WORK_COMMANDS) }, options: { type: 'object' } } : {}, required: name === 'codekg_cli' ? ['argv'] : name === 'codekg_work' ? ['command'] : [], additionalProperties: false },
}; }
