export function normalizeJobCategory(value) {
  if(value===undefined||value===null)return '';
  if(typeof value!=='string'||value.length>80||/[\x00-\x1f\x7f]/.test(value))throw Error('Kategorie muss ein kurzer Name mit höchstens 80 Zeichen sein.');
  const label=value.trim();
  return label.toLocaleLowerCase('de')==='allgemein'?'':label;
}
export const jobCategoryLabel=job=>normalizeJobCategory(job.category)||'Allgemein';
export function jobCategoryOptions(jobs) {
  return [...new Set(jobs.filter(j=>!j.managed&&j.status!=='invalid').map(j=>normalizeJobCategory(j.category)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
}
