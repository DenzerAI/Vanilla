// Native option names and values are authoritative. Never invent effort levels.
export const optionValues = option => (option?.options || []).flatMap(group => group.options || [group]);
export const modelConfig = session => session?.configOptions?.find(option => option.type === 'select' && (option.category === 'model' || option.id === 'model'));
export const effortConfig = session => session?.configOptions?.find(option => option.type === 'select' && (option.category === 'thought_level' || option.id === 'effort'));
export function sessionModelSelection(session) {
  const config = modelConfig(session), thinking = effortConfig(session);
  const model = config?.currentValue || (session?.configOptions === undefined ? session?.models?.currentModelId : '') || '';
  const effort = thinking?.currentValue || '';
  const nativeModels = config ? optionValues(config).map(o => ({model: o.value, displayName: o.name || o.value}))
    : session?.configOptions === undefined ? (session?.models?.availableModels || []).map(m => ({model: m.modelId, displayName: m.name || m.modelId})) : [];
  return {model, effort, models: nativeModels.map(m => ({...m, isDefault: m.model === model,
    supportedReasoningEfforts: m.model === model ? optionValues(thinking).map(o => ({reasoningEffort: o.value, displayName: o.name || o.value, description: o.description})) : [],
    defaultReasoningEffort: m.model === model ? effort : ''}))};
}
export function visibleModels(models = [], workerId = 'codex') {
  return models.filter(m => !m.hidden && (workerId !== 'codex' || /^gpt-(?:5\.6|6(?:\.\d+)?)(?:-|$)/i.test(m.model)));
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
