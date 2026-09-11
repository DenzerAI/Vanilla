"""Starter installation never replaces workspace definitions or business facts."""
import copy
import json
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from core.app import create_app
from core.crm import CRM
from core.crm_templates import TEMPLATES
from core.database import Database
from core.tests.test_core import config, db
from core.tests.test_crm import crm, decide, evidence, person, propose, value, workflow


INSTALL = dict(template_id='people-deals', version=1, namespace='sales')


def saved(crm, key):
    return next(v for v in crm.schema()['views'] if v['id'] == 'sales-' + key)


def deal(crm, title, workflow_id='sales-deals'):
    return decide(crm, propose(crm, [
        dict(field='title', value=title),
        dict(field='amount', value={'minor_units': 25000, 'currency': 'EUR'}),
        dict(field='process', value=dict(workflow=workflow_id, stage='lead',
                                        next_step='Kontakt aufnehmen', due_date='2026-10-01')),
    ], kind='case'))


def test_catalog_and_startup_do_not_install_or_create_business_data(crm, db):
    assert crm.schema()['template_installations'] == []
    catalog = crm.templates()
    catalog['templates'][0]['workflow']['label'] = 'Changed copy'
    assert crm.templates()['templates'][0]['workflow']['label'] == 'Deals'
    CRM(db)
    assert crm.schema()['workflows'] == []
    assert crm.schema()['views'] == []
    assert crm.search({})['results'] == []
    result = crm.install_template(INSTALL)
    assert result['created']
    assert crm.search({})['results'] == []
    assert crm.schema()['entities']['case'].keys() == {'title', 'case_type', 'owner', 'notes', 'tag', 'amount', 'process'}


def test_updates_retries_and_restore_preserve_customer_configuration(crm, db, monkeypatch):
    crm.install_template(INSTALL)
    local = crm.save_view(dict(saved(crm, 'people')['definition'], label='Unsere Kontakte',
                              columns=['given_name', 'phone'], expected_revision=1))
    crm.define_field(dict(entity_kind='person', key='custom.region', label='Region', type='text'))
    workflow(crm)  # Independent business workflow must remain untouched.
    contact = person(crm)
    current_deal = deal(crm, 'Example deal')
    before = crm.schema()
    audit = db.rows('SELECT * FROM crm_audit')
    # A future catalog version is available, but existing installations stay pinned.
    new_template = copy.deepcopy(TEMPLATES[('people-deals', 1)])
    new_template['version'] = 2
    new_template['workflow']['label'] = 'New product default'
    monkeypatch.setitem(TEMPLATES, ('people-deals', 2), new_template)
    restarted = CRM(db)
    assert not restarted.install_template(INSTALL)['created']
    with pytest.raises(FileExistsError):
        restarted.install_template(dict(INSTALL, version=2))
    assert restarted.schema() == before
    assert db.rows('SELECT * FROM crm_audit') == audit
    assert saved(restarted, 'people') == local
    assert restarted.read(contact['id']) == contact
    assert restarted.read(current_deal['id']) == current_deal
    restarted.install_template(dict(INSTALL, namespace='other', version=2))
    assert saved(restarted, 'people') == local
    backup = db.file.parent / 'crm-restored.sqlite3'
    db.backup(backup)
    restored_db = Database(backup)
    try:
        restored = CRM(restored_db)
        assert restored.schema() == restarted.schema()
        assert restored.read(current_deal['id']) == current_deal
        assert not restored.install_template(INSTALL)['created']
        snapshot = json.loads(restored_db.rows("SELECT snapshot FROM crm_template_installations WHERE namespace='sales'")[0]['snapshot'])
        assert snapshot['version'] == 1 and snapshot['workflow']['label'] == 'Deals'
    finally:
        restored_db.close()


@pytest.mark.parametrize('collision', ['workflow', 'view'])
def test_installation_is_atomic_on_existing_resource_collision(crm, db, collision):
    if collision == 'workflow':
        crm.define_workflow(dict(id='sales-deals', label='Own process', initial='new', stages=[dict(id='new', label='New')]))
    else:
        # The last view collides after the workflow and earlier views have been inserted.
        crm.save_view(dict(id='sales-pipeline', label='Own view', kind='person', columns=['given_name'], expected_revision=0))
    before = crm.schema()
    audit = db.rows('SELECT * FROM crm_audit')
    with pytest.raises(FileExistsError):
        crm.install_template(INSTALL)
    assert crm.schema() == before
    assert db.rows('SELECT * FROM crm_audit') == audit


def test_concurrent_installation_is_idempotent(crm, db):
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(crm.install_template, [INSTALL, INSTALL]))
    assert sorted(r['created'] for r in results) == [False, True]
    assert len(crm.schema()['views']) == 4
    assert len(crm.schema()['template_installations']) == 1
    assert len(db.rows("SELECT * FROM crm_audit WHERE action='template.install'")) == 1


def test_deals_are_independent_of_contacts_and_share_list_board_facts(crm):
    crm.install_template(INSTALL)
    company = decide(crm, propose(crm, [dict(field='name', value='Example organization')], kind='organization'))
    contact = person(crm)
    first, second = deal(crm, 'First deal'), deal(crm, 'Second deal')
    for entry in [first, second]:
        for target in [company, contact]:
            signal = evidence(crm, entry['id'])
            crm.classify_signal(signal['id'], 'ignored', 'Relationship evidence')
            crm.relate(dict(entity_id=entry['id'], target_type='entity', target_id=target['id'],
                            relation='participant', signal_id=signal['id'], role='Customer',
                            expected_revision=crm.read(entry['id'])['revision'], reason='Link customer'))
    for stage in ['offer', 'active', 'completed']:
        first = decide(crm, propose(crm, [dict(field='process', value=dict(
            workflow='sales-deals', stage=stage, next_step='Follow up' if stage != 'completed' else '',
            due_date='2026-10-02' if stage != 'completed' else None))], entity=first['id'], kind='case'))
    second = decide(crm, propose(crm, [dict(field='process', value=dict(
        workflow='sales-deals', stage='lost', outcome='Declined'))], entity=second['id'], kind='case'))
    assert value(first, 'process')['stage'] == 'completed'
    assert value(second, 'process')['stage'] == 'lost'
    assert crm.read(contact['id'])['kind'] == 'person'
    assert 'process' not in crm.read(contact['id'])['fields']
    other = crm.install_template(dict(INSTALL, namespace='service'))
    unrelated = deal(crm, 'Other process', other['resources']['workflow'])
    for key in ['deals', 'pipeline']:
        definition = saved(crm, key)['definition']
        results = crm.search(dict(kind=definition['kind'], filters=definition['filters']))['results']
        assert {r['id'] for r in results} == {first['id'], second['id']}
        assert unrelated['id'] not in {r['id'] for r in results}
    assert len(crm.read(company['id'])['relations']) == 2


def test_upgrade_from_previous_schema_preserves_data_and_does_not_seed(crm, db):
    contact = person(crm)
    workflow(crm)
    db.connection.execute('DROP TABLE crm_template_installations')
    upgraded = CRM(db)
    assert upgraded.read(contact['id']) == contact
    assert [w['id'] for w in upgraded.schema()['workflows']] == ['service']
    assert upgraded.schema()['template_installations'] == []
    upgraded.install_template(INSTALL)
    assert upgraded.read(contact['id']) == contact


def test_installation_api_requires_owner_and_agents_cannot_install(config):
    with TestClient(create_app(config)) as client:
        assert client.get('/api/crm/templates').status_code == 200
        assert client.post('/api/crm/templates/install', json=INSTALL).status_code == 403
        client.headers['x-uwe-token'] = client.get('/api/auth/session').json()['token']
        response = client.post('/api/crm/templates/install', json=INSTALL)
        assert response.status_code == 200 and response.json()['created']
        assert not client.post('/api/crm/templates/install', json=INSTALL).json()['created']
        assert client.post('/api/crm/templates/install', json=dict(INSTALL, version=2)).status_code == 409
        for bad in [dict(INSTALL, namespace='../escape'), dict(INSTALL, version=True), dict(INSTALL, overwrite=True)]:
            assert client.post('/api/crm/templates/install', json=bad).status_code == 422
        assert client.post('/api/crm/tool', json=dict(name='crm_install_template', arguments={'projectId': 'default', **INSTALL})).status_code == 400
