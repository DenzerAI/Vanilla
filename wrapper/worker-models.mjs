// Native option names and values are authoritative. Never invent effort levels.
export function attachClaudeModelMetadata(configOptions, infos = []) {
  return configOptions.map(option => {
    if (option.category !== 'model' && option.id !== 'model') return option;
    const enrich = item => {
      if (item.options) return {...item, options:item.options.map(enrich)};
      const info = infos.find(model => model.value === item.value);
      return info?.resolvedModel ? {...item, _meta:{...item._meta, resolvedModel:info.resolvedModel}} : item;
    };
    return {...option, options:(option.options || []).map(enrich)};
  });
}
// The pinned adapter exposes per-session modelInfos; never use a global catalog.
export function decorateClaudeModelMetadata(agent) {
  const enrich = (payload, sessionId) => payload?.configOptions
    ? {...payload, configOptions:attachClaudeModelMetadata(payload.configOptions, agent.sessions[sessionId]?.modelInfos)} : payload;
  const setConfig = agent.setSessionConfigOption.bind(agent);
  for (const method of ['newSession', 'loadSession', 'resumeSession', 'unstable_forkSession', 'setSessionConfigOption']) {
    const original = agent[method].bind(agent);
    agent[method] = async params => {
      let result = await original(params);
      const sessionId = result.sessionId || params.sessionId;
      const thinking = effortConfig(result);
      // A concrete session setting, acknowledged by the SDK, not a UI guess
      // about what the provider's automatic default might mean.
      if (thinking && ['default', 'auto', ''].includes(thinking.currentValue || '')) {
        const levels = optionValues(thinking).filter(o => !['default', 'auto'].includes(o.value));
        const initial = levels.find(o => o.value === 'medium') || levels[0];
        if (initial) {
          const confirmed = await setConfig({sessionId, configId:thinking.id, value:initial.value});
          if (effortConfig(confirmed)?.currentValue !== initial.value) throw new Error('Der Anbieter hat den Denkaufwand nicht bestätigt.');
          result = {...result, configOptions:confirmed.configOptions};
        }
      }
      return enrich(result, sessionId);
    };
  }
  const update = agent.client.sessionUpdate.bind(agent.client);
  agent.client.sessionUpdate = params => update({...params, update:enrich(params.update, params.sessionId)});
}
export function nativeModelName(option) {
  const id = option._meta?.resolvedModel || option.value || '';
  const match = id.match(/(?:^|\.)claude-([a-z]+)-(\d+)(?:[.-](\d{1,2})(?!\d))?/i);
  const name = option.value === 'default' && option.description ? option.description : option.name || option.value;
  if (!match) return name;
  const family = match[1][0].toUpperCase() + match[1].slice(1);
  const version = match[2] + '.' + (match[3] || '0');
  const context = /\[1m\]|\(1m(?: context)?\)/i.test(id + ' ' + option.value + ' ' + name) ? ' · 1M' : '';
  return `Claude ${family} ${version}${context}`;
}
export const optionValues = option => (option?.options || []).flatMap(group => group.options || [group]);
export const modelConfig = session => session?.configOptions?.find(option => option.type === 'select' && (option.category === 'model' || option.id === 'model'));
export const effortConfig = session => session?.configOptions?.find(option => option.type === 'select' && (option.category === 'thought_level' || option.id === 'effort'));
export function sessionModelSelection(session) {
  const config = modelConfig(session), thinking = effortConfig(session);
  const model = config?.currentValue || (session?.configOptions === undefined ? session?.models?.currentModelId : '') || '';
  const effort = thinking?.currentValue || '';
  const nativeModels = config ? optionValues(config).map(o => ({model: o.value, displayName: nativeModelName(o), ...(o._meta?.resolvedModel ? {resolvedModel:o._meta.resolvedModel} : {})}))
    : session?.configOptions === undefined ? (session?.models?.availableModels || []).map(m => ({model: m.modelId, displayName: m.name || m.modelId})) : [];
  return {model, effort, models: nativeModels.map(m => ({...m, isDefault: m.model === model,
    supportedReasoningEfforts: m.model === model ? optionValues(thinking).map(o => ({reasoningEffort: o.value, displayName: o.name || o.value, description: o.description})) : [],
    defaultReasoningEffort: m.model === model ? effort : ''}))};
}
export function visibleModels(models = [], workerId = 'codex') {
  const choices = models.filter(m => !m.hidden && (workerId !== 'codex' || /^gpt-(?:5\.6|6(?:\.\d+)?)(?:-|$)/i.test(m.model)));
  // Default clears an override; it is not another concrete Claude model.
  const explicit = workerId === 'claw-code' && choices.some(m => m.model !== 'default')
    ? choices.filter(m => m.model !== 'default') : choices;
  const defaultModel = choices.find(m => m.model === 'default' && m.isDefault && m.resolvedModel);
  return explicit.filter((m, index) => explicit.findIndex(other => other.model === m.model) === index)
    .map(m => defaultModel && m.resolvedModel === defaultModel.resolvedModel
      ? {...m, isDefault:true, supportedReasoningEfforts:defaultModel.supportedReasoningEfforts,
          defaultReasoningEffort:defaultModel.defaultReasoningEffort} : m);
}
export function selectedVisibleModel(models, workerId, model) {
  const choices = visibleModels(models, workerId);
  const selected = models.find(m => m.model === model);
  return choices.find(m => m.model === model)
    || (workerId === 'claw-code' && model === 'default' && selected?.resolvedModel
      ? choices.find(m => m.resolvedModel === selected.resolvedModel) : undefined)
    || selected;
}
export function preferredModel(models, workerId, previous = '') {
  const choices = visibleModels(models, workerId);
  return choices.find(m => m.model === previous) || choices.find(m => m.isDefault) || choices[0];
}
export function supportedEffort(model, requested) {
  const options = model?.supportedReasoningEfforts || [];
  if (options.some(o => o.reasoningEffort === requested)) return requested;
  return options.find(o => o.reasoningEffort === model?.defaultReasoningEffort)?.reasoningEffort || options[0]?.reasoningEffort || '';
}

// Apply a queued ACP choice only after the old turn has ended, using each native acknowledgement.
export async function applySessionSelection(session, requested, change) {
  let selection = sessionModelSelection(session);
  if (!selection.models.some(model => model.model === requested.model)) throw new Error('Das vorgemerkte Modell ist nicht mehr verfügbar. Bitte erneut auswählen.');
  if (requested.model !== selection.model) {
    const config = modelConfig(session);
    session = await change(config ? {configId:config.id, value:requested.model} : {modelId:requested.model});
    selection = sessionModelSelection(session);
    if (selection.model !== requested.model) throw new Error('Der Anbieter hat den Modellwechsel nicht bestätigt.');
  }
  if (requested.effort && requested.effort !== selection.effort) {
    const option = effortConfig(session);
    if (!optionValues(option).some(item => item.value === requested.effort)) throw new Error('Der vorgemerkte Denkaufwand ist nicht mehr verfügbar. Bitte erneut auswählen.');
    session = await change({configId:option.id, value:requested.effort});
    if (sessionModelSelection(session).effort !== requested.effort) throw new Error('Der Anbieter hat den Denkaufwand nicht bestätigt.');
  }
  return session;
}

export const fastTier = model => model?.serviceTiers?.find(t => t.id === "priority" || t.id === "fast") || null;

// The installed ACP adapter advertises this select fallback to non-boolean clients.
export function sessionFast(session) {
  const option = session?.configOptions?.find(o => o.id === 'fast' && o.type === 'select');
  const values = optionValues(option);
  if (!values.some(o => o.value === 'on') || !values.some(o => o.value === 'off') || !['on','off'].includes(option.currentValue)) return null;
  return {id:option.id, enabled:option.currentValue === 'on', on:'on', off:'off'};
}
