"""CRM routes use the core's existing owner authentication and internal adapter boundary."""
import asyncio
from fastapi import APIRouter, Query
from pydantic import Field
from .crm_mapping import graph_contact
from .crm_models import (Strict, Decision, EntityQuery, Evidence, ExternalID, FieldDefinition,
                         Proposal, Relation, SavedView, TemplateInstallation, Workflow)


class SourceInput(Strict):
    connection_id: str = Field(default='local', max_length=100)
    evidence: Evidence


class SignalClassification(Strict):
    status: str
    reason: str = Field(min_length=1, max_length=1000)


class RevisionCheck(Strict):
    revision: int = Field(strict=True, ge=1)


class ArchiveInput(RevisionCheck):
    archived: bool
    reason: str = Field(min_length=1,max_length=1000)


class ToolInput(Strict):
    name: str = Field(max_length=50)
    arguments: dict


def routes(crm, memory):
    router = APIRouter()

    @router.get('/api/crm/schema')
    async def schema():
        return crm.schema()

    @router.get('/api/crm/templates')
    async def templates():
        return await asyncio.to_thread(crm.templates)

    @router.post('/api/crm/templates/install')
    async def install_template(body: TemplateInstallation):
        return await asyncio.to_thread(crm.install_template, body)

    @router.post('/api/crm/query')
    async def query(body: EntityQuery):
        return await asyncio.to_thread(crm.search, body)

    @router.get('/api/crm/entities/{entity_id}')
    async def entity(entity_id: str):
        return await asyncio.to_thread(crm.read, entity_id)

    @router.post('/api/crm/entities/{entity_id}/check')
    async def check(entity_id: str, body: RevisionCheck):
        return await asyncio.to_thread(crm.check_revision, entity_id, body.revision)

    @router.post('/api/crm/entities/{entity_id}/archive')
    async def archive(entity_id: str, body: ArchiveInput):
        return await asyncio.to_thread(crm.archive, entity_id, body.revision, body.archived, body.reason)

    @router.get('/api/crm/entities/{entity_id}/history')
    async def history(entity_id: str, offset: int = Query(0,ge=0), limit: int = Query(50,ge=1,le=100)):
        crm.read(entity_id)
        return {'changes':crm.db.rows('SELECT * FROM crm_audit WHERE entity_id=? ORDER BY id DESC LIMIT ? OFFSET ?', (entity_id,limit,offset)),
                'facts':crm.db.rows('SELECT * FROM crm_facts WHERE entity_id=? ORDER BY decided_at DESC,id LIMIT ? OFFSET ?', (entity_id,limit,offset))}

    @router.post('/api/crm/sources')
    async def capture(body: SourceInput):
        if body.connection_id!='local':
            raise ValueError('Anbietereingänge gehören zum internen Anschluss.')
        return await asyncio.to_thread(crm.receive, 'local', body.evidence, 'owner')

    @router.post('/internal/crm/sources')
    async def receive(body: SourceInput):
        if body.connection_id=='local':
            raise ValueError('Interner Anbietereingang benötigt eine bestehende Verbindung.')
        return await asyncio.to_thread(crm.receive, body.connection_id, body.evidence, 'connector:'+body.connection_id)

    @router.get('/api/crm/sources/{signal_id}/normalize')
    async def normalize(signal_id: str):
        signal = crm.signal(signal_id)
        connection = crm._connection(signal['connection_id'])
        if connection.get('provider') != 'microsoft-graph' or signal['kind'] != 'contact':
            raise ValueError('Für diesen Quelltyp ist noch keine geprüfte Feldübersetzung vorhanden.')
        current = crm.read(signal['entity_id'])['fields'] if signal['entity_id'] else None
        return graph_contact(signal['payload'],signal['connection_id'],current)

    @router.get('/api/crm/sources/{signal_id}')
    async def source(signal_id: str):
        return crm.signal(signal_id)

    @router.post('/api/crm/sources/{signal_id}/classify')
    async def classify(signal_id: str, body: SignalClassification):
        return await asyncio.to_thread(crm.classify_signal, signal_id, body.status, body.reason)

    @router.post('/api/crm/proposals')
    async def propose(body: Proposal):
        return await asyncio.to_thread(crm.propose, body, 'owner')

    @router.get('/api/crm/proposals')
    async def proposals(offset: int = Query(0,ge=0), limit: int = Query(30,ge=1,le=100)):
        return {'proposals':[crm.proposal(r['id']) for r in crm.db.rows("SELECT id FROM crm_proposals WHERE status='pending' ORDER BY created_at,id LIMIT ? OFFSET ?",(limit,offset))]}

    @router.post('/api/crm/decisions')
    async def decide(body: Decision):
        return await asyncio.to_thread(crm.decide, body)

    @router.post('/api/crm/fields')
    async def field(body: FieldDefinition):
        return await asyncio.to_thread(crm.define_field, body)

    @router.post('/api/crm/workflows')
    async def workflow(body: Workflow):
        return await asyncio.to_thread(crm.define_workflow, body)

    @router.post('/api/crm/views')
    async def view(body: SavedView):
        return await asyncio.to_thread(crm.save_view, body)

    @router.post('/api/crm/identities')
    async def identity(body: ExternalID):
        return await asyncio.to_thread(crm.external_id, body)

    @router.post('/api/crm/relations')
    async def relation(body: Relation):
        return await asyncio.to_thread(crm.relate, body)

    @router.get('/api/crm/connections')
    async def connections():
        # Reuse stored connection IDs/provider identifiers; never expose config or credentials.
        state = crm.db.get('control/state.json')['value'] or {}
        return {'connections':[dict(id=c['id'],provider=c.get('provider'),name=c.get('name'),
                                    input_format='microsoft-graph.contact.v1' if c.get('provider')=='microsoft-graph' else 'canonical-proposal',
                                    sync_active=False, last_successful_sync=None)
                               for c in state.get('connections',[]) if c.get('kind')=='crm' or c.get('provider')=='microsoft-graph'],
                'message':'Eingangsvertrag vorhanden; kein automatischer CRM-Abgleich aktiv.'}

    @router.post('/internal/crm/tool')
    @router.post('/api/crm/tool')
    async def tool(body: ToolInput):
        args = dict(body.arguments)
        project = args.pop('projectId',None)
        if not isinstance(project,str) or not 1 <= len(project) <= 100:
            raise ValueError('Gültige projectId erforderlich.')
        memory.project_prefix(project)
        actor = 'agent:'+project
        if body.name=='crm_schema':
            if args: raise ValueError('Unbekannte Argumente.')
            return crm.schema()
        if body.name=='crm_search':
            return await asyncio.to_thread(crm.search, EntityQuery.model_validate(args))
        if body.name=='crm_read':
            if set(args)!={'entity_id'} or not isinstance(args['entity_id'],str) or not 1 <= len(args['entity_id']) <= 80:
                raise ValueError('Gültige entity_id erforderlich.')
            return await asyncio.to_thread(crm.read, args['entity_id'])
        if body.name=='crm_capture':
            evidence = Evidence.model_validate(args)
            return await asyncio.to_thread(crm.receive, 'local', evidence, actor)
        if body.name=='crm_propose':
            return await asyncio.to_thread(crm.propose, Proposal.model_validate(args), actor)
        if body.name=='crm_resolve':
            allowed={'connection_id','object_type','external_id','email','phone'}
            if not set(args)<=allowed or not all(isinstance(v,str) for v in args.values()):
                raise ValueError('Ungültige Identitätsabfrage.')
            return await asyncio.to_thread(crm.resolve, **args)
        raise ValueError('Unbekanntes CRM-Werkzeug. Agenten liefern Vorschläge, keine eigenen Freigaben.')

    return router
