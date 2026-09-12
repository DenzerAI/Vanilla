export const inboxCategories = [
  {value:'focus',label:'Fokus'},
  {value:'receipts',label:'Belege & Bestellungen'},
  {value:'updates',label:'Benachrichtigungen'},
  {value:'promotion',label:'Werbung & Newsletter'},
];
export function inboxSections(conversations,{query='',provider='all',account='all',status='open',category='all',view='focus'}={}) {
  const search=query.toLocaleLowerCase('de').trim();
  const matching=conversations.filter(item=>
    (provider==='all'||item.provider===provider)&&
    (account==='all'||item.accountId===account)&&
    (status==='all'||(status==='done'?item.done:!item.done&&(status!=='unread'||item.unread)))&&
    (category==='all'||(item.triage?.category||'focus')===category)&&
    [item.sender,item.subject,item.provider,item.account,item.preview].join(' ').toLocaleLowerCase('de').includes(search));
  // Search and explicit category selection always reveal matches, including bundles.
  if(view==='all'||search||category!=='all')return {main:matching,bundles:[]};
  return {main:matching.filter(item=>(item.triage?.category||'focus')==='focus'),
    bundles:inboxCategories.filter(c=>c.value!=='focus').map(c=>({...c,items:matching.filter(item=>item.triage?.category===c.value)})).filter(c=>c.items.length)};
}
