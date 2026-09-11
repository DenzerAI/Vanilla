// Native request data only. Prose and ordinary tool output never open a question.
export function questionRequest(request) {
  const p = request?.params || {};
  if (request?.method?.includes('requestUserInput')) {
    if (!Array.isArray(p.questions) || !p.questions.length) return null;
    return {kind:'codex', questions:p.questions.map(q => ({...q, required:true,
      options:(q.options || []).map(o => ({value:o.label, label:o.label, description:o.description})),
      custom:true, type:'string', multi:false}))};
  }
  if (!request?.method?.includes('elicitation') || p.mode === 'url') return null;
  const properties = p.requestedSchema?.properties;
  if (!properties || p.requestedSchema.type !== 'object') return null;
  const entries = Object.entries(properties);
  const companions = new Map(entries.filter(([,s]) => s._meta?._askUserQuestionCustomAnswer?.isCustomAnswer)
    .map(([key,s]) => [s._meta._askUserQuestionCustomAnswer.questionId, key]));
  const fields = entries.filter(([key]) => ![...companions.values()].includes(key));
  if (!fields.length) return null;
  const questions = [];
  for (const [id,s] of fields) {
    if (!['string','number','integer','boolean','array'].includes(s.type)) return null;
    const enums = s.type === 'array' ? s.items : s;
    const variants = enums?.oneOf || enums?.anyOf;
    const options = variants?.map(o => ({value:o.const, label:o.title || String(o.const), description:o.description}))
      || enums?.enum?.map((value,i) => ({value, label:enums.enumNames?.[i] || String(value)}))
      || (s.type === 'boolean' ? [{value:true,label:'Ja'}, {value:false,label:'Nein'}] : []);
    if (s.type === 'array' && !options.length) return null;
    questions.push({id, question:fields.length === 1 ? p.message || s.description || s.title || id : s.description || s.title || id,
      header:s.title, options, type:s.type, multi:s.type === 'array', schema:s,
      required:(p.requestedSchema.required || []).includes(id), custom:companions.has(id) || !options.length,
      customKey:companions.get(id), isSecret:s.format === 'password'});
  }
  return {kind:'elicitation', questions};
}

export function questionValue(q, answer = {}) {
  const text = (answer.text || '').trim(), selected = answer.selected || [];
  if (text && !q.custom) throw new Error('Bitte eine der angebotenen Antworten auswählen.');
  if (!text && !selected.length) {
    if (q.required) throw new Error('Bitte eine Antwort auswählen oder Sonstiges eingeben.');
    return undefined;
  }
  if (selected.some(v => !q.options.some(o => o.value === v))) throw new Error('Diese Antwort wird nicht angeboten.');
  if (text && (q.customKey || !q.schema)) return text;
  let value = text || (q.multi ? selected : selected[0]);
  if (text && ['integer','number'].includes(q.type)) {
    value = Number(text);
    if (!Number.isFinite(value) || (q.type === 'integer' && !Number.isInteger(value))) throw new Error('Bitte eine gültige Zahl eingeben.');
  }
  const s = q.schema || {};
  if (typeof value === 'number' && ((s.minimum != null && value < s.minimum) || (s.maximum != null && value > s.maximum))) throw new Error('Die Zahl liegt außerhalb des angebotenen Bereichs.');
  if (typeof value === 'string' && ((s.minLength != null && value.length < s.minLength) || (s.maxLength != null && value.length > s.maxLength))) throw new Error('Bitte die Länge der Antwort anpassen.');
  if (Array.isArray(value) && ((s.minItems != null && value.length < s.minItems) || (s.maxItems != null && value.length > s.maxItems))) throw new Error('Bitte die Anzahl der ausgewählten Antworten anpassen.');
  return value;
}

export function questionResult(model, answers) {
  const content = {};
  for (const q of model.questions) {
    const answer = answers[q.id] || {}, value = questionValue(q, answer);
    if (value === undefined) continue;
    if (model.kind === 'codex') content[q.id] = {answers:[String(value)]};
    else content[answer.text?.trim() && q.customKey ? q.customKey : q.id] = value;
  }
  return model.kind === 'codex' ? {answers:content} : {action:'accept', content};
}

export function questionReceipt(request, result) {
  const model = questionRequest(request);
  if (!model || (model.kind !== 'codex' && !model.questions.some(q => q.customKey)) || result.action === 'cancel' || result.action === 'decline') return null;
  const text = model.questions.filter(q => !q.isSecret).map(q => {
    const value = model.kind === 'codex' ? result.answers?.[q.id]?.answers : result.content?.[q.customKey] ?? result.content?.[q.id];
    return `${q.question}\n${Array.isArray(value) ? value.join(', ') : value ?? 'Übersprungen'}`;
  }).join('\n\n');
  return text ? {id:`tool-user-answer-${request.id}`,type:'mcpToolCall',tool:'Rückfrage beantwortet',
    server:request.workerId || 'codex',status:'completed',result:{content:[{type:'text',text}]}} : null;
}
