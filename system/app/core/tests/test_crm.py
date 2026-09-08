"""Behavioral tests with isolated data. The two 202-555-0100 spellings are
fictional fixtures individually reviewed in source-policy.json, never real contacts.
"""
import json
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from core.tests.test_core import config, db
from core.crm import CRM
from core.crm_mapping import graph_contact
from core.database import Database
from core.app import create_app


@pytest.fixture
def crm(db):
    return CRM(db)


def evidence(crm, entity=None, *, when=None, external_id=None, payload=None, connection='local'):
    return crm.receive(connection, dict(kind='contact',external_id=external_id or str(uuid4()),
        source_time=(when or datetime.now(timezone.utc)).isoformat(),entity_id=entity,payload=payload or {}))


def propose(crm, changes, *, entity=None, kind='person', signal=None):
    signal = signal or evidence(crm,entity)
    return crm.propose(dict(signal_id=signal['id'],entity_id=entity,kind=kind,
        base_revision=crm.read(entity)['revision'] if entity else 0,changes=changes,reason='Synthetic test observation'))


def decide(crm,p,accept=True):
    return crm.decide(dict(proposal_id=p['id'],expected_revision=crm.read(p['entity_id'])['revision'] if p['entity_id'] else 0,accept=accept,reason='Synthetic owner decision'))


def person(crm, name='Example'):
    return decide(crm,propose(crm,[dict(field='given_name',value=name)]))


def value(entity,field,slot=''):
    return next(f['value'] for f in entity['fields'][field] if f['slot']==slot)


def test_three_levels_and_provenance(crm):
    raw=evidence(crm,payload={'subject':'Advertisement'})
    assert crm.search({})['results']==[]
    p=propose(crm,[dict(field='given_name',value='Example')],signal=raw)
    assert crm.search({})['results']==[]
    e=decide(crm,p)
    f=e['fields']['given_name'][0]
    assert f['signal_id']==raw['id'] and f['proposal_id']==p['id']
    assert f['actor']=='agent' and f['decided_by']=='owner'
    assert f['source_time']==raw['source_time'] and f['checked_at']>=raw['received_at']
    assert e['freshness']['ready']
    assert crm.db.rows('SELECT count(*) n FROM crm_audit')[0]['n']==3
    with pytest.raises(FileExistsError):decide(crm,p)


def test_multiple_contacts_addresses_custom_fields_and_persistence(crm,db):
    changes=[dict(field='family_name',value='Example'),
             dict(field='email',slot='work',value={'address':'person@example.test','primary':True}),
             dict(field='email',slot='other',value={'address':'other@example.test'}),
             dict(field='phone',slot='mobile',value={'number':'+1 (202) 555-0100'}),
             dict(field='phone',slot='local',value={'number':'555-0101'}),
             dict(field='address',slot='work',value={'street':'Example Street 1','postal_code':'01234','city':'Example City','country_code':'DE'}),
             dict(field='address',slot='delivery',value={'city':'Delivery City','label':'delivery'})]
    e=decide(crm,propose(crm,changes))
    assert len(e['fields']['email'])==2 and len(e['fields']['address'])==2
    assert 'birthday' not in crm.schema()['entities']['person']
    crm.define_field(dict(entity_kind='person',key='custom.anniversary',label='Anniversary',type='date'))
    e=decide(crm,propose(crm,[dict(field='custom.anniversary',value='2001-02-03')],entity=e['id']))
    assert value(e,'custom.anniversary')=='2001-02-03'
    copy=db.file.parent/'copy.sqlite3';db.backup(copy)
    restored=Database(copy)
    try:
        assert CRM(restored).read(e['id'])['fields']==e['fields']
    finally:restored.close()
    assert crm.search({'kind':'person','filters':[{'field':'address.postal_code','equals':'01234'}]})['results'][0]['id']==e['id']


def test_no_note_fallback_type_errors_and_atomic_acceptance(crm):
    e=person(crm)
    for change in [dict(field='unknown',value='data'),dict(field='phone',value={'number':'123'}),dict(field='email',slot='x',value={'address':'invalid'}),dict(field='given_name',value={'wrong':'type'})]:
        with pytest.raises(ValueError):propose(crm,[change],entity=e['id'])
    # Rejected input leaves only evidence, never partial facts.
    assert value(crm.read(e['id']),'given_name')=='Example'
    p=propose(crm,[dict(field='given_name',value='Example'),dict(field='email',slot='a',value={'address':'a@example.test','primary':True}),dict(field='email',slot='b',value={'address':'b@example.test','primary':True})])
    count=len(crm.search({})['results'])
    with pytest.raises(ValueError):decide(crm,p)
    assert len(crm.search({})['results'])==count


def test_duplicate_signals_and_pending_evidence_invalidate_revision(crm):
    e=person(crm)
    signal=evidence(crm,e['id'],external_id='event-1')
    assert not crm.read(e['id'])['freshness']['ready']
    with pytest.raises(FileExistsError):crm.check_revision(e['id'],e['revision'])
    same=evidence(crm,e['id'],external_id='event-1',when=datetime.fromtimestamp(signal['source_time'],timezone.utc))
    assert same['id']==signal['id']
    with pytest.raises(FileExistsError):evidence(crm,e['id'],external_id='event-1',payload={'changed':True})
    crm.classify_signal(signal['id'],'ignored','Unrelated message')
    current=crm.read(e['id'])
    assert current['freshness']['ready'] and current['revision']>e['revision']


def test_conflict_reject_and_stale_proposal(crm):
    e=person(crm)
    p=propose(crm,[dict(field='given_name',value='Changed')],entity=e['id'])
    current=crm.read(e['id'])
    assert value(current,'given_name')=='Example' and current['fields']['given_name'][0]['status']=='review'
    with pytest.raises(FileExistsError):crm.decide(dict(proposal_id=p['id'],expected_revision=e['revision'],accept=True,reason='stale'))
    current=decide(crm,p,False)
    assert current['fields']['given_name'][0]['status']=='current'
    before=current['fields']['given_name'][0]['source_time']
    delayed=evidence(crm,e['id'],when=datetime.fromtimestamp(before,timezone.utc)-timedelta(days=1))
    p=propose(crm,[dict(field='given_name',value='Older')],entity=e['id'],signal=delayed)
    with pytest.raises(FileExistsError):decide(crm,p)
    decide(crm,p,False)
    p=propose(crm,[dict(field='given_name',value='New')],entity=e['id'])
    current=decide(crm,p)
    assert value(current,'given_name')=='New'
    assert crm.db.rows('SELECT count(*) n FROM crm_facts WHERE entity_id=?',(e['id'],))[0]['n']==2


def test_intervening_field_change_cannot_be_overwritten(crm):
    e=person(crm)
    p1=propose(crm,[dict(field='given_name',value='First')],entity=e['id'])
    p2=propose(crm,[dict(field='given_name',value='Second')],entity=e['id'])
    decide(crm,p2)
    with pytest.raises(FileExistsError):decide(crm,p1)
    assert value(crm.read(e['id']),'given_name')=='Second'


def test_identity_never_merges_names_or_shared_emails(crm):
    a=person(crm);b=person(crm)
    for e in (a,b):
        decide(crm,propose(crm,[dict(field='email',slot='work',value={'address':'shared@example.test'})],entity=e['id']))
    assert len(crm.search({'query':'Example'})['results'])==2
    assert crm.resolve(email='shared@example.test')['status']=='needs_review'
    assert crm.resolve(phone='5550101')['status']=='needs_review'
    s=evidence(crm,a['id']);crm.classify_signal(s['id'],'ignored','Identity evidence')
    mapping=dict(connection_id='local',object_type='contact',external_id='outside-1',entity_id=a['id'],signal_id=s['id'],expected_revision=crm.read(a['id'])['revision'],reason='Explicit link')
    crm.external_id(mapping)
    assert crm.resolve(connection_id='local',object_type='contact',external_id='outside-1')['candidates']==[a['id']]
    source=evidence(crm,b['id']);crm.classify_signal(source['id'],'ignored','Identity evidence')
    with pytest.raises(FileExistsError):crm.external_id(dict(mapping,entity_id=b['id'],signal_id=source['id'],expected_revision=crm.read(b['id'])['revision']))


def workflow(crm):
    return crm.define_workflow(dict(id='service',label='Service',initial='new',stages=[
        dict(id='new',label='New request',transitions=['scheduled']),
        dict(id='scheduled',label='Appointment',transitions=['done']),
        dict(id='done',label='Finished',terminal=True,transitions=['new'])]))


def test_workflows_are_configurable_and_require_dated_action(crm):
    workflow(crm)
    changes=[dict(field='title',value='Service request'),dict(field='process',value=dict(workflow='service',stage='new'))]
    p=propose(crm,changes,kind='case')
    with pytest.raises(ValueError,match='Datum'):decide(crm,p)
    changes[1]['value'].update(next_step='Call customer',due_date='2026-10-01')
    e=decide(crm,propose(crm,changes,kind='case'))
    p=propose(crm,[dict(field='process',value=dict(workflow='service',stage='done'))],entity=e['id'],kind='case')
    with pytest.raises(ValueError,match='übergang'):decide(crm,p)
    decide(crm,p,False)
    e=decide(crm,propose(crm,[dict(field='process',value=dict(workflow='service',stage='scheduled',next_step='Visit',due_date='2026-10-02'))],entity=e['id'],kind='case'))
    e=decide(crm,propose(crm,[dict(field='process',value=dict(workflow='service',stage='done',outcome='completed'))],entity=e['id'],kind='case'))
    assert value(e,'process')['stage']=='done'
    with pytest.raises(FileExistsError):workflow(crm)
    view=crm.save_view(dict(id='service-board',label='Service board',kind='case',layout='board',workflow='service',columns=['title','process','amount'],expected_revision=0))
    assert view['revision']==1
    assert crm.search(dict(kind='case',filters=[dict(field='process.stage',equals='done')]))['results'][0]['id']==e['id']
    with pytest.raises(ValueError):crm.search(dict(kind='case',filters=[dict(field='notes',equals='done')]))


def test_relation_has_provenance_and_does_not_copy_projects(crm,db):
    a=person(crm)
    org=decide(crm,propose(crm,[dict(field='name',value='Example Organization')],kind='organization'))
    raw=evidence(crm,a['id']);crm.classify_signal(raw['id'],'ignored','Membership reference')
    a=crm.relate(dict(entity_id=a['id'],target_type='entity',target_id=org['id'],relation='works_at',role='Purchasing',signal_id=raw['id'],expected_revision=crm.read(a['id'])['revision'],reason='Owner assigned membership'))
    assert a['relations'][0]['signal_id']==raw['id']
    assert crm.read(org['id'])['relations'][0]['entity_id']==a['id']
    with pytest.raises(ValueError):crm.relate(dict(entity_id=a['id'],target_type='chat',target_id='missing',relation='related_to',signal_id=raw['id'],expected_revision=a['revision'],reason='Bad link'))


def test_graph_normalization_omission_is_not_deletion(crm):
    payload={'id':'contact-1','givenName':'Example','emailAddresses':[{'address':'first@example.test'},{'address':'second@example.test'}],
             'businessPhones':['+1 202 555 0100'],'businessAddress':{'street':'Test street','postalCode':'01234','city':'Test City'},'companyName':'Unresolved organization','birthday':'2001-02-03T00:00:00Z'}
    mapped=graph_contact(payload,'connection-one')
    assert mapped['unmapped_fields']==['birthday','companyName']
    e=decide(crm,propose(crm,mapped['changes']))
    assert len(e['fields']['email'])==2
    partial=graph_contact({'id':'contact-1','givenName':'Changed'},'connection-one',e['fields'])
    assert len(partial['changes'])==1
    deleted=graph_contact({'id':'contact-1','emailAddresses':[]},'connection-one',e['fields'])
    assert len(deleted['changes'])==2 and all(c['value'] is None for c in deleted['changes'])
    untouched=graph_contact({'id':'contact-1','emailAddresses':[]},'other-connection',e['fields'])
    assert untouched['changes']==[]


def test_api_auth_and_agent_cannot_approve(config):
    with TestClient(create_app(config)) as client:
        assert client.get('/api/crm/schema').status_code==200
        assert client.post('/api/crm/fields',json={}).status_code==403
        assert client.post('/internal/crm/sources',json={}).status_code==403
        client.headers['x-uwe-token']=client.get('/api/auth/session').json()['token']
        assert client.post('/api/crm/tool',json=dict(name='crm_schema',arguments={'projectId':'missing'})).status_code==400
        assert client.post('/api/crm/tool',json=dict(name='crm_schema',arguments={'projectId':'default'})).status_code==200
        assert client.post('/api/crm/tool',json=dict(name='crm_decide',arguments={'projectId':'default'})).status_code==400
        assert client.post('/api/crm/tool',json=dict(name='crm_propose',arguments={'projectId':'default','decided_by':'owner'})).status_code==400
        assert client.post('/api/crm/query',json={'filters':[{'field':'bad','equals':'value'}]}).status_code==400
        from core.mcp import tools
        names={t['name'] for t in tools()}
        assert {'crm_read','crm_search','crm_propose','crm_capture','crm_resolve'}<=names
        assert 'crm_decide' not in names


def test_memory_context_reads_fresh_crm_and_respects_budget(config,db):
    from core.memory import Memory
    from core.knowledge import Knowledge
    from core.settings import Settings
    from core.tests.test_core import write_note
    crm=CRM(db)
    e=decide(crm,propose(crm,[dict(field='display_name',value='Example Client'),dict(field='job_title',value='Old role')]))
    write_note(config,'notes/Client.md','# Example Client\nHistorical conversation about an old role.')
    knowledge=Knowledge(db,config);knowledge.scan()
    memory=Memory(db,config,knowledge,Settings(db));memory.crm=crm
    first=memory.context('Example Client','default',max_chars=1800)
    assert first['sources'][0]['method']=='crm'
    p=propose(crm,[dict(field='job_title',value='New role')],entity=e['id'])
    pending=memory.context('Example Client','default',max_chars=1800)
    assert json.loads(pending['sources'][0]['text']).get('ready') is False or '"ready":false' in pending['sources'][0]['text']
    current=decide(crm,p)
    latest=memory.context('Example Client','default',max_chars=8000)
    assert latest['sources'][0]['version']==str(current['revision'])
    assert 'New role' in latest['sources'][0]['text'] and 'Old role' not in latest['sources'][0]['text']
    for result,limit in [(first,1800),(pending,1800),(latest,8000)]:
        assert result['characters']==sum(len(s['text']) for s in result['sources'])<=limit
    receipt=db.rows('SELECT sources FROM context_routes WHERE id=?',(latest['id'],))[0]['sources']
    assert 'crm/entity/' in receipt and 'New role' not in receipt


def test_replay_after_entity_creation_remains_idempotent(crm):
    raw=evidence(crm,external_id='initial-contact')
    e=decide(crm,propose(crm,[dict(field='given_name',value='Example')],signal=raw))
    again=evidence(crm,external_id='initial-contact',when=datetime.fromtimestamp(raw['source_time'],timezone.utc))
    assert again['id']==raw['id']
    assert crm.read(e['id'])['freshness']['ready']


def test_only_one_concurrent_decision_commits(crm):
    from concurrent.futures import ThreadPoolExecutor
    e=person(crm)
    p=propose(crm,[dict(field='given_name',value='Changed')],entity=e['id'])
    decision=dict(proposal_id=p['id'],expected_revision=crm.read(e['id'])['revision'],accept=True,reason='Concurrent test')
    def attempt():
        try: return crm.decide(decision)['id']
        except FileExistsError: return 'conflict'
    with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda _:attempt(),range(2)))
    assert results.count(e['id'])==1 and results.count('conflict')==1


def test_end_to_end_api_and_login_required(config):
    config.access_token='synthetic-'+'x'*40
    with TestClient(create_app(config)) as client:
        assert client.get('/api/crm/schema').status_code==401
        client.headers['Authorization']='Bearer '+config.access_token
        raw=client.post('/api/crm/sources',json={'evidence':{'kind':'manual','external_id':'manual-one','source_time':datetime.now(timezone.utc).isoformat(),'payload':{'name':'Example Client'}}})
        assert raw.status_code==200
        p=client.post('/api/crm/proposals',json=dict(signal_id=raw.json()['id'],kind='person',base_revision=0,reason='Explicit input',changes=[dict(field='display_name',value='Example Client')]))
        assert p.status_code==200
        assert client.post('/api/crm/query',json={}).json()['results']==[]
        result=client.post('/api/crm/decisions',json=dict(proposal_id=p.json()['id'],expected_revision=0,accept=True,reason='Owner confirms'))
        assert result.status_code==200
        entity=result.json()
        assert client.get('/api/crm/entities/'+entity['id']).json()['id']==entity['id']
        assert client.post('/api/crm/entities/'+entity['id']+'/check',json={'revision':entity['revision']}).status_code==200
        assert client.get('/api/crm/entities/'+entity['id']+'/history').json()['facts']


def test_archive_is_explicit_and_preserves_history(crm):
    e=person(crm)
    archived=crm.archive(e['id'],e['revision'],True,'No longer active')
    assert archived['archived'] and not archived['freshness']['ready'] and crm.search({})['results']==[]
    with pytest.raises(ValueError,match='Archivierten'):propose(crm,[dict(field='given_name',value='Change')],entity=e['id'])
    current=crm.read(e['id'])
    restored=crm.archive(e['id'],current['revision'],False,'Owner restores')
    assert not restored['archived'] and value(restored,'given_name')=='Example'
    assert len(crm.search({})['results'])==1
