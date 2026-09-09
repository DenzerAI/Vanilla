"""The shipped module contracts are also a read-only worker tool."""
import json
import os
from .isolation import inside
import httpx
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Request


class Modules:
    def __init__(self, config):
        self.config = config

    def catalog(self):
        file = self.config.root / 'system/modules.json'
        data = json.loads(file.read_text())
        if data.get('version') != 1:
            raise ValueError('Unbekannter Modulkatalog. Quellstand prüfen.')
        return data

    def find(self, query=''):
        words = query.casefold().split()
        return {'modules':[m for m in self.catalog()['modules'] if all(w in json.dumps(m,ensure_ascii=False).casefold() for w in words)]}

    def read(self, id):
        module = next((m for m in self.catalog()['modules'] if m['id']==id),None)
        if module is None: raise ValueError('Modul nicht gefunden. Zuerst system_modules verwenden.')
        documents=[]
        for ref in dict.fromkeys([module['setup'],module['contract']]):
            file=(self.config.root/ref.split('#')[0]).resolve()
            if not file.is_relative_to(self.config.root) or file.suffix != '.md': raise ValueError('Ungültiger Modulvertrag.')
            documents.append({'path':ref,'text':file.read_text()[:60000]})
        return {'module':module,'documents':documents,'next':'Statusquelle lesen; Ausbaustand ist keine bestätigte Verbindung. Zugangsdaten ausschließlich im Einrichtungsweg eingeben.'}

    async def status(self, id, project='default'):
        module=self.read(id)['module']
        method,route=module['status']['endpoint'].split(' ',1)
        if method!='GET' or not route.startswith('/api/') or route.startswith('/api/system/modules/') or '?' in route:
            raise ValueError('Statusquelle muss ein lesender, lokaler Fachanschluss sein.')
        headers={'Authorization':'Bearer '+self.config.access_token} if self.config.access_token else {}
        try:
            async with httpx.AsyncClient(trust_env=False,timeout=8) as client:
                response=await client.get(f'http://127.0.0.1:{self.config.port}'+route,params={'projectId':project},headers=headers)
            response.raise_for_status()
            if len(response.content)>1000000: raise ValueError('Statusantwort zu groß. Fachanschluss direkt prüfen.')
            return {'id':id,'stage':module['stage'],'observedAt':datetime.now(timezone.utc).isoformat(),'source':route,'meaning':module['status']['meaning'],'status':response.json()}
        except httpx.HTTPError:
            return {'id':id,'stage':module['stage'],'source':route,'unavailable':True,'error':'Statusquelle derzeit nicht erreichbar. Verbindung oder Laufzeit prüfen.','setup':module['setup']}


def routes(modules, runtime=None, mail=None):
    router=APIRouter()
    @router.get('/api/system/readiness')
    async def readiness(projectId: str='default'):
        # Product prerequisites are separate from a responsive HTTP process.
        checks=[]
        try:
            catalog=modules.catalog()
            for module in catalog['modules']: modules.read(module['id'])
            checks.append({'id':'module-contracts','ready':True})
        except (OSError,ValueError,KeyError):
            checks.append({'id':'module-contracts','ready':False,'reason':'Modulkatalog oder Einrichtungsunterlagen fehlen.'})
        for name,path in [('workspace',modules.config.workspace),('company',inside(modules.config.root,os.environ.get('COMPANY_BASE') or 'firmenbasis'))]:
            checks.append({'id':name,'ready':path.is_dir(),'reason':'' if path.is_dir() else 'Lokale Einrichtung fehlt.'})
        try:
            workers=await runtime.request('GET','/api/jobs/readiness',timeout=5)
        except Exception:
            workers={'ready':False,'reason':'Worker-Anschluss derzeit nicht erreichbar.'}
        return {'processReady':True,'baseReady':all(c['ready'] for c in checks),'workReady':all(c['ready'] for c in checks) and bool(workers.get('ready')),
                'checks':checks,'worker':workers,'mail':mail.accounts(projectId) if mail else [],
                'notice':'Arbeitsfähig bedeutet ausführbarer Worker; jeder Kundenanschluss braucht zusätzlich seinen eigenen Abgleich und Funktionstest. Ein frisches System darf unverbunden sein.'}
    @router.get('/api/system/modules')
    async def catalog(query: str=''):
        return modules.find(query[:200])

    @router.get('/api/system/modules/{id}')
    async def read(id: str):
        return modules.read(id)

    @router.get('/api/system/modules/{id}/status')
    async def status(id: str, projectId: str='default'):
        return await modules.status(id,projectId)

    @router.post('/api/system/tool')
    @router.post('/internal/system/tool')
    async def tool(request: Request):
        body=await request.json();args=body.get('arguments') or {}
        if body.get('name')=='system_modules': return modules.find(str(args.get('query',''))[:200])
        if body.get('name')=='system_module': return modules.read(str(args.get('id','')))
        if body.get('name')=='system_module_status': return await modules.status(str(args.get('id','')),str(args.get('projectId','default')))
        raise ValueError('Unbekanntes Systemwerkzeug.')
    return router
