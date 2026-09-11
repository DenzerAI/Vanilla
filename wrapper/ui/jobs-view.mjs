import {normalizeJobCategory} from './job-categories.mjs';
export const jobFilters = [['all', 'Alle'], ['active', 'Aktiv'], ['paused', 'Pausiert'], ['completed', 'Abgeschlossen'], ['system', 'System'], ['templates', 'Vorlagen']];

export function jobState(job) {
  if (['queued', 'dispatching', 'running'].includes(job.lastRun?.status)) return 'running';
  if (job.status === 'invalid' || ['failed', 'interrupted'].includes(job.lastRun?.status)) return 'attention';
  if (job.schedule?.type === 'once' && job.lastRun?.status === 'completed' && (!job.schedule.at || Date.parse(job.schedule.at) <= Date.now())) return 'completed';
  if (job.schedule?.type === 'manual') return job.lastRun?.status === 'completed' ? 'completed' : 'manual';
  return job.status === 'active' ? 'active' : 'paused';
}

export const jobStateLabel = job => ({running:'Läuft', attention:'Braucht Aufmerksamkeit', completed:'Abgeschlossen', manual:'Manuell', active:'Aktiv', paused:'Pausiert'})[jobState(job)];

export function filterJobs(jobs, filter, query = '', category = null) {
  return jobs.filter(job => {
    if (filter === 'templates') return false;
    if (Boolean(job.managed) !== (filter === 'system')) return false;
    if (!`${job.name} ${job.instructions || ''}`.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de'))) return false;
    if(filter!=='system'&&category!==null&&(job.status==='invalid'?'':normalizeJobCategory(job.category))!==category)return false;
    const state = jobState(job);
    return ['all', 'system'].includes(filter) || (filter === 'active' ? ['active','running'].includes(state) : filter === 'paused' ? job.status === 'paused' && state !== 'completed' && job.schedule?.type !== 'manual' : state === filter);
  });
}
