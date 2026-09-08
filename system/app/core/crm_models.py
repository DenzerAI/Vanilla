"""Typed CRM vocabulary. Views and providers do not define the storage model."""
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Email(Strict):
    address: str = Field(min_length=3, max_length=254)
    label: str = Field(default='work', max_length=40)
    primary: bool = False

    @field_validator('address')
    @classmethod
    def valid_address(cls, value):
        import re
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            raise ValueError('Ungültige E-Mail-Adresse.')
        return value


class Phone(Strict):
    number: str = Field(min_length=3, max_length=60)
    label: str = Field(default='work', max_length=40)
    extension: str = Field(default='', max_length=15)
    primary: bool = False

    @field_validator('number')
    @classmethod
    def valid_number(cls, value):
        import re
        if not re.fullmatch(r'\+?[0-9 ()/.-]+', value) or len(re.sub(r'\D', '', value)) < 3:
            raise ValueError('Ungültige Telefonnummer.')
        return value


class Address(Strict):
    label: str = Field(default='business', max_length=40)
    street: str = Field(default='', max_length=300)
    addition: str = Field(default='', max_length=200)
    postal_code: str = Field(default='', max_length=30)
    city: str = Field(default='', max_length=150)
    region: str = Field(default='', max_length=150)
    country: str = Field(default='', max_length=100)
    country_code: str = Field(default='', pattern=r'^([A-Z]{2})?$')
    primary: bool = False


class Money(Strict):
    minor_units: int = Field(strict=True, ge=0, le=10**15)
    currency: str = Field(pattern=r'^[A-Z]{3}$')


class Process(Strict):
    workflow: str = Field(min_length=1, max_length=80)
    stage: str = Field(min_length=1, max_length=80)
    next_step: str = Field(default='', max_length=500)
    due_date: date | None = None
    outcome: str = Field(default='', max_length=100)


class Change(Strict):
    field: str = Field(pattern=r'^[a-z][a-z0-9_.]{0,79}$')
    slot: str = Field(default='', max_length=100)
    value: object  # None explicitly clears a value; a missing value is rejected.


class Evidence(Strict):
    kind: Literal['message', 'contact', 'document', 'event', 'manual', 'other']
    external_id: str = Field(min_length=1, max_length=300)
    source_time: datetime
    payload: dict = Field(default_factory=dict)
    entity_id: str | None = Field(default=None, max_length=80)

    @field_validator('source_time')
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None:
            raise ValueError('Quellzeit benötigt eine Zeitzone.')
        return value


class Proposal(Strict):
    signal_id: str
    entity_id: str | None = None
    kind: Literal['person', 'organization', 'case']
    base_revision: int = Field(strict=True, ge=0)
    changes: list[Change] = Field(min_length=1, max_length=100)
    confidence: Literal['uncertain', 'likely', 'explicit'] = 'uncertain'
    reason: str = Field(min_length=1, max_length=1000)


class Decision(Strict):
    proposal_id: str
    expected_revision: int = Field(strict=True, ge=0)
    accept: bool
    reason: str = Field(min_length=1, max_length=1000)


class FieldDefinition(Strict):
    entity_kind: Literal['person', 'organization', 'case']
    key: str = Field(pattern=r'^custom\.[a-z][a-z0-9_]{0,60}$')
    label: str = Field(min_length=1, max_length=100)
    type: Literal['text', 'date', 'boolean', 'integer', 'choice']
    multiple: bool = False
    options: list[str] = Field(default_factory=list, max_length=50)


class Stage(Strict):
    id: str = Field(pattern=r'^[a-z][a-z0-9_-]{0,59}$')
    label: str = Field(min_length=1, max_length=100)
    terminal: bool = False
    transitions: list[str] = Field(default_factory=list, max_length=30)


class Workflow(Strict):
    id: str = Field(pattern=r'^[a-z][a-z0-9_-]{0,59}$')
    label: str = Field(min_length=1, max_length=100)
    initial: str
    stages: list[Stage] = Field(min_length=1, max_length=30)


class ExternalID(Strict):
    connection_id: str = Field(min_length=1, max_length=100)
    object_type: str = Field(min_length=1, max_length=80)
    external_id: str = Field(min_length=1, max_length=300)
    entity_id: str
    signal_id: str
    expected_revision: int = Field(strict=True, ge=1)
    reason: str = Field(min_length=1, max_length=1000)


class Relation(Strict):
    entity_id: str
    target_type: Literal['entity', 'project', 'chat']
    target_id: str = Field(min_length=1, max_length=100)
    relation: Literal['works_at', 'contact_for', 'participant', 'related_to']
    role: str = Field(default='', max_length=100)
    department: str = Field(default='', max_length=100)
    expected_revision: int = Field(strict=True, ge=1)
    signal_id: str
    reason: str = Field(min_length=1, max_length=1000)


class Filter(Strict):
    field: str
    equals: object


class EntityQuery(Strict):
    kind: Literal['person', 'organization', 'case'] | None = None
    query: str = Field(default='', max_length=200)
    filters: list[Filter] = Field(default_factory=list, max_length=10)
    limit: int = Field(default=30, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class SavedView(Strict):
    id: str = Field(pattern=r'^[a-z][a-z0-9_-]{0,59}$')
    label: str = Field(min_length=1, max_length=100)
    kind: Literal['person', 'organization', 'case']
    layout: Literal['list', 'board'] = 'list'
    workflow: str | None = None
    columns: list[str] = Field(min_length=1, max_length=12)
    filters: list[Filter] = Field(default_factory=list, max_length=10)
    expected_revision: int = Field(strict=True, ge=0)


# Birth date is intentionally not a default field. A user can explicitly define a date extension.
STANDARD = {}
for entity_kind, names in {
    'person': [('given_name','Vorname'),('middle_name','Weitere Vornamen'),('family_name','Nachname'),('display_name','Anzeigename'),('salutation','Anrede'),('name_suffix','Namenszusatz'),('job_title','Position'),('department','Abteilung'),('language','Sprache'),('website','Webseite')],
    'organization': [('name','Firmenname'),('legal_name','Rechtlicher Name'),('vat_id','USt-ID'),('registration_number','Registernummer'),('website','Webseite'),('industry','Branche')],
    'case': [('title','Vorgang'),('case_type','Vorgangsart'),('owner','Zuständig')],
}.items():
    STANDARD[entity_kind] = {key:dict(type='text', label=label, multiple=False) for key,label in names}
    STANDARD[entity_kind].update(notes=dict(type='notes', label='Notizen', multiple=False), tag=dict(type='text', label='Schlagwort', multiple=True))
for entity_kind in ['person','organization']:
    STANDARD[entity_kind].update(email=dict(type='email', label='E-Mail', multiple=True), phone=dict(type='phone', label='Telefon', multiple=True), address=dict(type='address', label='Adresse', multiple=True))
STANDARD['organization']['role'] = dict(type='choice', label='Geschäftsbeziehung', multiple=True, options=['customer','prospect','supplier','partner','other'])
STANDARD['case'].update(process=dict(type='process', label='Ablauf', multiple=False), amount=dict(type='money', label='Betrag', multiple=False))
