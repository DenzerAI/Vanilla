// One unpersisted capability per page load. Reloading never restores an unlock.
export const chatPrivacyClient = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
export const privacyEvent = 'chat-privacy-change';
const locks = new Set();
export function privacyChanged(id, locked = true) {
  if (locked) locks.add(id); else locks.delete(id);
  window.dispatchEvent(new CustomEvent(privacyEvent, {detail: {id, locked}}));
}
export const locallyLocked = id => locks.has(id);

export async function changeChatPrivacy(api, action, id, pin) {
  if (action === 'lock') privacyChanged(id);
  let result;
  try { result = await api('/chat/privacy/' + action, {id, ...(pin === undefined ? {} : {pin})}); }
  catch(error) {
    if(action === 'setup' && locallyLocked(id)) window.dispatchEvent(new CustomEvent('wrapper/notice',{detail:error.message}));
    throw error;
  }
  if (action !== 'touch') privacyChanged(id, result.locked);
  return result;
}

export function watchChatPrivacy(api, id, onLock) {
  let lastActivity = Date.now(), lastTouch = 0, touching = false;
  const activity = () => { if (document.visibilityState === 'visible') lastActivity = Date.now(); };
  const tick = async () => {
    if (Date.now() - lastActivity >= 300000) {
      onLock();
      return;
    }
    if (!touching && lastActivity > lastTouch && Date.now() - lastTouch >= 30000) {
      touching = true;
      try { await changeChatPrivacy(api, 'touch', id); lastTouch = Date.now(); }
      catch { onLock(); }
      finally { touching = false; }
    }
  };
  for (const type of ['pointerdown', 'keydown', 'pointermove', 'wheel']) window.addEventListener(type, activity, {passive:true});
  const visible = () => { if(document.visibilityState === 'visible') void tick(); };
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('focus', visible);
  const hide = () => onLock();
  window.addEventListener('pagehide', hide);
  const timer = setInterval(tick, 1000);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', visible);
    window.removeEventListener('focus', visible);
    window.removeEventListener('pagehide', hide);
    for (const type of ['pointerdown', 'keydown', 'pointermove', 'wheel']) window.removeEventListener(type, activity);
  };
}
