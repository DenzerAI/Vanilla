// Native request data only. Prose and ordinary tool output never open a question.
export function questionRequest(request) {
  const p = request?.params || {};
  if (request?.method?.includes('requestUserInput')) {
    if (!Array.isArray(p.questions) || !p.questions.length) return null;
    return {kind:request.method === 'wrapper/requestUserInputAsync' ? 'codex-async' : 'codex', questions:p.questions.map(q => ({...q, required:true,
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
    if (model.kind.startsWith('codex')) content[q.id] = {answers:[String(value)]};
    else content[answer.text?.trim() && q.customKey ? q.customKey : q.id] = value;
  }
  return model.kind.startsWith('codex') ? {answers:content} : {action:'accept', content};
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

// Async questions are notifications, not unanswered native RPC calls.
export function asyncQuestionRequest(event) {
  const {threadId,turnId,item} = event.params || {};
  if (event.method !== 'item/completed' || item?.type !== 'agentMessage' || item.delivery !== 'async'
      || !threadId || !turnId || !item.id || !Array.isArray(item.questions) || !item.questions.length) return null;
  if (item.questions.some(q => typeof q.title !== 'string' || !q.title.trim()
      || (q.options != null && (!Array.isArray(q.options) || q.options.some(o => typeof o !== 'string'))))) return null;
  return {id:`async:${encodeURIComponent(threadId)}:${encodeURIComponent(turnId)}:${encodeURIComponent(item.id)}`,
    workerId:event.workerId || 'codex', method:'wrapper/requestUserInputAsync',
    params:{threadId,turnId,questions:item.questions.map((q,i)=>({id:`question_${i}`,question:q.title,
      options:(q.options || []).map(label=>({label}))}))}};
}

export function asyncQuestionAnswer(request, result) {
  const model = questionRequest(request);
  if (model?.kind !== 'codex-async') throw new Error('Keine asynchrone Rückfrage.');
  return model.questions.map(q => {
    const values = result?.answers?.[q.id]?.answers;
    if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== 'string' || !values[0].trim())
      throw new Error('Bitte jede Rückfrage beantworten.');
    return `${q.question}\n${values[0].trim()}`;
  }).join('\n\n');
}

// Additive chat metadata keeps pending questions across reloads and restarts.
// Answer dispatch uses the existing durable, idempotent message delivery path.
export class AsyncQuestions {
  constructor({chats,save,emit,enqueue}) { Object.assign(this,{chats,save,emit,enqueue}); this.serial=Promise.resolve(); }
  change(fn) { const operation=this.serial.then(fn); this.serial=operation.catch(()=>{}); return operation; }
  pending() { return this.chats().flatMap(c => (c.asyncQuestions || [])
    .filter(r=>!r.status && r.request.workerId === (c.workerId || 'codex')).map(r=>r.request)); }
  observe(event) { return this.change(async()=>{
    const request=asyncQuestionRequest(event), p=event.params || {};
    const chat=this.chats().find(c=>c.id === p.threadId);
    if (!chat) return;
    if (request) {
      const records=chat.asyncQuestions ||= [];
      if (records.some(r=>r.request.id === request.id)) return;
      records.push({request}); await this.save();
      this.emit({method:'wrapper/request',params:request});
    } else if (event.method === 'turn/completed' && ['interrupted','failed'].includes(p.turn?.status)) {
      const cancelled=(chat.asyncQuestions || []).filter(r=>!r.status && r.request.params.turnId === p.turn.id);
      for (const record of cancelled) record.status='cancelled';
      if (cancelled.length) await this.save();
      for (const record of cancelled) this.emit({method:'wrapper/requestResolved',params:{id:record.request.id}});
    }
  }); }
  respond(id,result) { return this.change(async()=>{
    const request=this.pending().find(r=>r.id === id);
    if (!request) throw new Error('Rückfrage nicht mehr verfügbar.');
    const text=asyncQuestionAnswer(request,result);
    await this.enqueue(request,text);
    const chat=this.chats().find(c=>c.id === request.params.threadId);
    chat.asyncQuestions.find(r=>r.request.id === id).status='answered';
    await this.save();
    this.emit({method:'wrapper/requestResolved',params:{id}});
  }); }
}
