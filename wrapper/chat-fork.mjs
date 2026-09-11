// Fork naming belongs to the wrapper; native session history remains unchanged.
export function romanNumber(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Ungültige Chatnummer.');
  let result = '';
  for (const [amount, numeral] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]) {
    result += numeral.repeat(Math.floor(value / amount));
    value %= amount;
  }
  return result;
}

// Call synchronously after the native fork succeeds, before yielding to storage.
// Number allocation and insertion form one operation even for concurrent forks.
export function registerFork(chats, source, threadId, now = Date.now()) {
  const familyId = source.forkFamilyId || source.id;
  const members = chats.filter(chat => chat.forkFamilyId === familyId || chat.id === familyId);
  const index = Math.max(1, ...members.map(chat => chat.forkSequence || chat.forkIndex || 1)) + 1;
  const prefix = source.forkIndex ? `${romanNumber(source.forkIndex)} · ` : '';
  const baseTitle = (prefix && source.title.startsWith(prefix) ? source.title.slice(prefix.length) : source.title) || 'Neuer Chat';
  if (!source.forkFamilyId) {
    source.forkFamilyId = familyId;
    source.forkIndex = 1;
    source.title = `I · ${baseTitle}`;
    source.titleStatus = 'manual';
    source.titleRevision = (source.titleRevision || 0) + 1;
  }
  for (const member of members) member.forkSequence = index;
  const fork = {
    ...source,
    workspaceOnboarding: null,
    firmaItemId: null,
    firmaReview: null,
    id: threadId,
    workerThreadId: source.workerThreadId ? threadId : undefined,
    forkFamilyId: familyId,
    forkIndex: index,
    forkSequence: index,
    title: `${romanNumber(index)} · ${baseTitle}`,
    titleStatus: 'manual',
    createdAt: now,
    updatedAt: now,
    archived: false,
    pinned: false,
    jobId: null,
    runId: null,
  };
  chats.unshift(fork);
  return fork;
}
