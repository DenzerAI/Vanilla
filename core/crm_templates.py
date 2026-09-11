"""Neutral starter definitions. Installing copies them into workspace-owned data.

Published versions stay immutable. New product defaults require a new version;
neither reading the catalog nor starting the application installs anything.
"""
import copy


TEMPLATES = {
    ('people-deals', 1): {
        'id': 'people-deals',
        'version': 1,
        'label': 'Kontakte und Deals',
        'workflow': {
            'label': 'Deals',
            'initial': 'lead',
            'stages': [
                {'id': 'lead', 'label': 'Lead', 'transitions': ['offer', 'active', 'lost']},
                {'id': 'offer', 'label': 'Angebot', 'transitions': ['lead', 'active', 'lost']},
                {'id': 'active', 'label': 'Laufend', 'transitions': ['completed', 'lost']},
                {'id': 'completed', 'label': 'Abgeschlossen', 'terminal': True},
                {'id': 'lost', 'label': 'Verloren', 'terminal': True},
            ],
        },
        'views': [
            {'key': 'people', 'label': 'People', 'kind': 'person', 'layout': 'list',
             'columns': ['display_name', 'given_name', 'family_name', 'email', 'phone', 'job_title']},
            {'key': 'companies', 'label': 'Firmen', 'kind': 'organization', 'layout': 'list',
             'columns': ['name', 'role', 'email', 'phone']},
            {'key': 'deals', 'label': 'Deals', 'kind': 'case', 'layout': 'list',
             'columns': ['title', 'amount', 'owner', 'process.stage', 'process.next_step', 'process.due_date']},
            {'key': 'pipeline', 'label': 'Pipeline', 'kind': 'case', 'layout': 'board',
             'columns': ['title', 'amount', 'owner', 'process.next_step', 'process.due_date']},
        ],
    },
}


def catalog():
    return copy.deepcopy(list(TEMPLATES.values()))


def template(template_id, version):
    definition = TEMPLATES.get((template_id, version))
    if definition is None:
        raise ValueError('CRM-Vorlage oder Version nicht vorhanden.')
    return copy.deepcopy(definition)
