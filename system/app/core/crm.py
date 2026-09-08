"""Workspace CRM. Evidence, proposals and versioned facts share one validated write service."""
from __future__ import annotations

import copy
import json
import re
from datetime import date
from time import time
from uuid import uuid4

from .database import dump
from .crm_schema import SCHEMA
from .crm_models import (STANDARD, Address, Change, Decision, Email, EntityQuery, Evidence,
                         ExternalID, FieldDefinition, Money, Phone, Process, Proposal,
                         Relation, SavedView, Workflow)


def uid():
    return str(uuid4())


def phone_key(number):
    value = re.sub(r'[ ()/.-]', '', number)
    if value.startswith('00'):
        value = '+' + value[2:]
    # Local numbers remain searchable, but cannot be identity evidence without country context.
    return value if re.fullmatch(r'\+[1-9][0-9]{6,14}', value) else 'local:' + value


class CRM:
    def __init__(self, db):
        self.db = db
        with db.lock:
            db.connection.executescript(SCHEMA)
            db.connection.execute('INSERT OR IGNORE INTO schema_versions VALUES(3,?)', (time(),))

    def _audit(self, cx, entity, action, actor, reason, reference):
        cx.execute('INSERT INTO crm_audit(entity_id,action,actor,reason,reference,created_at) VALUES(?,?,?,?,?,?)',
                   (entity, action, actor, reason, reference, time()))

    def _entity(self, cx, entity_id, expected=None):
        row = cx.execute('SELECT * FROM crm_entities WHERE id=?', (entity_id,)).fetchone()
        if not row:
            raise ValueError('CRM-Eintrag nicht gefunden.')
        if expected is not None and row['revision'] != expected:
            raise FileExistsError('CRM-Stand wurde geändert. Neu lesen und Entscheidung prüfen.')
        return row

    def _touch(self, cx, entity_id):
        cx.execute('UPDATE crm_entities SET revision=revision+1 WHERE id=?', (entity_id,))

    def fields(self, kind):
        if kind not in STANDARD:
            raise ValueError('Unbekannte CRM-Entität.')
        result = copy.deepcopy(STANDARD[kind])
        for row in self.db.rows('SELECT key,definition FROM crm_fields WHERE entity_kind=?', (kind,)):
            result[row['key']] = json.loads(row['definition'])
        return result

    def schema(self):
        return {'version': 1, 'scope': 'workspace', 'entities': {k:self.fields(k) for k in STANDARD},
                'workflows': [json.loads(r['definition']) for r in self.db.rows('SELECT definition FROM crm_workflows ORDER BY id')],
                'views': [dict(id=r['id'],revision=r['revision'],definition=json.loads(r['definition'])) for r in self.db.rows('SELECT * FROM crm_views ORDER BY id')],
                'rules': ['source_then_proposal_then_decision', 'per_field_provenance', 'version_required',
                          'open_case_requires_next_step_and_date', 'no_name_merge', 'no_note_fallback'],
                'sync': 'No automatic connector polling or external writes are enabled.'}

    def define_field(self, definition, actor='owner'):
        definition = FieldDefinition.model_validate(definition)
        if definition.type == 'choice' and (not definition.options or len(set(definition.options)) != len(definition.options)):
            raise ValueError('Auswahlfeld braucht eindeutige Auswahlwerte.')
        if definition.type != 'choice' and definition.options:
            raise ValueError('Nur Auswahlfelder besitzen Auswahlwerte.')
        if any(not v.strip() or len(v)>100 for v in definition.options):
            raise ValueError('Ungültiger Auswahlwert.')
        with self.db.transaction() as cx:
            if cx.execute('SELECT 1 FROM crm_fields WHERE entity_kind=? AND key=?', (definition.entity_kind,definition.key)).fetchone():
                raise FileExistsError('Felddefinition existiert. Typänderungen benötigen eine Migration.')
            cx.execute('INSERT INTO crm_fields VALUES(?,?,?)', (definition.entity_kind, definition.key, dump(definition.model_dump())))
            self._audit(cx, None, 'field.define', actor, 'Typisiertes Zusatzfeld angelegt', definition.key)
        return self.schema()

    def define_workflow(self, definition, actor='owner'):
        definition = Workflow.model_validate(definition)
        ids = {s.id for s in definition.stages}
        if len(ids) != len(definition.stages) or definition.initial not in ids:
            raise ValueError('Start und Zustandskennungen müssen eindeutig sein.')
        if any(not set(s.transitions) <= ids or len(set(s.transitions)) != len(s.transitions) for s in definition.stages):
            raise ValueError('Übergang verweist auf einen unbekannten oder doppelten Zustand.')
        with self.db.transaction() as cx:
            if cx.execute('SELECT 1 FROM crm_workflows WHERE id=?',(definition.id,)).fetchone():
                raise FileExistsError('Ablauf existiert. Änderungen als neue Ablaufversion anlegen.')
            cx.execute('INSERT INTO crm_workflows VALUES(?,?)', (definition.id, dump(definition.model_dump())))
            self._audit(cx, None, 'workflow.define', actor, 'Ablauf angelegt', definition.id)
        return definition.model_dump()

    def normalize(self, kind, change):
        change = Change.model_validate(change)
        definition = self.fields(kind).get(change.field)
        if not definition:
            raise ValueError('Unbekanntes Feld. Zuerst ein typisiertes Feld definieren.')
        if bool(change.slot) != bool(definition['multiple']):
            raise ValueError('Mehrfachwerte brauchen eine stabile Slot-ID; Einzelwerte haben keinen Slot.')
        value, typ = change.value, definition['type']
        if value is None:
            return change, 'null'
        models = dict(email=Email, phone=Phone, address=Address, money=Money, process=Process)
        if typ in models:
            value = models[typ].model_validate(value).model_dump(mode='json')
        elif typ in {'text','notes','choice','date'}:
            if not isinstance(value,str) or not value.strip() or len(value) > (10000 if typ=='notes' else 1000):
                raise ValueError('Ungültiger Textwert.')
            value = value.strip()
            if typ=='date':
                value = date.fromisoformat(value).isoformat()
            if typ=='choice' and value not in definition['options']:
                raise ValueError('Unbekannter Auswahlwert.')
        elif typ=='boolean' and type(value) is not bool:
            raise ValueError('Wahrheitswert erforderlich.')
        elif typ=='integer' and (type(value) is not int or abs(value)>2**53):
            raise ValueError('Ganze Zahl erforderlich.')
        change = change.model_copy(update={'value':value})
        if typ=='email':
            normalized = value['address'].casefold()
        elif typ=='phone':
            normalized = phone_key(value['number']) + (('#'+value['extension']) if value['extension'] else '')
        elif isinstance(value,str):
            normalized = value.casefold()
        else:
            normalized = dump(value)
        return change, normalized

    def _connection(self, connection_id):
        if connection_id == 'local':
            return {'id':'local','provider':'local'}
        state = self.db.get('control/state.json')['value'] or {}
        connections = state.get('connections', [])
        connection = next((c for c in connections if c.get('id')==connection_id), None)
        if not connection:
            raise ValueError('Verbindung nicht vorhanden. Bestehenden Verbindungsbereich verwenden.')
        return connection

    def receive(self, connection_id, evidence, actor='connector'):
        evidence = Evidence.model_validate(evidence)
        self._connection(connection_id)
        payload = dump(evidence.payload)
        if len(payload.encode()) > 1_000_000:
            raise ValueError('Rohsignal zu groß.')
        with self.db.transaction() as cx:
            old = cx.execute('SELECT * FROM crm_signals WHERE connection_id=? AND kind=? AND external_id=?',
                             (connection_id,evidence.kind,evidence.external_id)).fetchone()
            if old:
                if (old['payload'] != payload or old['source_time'] != evidence.source_time.timestamp()
                    or (evidence.entity_id is not None and old['entity_id'] != evidence.entity_id)):
                    raise FileExistsError('Ereigniskennung bereits mit anderem Inhalt vorhanden. Objektversion berücksichtigen.')
                return dict(old, payload=json.loads(old['payload']))
            if evidence.entity_id:
                self._entity(cx,evidence.entity_id)
                self._touch(cx,evidence.entity_id)
            signal_id = uid()
            cx.execute('INSERT INTO crm_signals VALUES(?,?,?,?,?,?,?,?,?,?)',
                       (signal_id,connection_id,evidence.kind,evidence.external_id,evidence.source_time.timestamp(),time(),actor,payload,evidence.entity_id,'pending'))
            self._audit(cx,evidence.entity_id,'signal.receive',actor,'Rohsignal eingegangen',signal_id)
        return self.signal(signal_id)

    def signal(self, signal_id):
        rows = self.db.rows('SELECT * FROM crm_signals WHERE id=?',(signal_id,))
        if not rows:
            raise ValueError('Quelle nicht gefunden.')
        return dict(rows[0], payload=json.loads(rows[0]['payload']))

    def classify_signal(self, signal_id, status, reason, actor='owner'):
        if status not in {'ignored','error'} or not isinstance(reason,str) or not reason.strip() or len(reason)>1000:
            raise ValueError('Status und Begründung erforderlich.')
        with self.db.transaction() as cx:
            row = cx.execute('SELECT * FROM crm_signals WHERE id=?',(signal_id,)).fetchone()
            if not row:
                raise ValueError('Quelle nicht gefunden.')
            if cx.execute('SELECT 1 FROM crm_proposals WHERE signal_id=?',(signal_id,)).fetchone():
                raise ValueError('Vorschlag bereits vorhanden. Dessen Entscheidung verwenden.')
            cx.execute('UPDATE crm_signals SET status=? WHERE id=?',(status,signal_id))
            if row['entity_id']:
                self._touch(cx,row['entity_id'])
            self._audit(cx,row['entity_id'],'signal.'+status,actor,reason,signal_id)
        return self.signal(signal_id)

    def propose(self, proposal, actor='agent'):
        proposal = Proposal.model_validate(proposal)
        values = [self.normalize(proposal.kind,c) for c in proposal.changes]
        if len({(c.field,c.slot) for c,n in values}) != len(values):
            raise ValueError('Ein Feldwert darf nur einmal im Vorschlag vorkommen.')
        with self.db.transaction() as cx:
            source = cx.execute('SELECT * FROM crm_signals WHERE id=?',(proposal.signal_id,)).fetchone()
            if not source:
                raise ValueError('Quelle nicht gefunden.')
            previous = cx.execute('SELECT id FROM crm_proposals WHERE signal_id=?',(proposal.signal_id,)).fetchone()
            if previous:
                raise FileExistsError('Quelle hat bereits einen Vorschlag. Erst entscheiden, dann bei Bedarf neu begründen.')
            if source['status'] not in {'pending','error'}:
                raise ValueError('Quelle ist bereits eingeordnet.')
            if source['entity_id'] and source['entity_id'] != proposal.entity_id:
                raise ValueError('Quelle gehört zu einem anderen CRM-Eintrag.')
            if proposal.entity_id:
                entity = self._entity(cx,proposal.entity_id,proposal.base_revision)
                if entity['archived']:
                    raise ValueError('Archivierten Eintrag zuerst ausdrücklich wiederherstellen.')
                if entity['kind'] != proposal.kind:
                    raise ValueError('Entitätstyp stimmt nicht überein.')
            elif proposal.base_revision != 0:
                raise ValueError('Neue Entität beginnt bei Version 0.')
            proposal_id = uid()
            cx.execute('INSERT INTO crm_proposals(id,signal_id,entity_id,kind,base_revision,status,confidence,actor,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
                       (proposal_id,proposal.signal_id,proposal.entity_id,proposal.kind,proposal.base_revision,'pending',proposal.confidence,actor,proposal.reason,time()))
            for change, normalized in values:
                cx.execute('INSERT INTO crm_proposal_values VALUES(?,?,?,?,?)',
                           (proposal_id,change.field,change.slot,dump(change.value),normalized))
            cx.execute('UPDATE crm_signals SET status=?,entity_id=? WHERE id=?',('processed',proposal.entity_id,proposal.signal_id))
            if proposal.entity_id:
                self._touch(cx,proposal.entity_id)
            self._audit(cx,proposal.entity_id,'proposal.create',actor,proposal.reason,proposal_id)
        return self.proposal(proposal_id)

    def proposal(self, proposal_id):
        rows = self.db.rows('SELECT * FROM crm_proposals WHERE id=?',(proposal_id,))
        if not rows:
            raise ValueError('Vorschlag nicht gefunden.')
        return dict(rows[0], changes=[dict(r,value=json.loads(r['value'])) for r in self.db.rows(
            'SELECT field,slot,value FROM crm_proposal_values WHERE proposal_id=? ORDER BY field,slot',(proposal_id,))])

    def _validate_result(self, cx, kind, values, previous):
        def value(field):
            return values.get((field,''))
        if kind=='person' and not any(value(f) for f in ['display_name','given_name','family_name']):
            raise ValueError('Person benötigt einen Namen; Vor- und Nachname sind nicht beide Pflicht.')
        if kind=='organization' and not value('name'):
            raise ValueError('Firma benötigt einen Namen.')
        for field in ['email','phone','address']:
            items = [v for (f,s),v in values.items() if f==field and v is not None]
            if sum(bool(v.get('primary')) for v in items) > 1:
                raise ValueError('Nur ein bevorzugter Wert pro Kontaktart möglich.')
        if kind=='case':
            if not value('title') or not value('process'):
                raise ValueError('Vorgang benötigt Titel und Ablauf.')
            process = value('process')
            rows = cx.execute('SELECT definition FROM crm_workflows WHERE id=?',(process['workflow'],)).fetchone()
            if not rows:
                raise ValueError('Ablauf ist nicht definiert.')
            workflow = json.loads(rows['definition'])
            stages = {s['id']:s for s in workflow['stages']}
            if process['stage'] not in stages:
                raise ValueError('Unbekannter Zustand.')
            old = previous.get(('process',''))
            if old:
                if old['workflow'] != process['workflow']:
                    raise ValueError('Ablaufwechsel benötigt eine ausdrückliche Migration.')
                if old['stage'] != process['stage'] and process['stage'] not in stages[old['stage']]['transitions']:
                    raise ValueError('Dieser Zustandsübergang ist nicht erlaubt.')
            elif process['stage'] != workflow['initial']:
                raise ValueError('Neuer Vorgang muss im Startzustand beginnen.')
            if not stages[process['stage']]['terminal'] and (not process['next_step'] or not process['due_date']):
                raise ValueError('Offener Zustand braucht nächsten Schritt und Datum.')

    def decide(self, decision, actor='owner'):
        decision = Decision.model_validate(decision)
        with self.db.transaction() as cx:
            proposal = cx.execute('SELECT * FROM crm_proposals WHERE id=?',(decision.proposal_id,)).fetchone()
            if not proposal:
                raise ValueError('Vorschlag nicht gefunden.')
            if proposal['status'] != 'pending':
                raise FileExistsError('Vorschlag ist bereits entschieden.')
            entity_id = proposal['entity_id']
            if entity_id:
                entity = self._entity(cx,entity_id,decision.expected_revision)
                if entity['archived'] and decision.accept:
                    raise ValueError('Archivierten Eintrag zuerst ausdrücklich wiederherstellen.')
            elif decision.expected_revision != 0:
                raise FileExistsError('Neue Entität benötigt Version 0.')
            changes = list(cx.execute('SELECT * FROM crm_proposal_values WHERE proposal_id=?',(proposal['id'],)))
            source = cx.execute('SELECT * FROM crm_signals WHERE id=?',(proposal['signal_id'],)).fetchone()
            if decision.accept:
                if entity_id and cx.execute('SELECT 1 FROM crm_signals WHERE entity_id=? AND status IN (\'pending\',\'error\')',(entity_id,)).fetchone():
                    raise FileExistsError('Neuere oder fehlerhafte Eingänge müssen vor der Übernahme geprüft werden.')
                old_rows = list(cx.execute('SELECT * FROM crm_facts WHERE entity_id=? AND active=1',(entity_id,))) if entity_id else []
                previous = {(r['field'],r['slot']):json.loads(r['value']) for r in old_rows}
                prospective = dict(previous)
                for change in changes:
                    # Recheck custom definitions and typed values inside the write transaction.
                    typed,_ = self.normalize(proposal['kind'],dict(field=change['field'],slot=change['slot'],value=json.loads(change['value'])))
                    prospective[(typed.field,typed.slot)] = typed.value
                    for old in old_rows:
                        if (old['field'],old['slot']) == (typed.field,typed.slot) and (old['source_time'] > source['source_time'] or old['decided_at'] > proposal['created_at']):
                            raise FileExistsError('Vorschlag ist älter als der aktuelle Feldstand. Neuen Vorschlag erstellen.')
                self._validate_result(cx,proposal['kind'],prospective,previous)
                if not entity_id:
                    entity_id = uid()
                    cx.execute('INSERT INTO crm_entities(id,kind,revision,created_at) VALUES(?,?,?,?)',(entity_id,proposal['kind'],0,time()))
                    cx.execute('UPDATE crm_proposals SET entity_id=? WHERE id=?',(entity_id,proposal['id']))
                    cx.execute('UPDATE crm_signals SET entity_id=? WHERE id=?',(entity_id,source['id']))
                now = time()
                for change in changes:
                    cx.execute('UPDATE crm_facts SET active=0 WHERE entity_id=? AND field=? AND slot=? AND active=1',
                               (entity_id,change['field'],change['slot']))
                    cx.execute('INSERT INTO crm_facts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                               (uid(),entity_id,change['field'],change['slot'],change['value'],change['normalized'],source['id'],proposal['id'],proposal['actor'],actor,proposal['confidence'],source['source_time'],now,now,1))
            if not decision.accept and entity_id:
                for change in changes:
                    cx.execute('UPDATE crm_facts SET checked_at=? WHERE entity_id=? AND field=? AND slot=? AND active=1',
                               (time(),entity_id,change['field'],change['slot']))
            cx.execute('UPDATE crm_proposals SET status=?,decided_by=?,decided_at=?,decision_reason=? WHERE id=?',
                       ('accepted' if decision.accept else 'rejected',actor,time(),decision.reason,proposal['id']))
            if entity_id:
                self._touch(cx,entity_id)
            self._audit(cx,entity_id,'proposal.accept' if decision.accept else 'proposal.reject',actor,decision.reason,proposal['id'])
        return self.read(entity_id) if entity_id else self.proposal(proposal['id'])

    def read(self, entity_id):
        # One locked snapshot: facts and freshness cannot describe different revisions.
        with self.db.lock:
            entity = dict(self._entity(self.db.connection,entity_id))
            pending = self.db.rows('SELECT p.id,v.field,v.slot,v.value FROM crm_proposals p JOIN crm_proposal_values v ON p.id=v.proposal_id WHERE p.entity_id=? AND p.status=\'pending\'',(entity_id,))
            facts = self.db.rows('SELECT * FROM crm_facts WHERE entity_id=? AND active=1 ORDER BY field,slot',(entity_id,))
            values = {}
            for fact in facts:
                conflict = any((c['field'],c['slot'])==(fact['field'],fact['slot']) and c['value']!=fact['value'] for c in pending)
                fact['status'] = 'review' if conflict else 'current'
                fact['value'] = json.loads(fact['value'])
                values.setdefault(fact['field'],[]).append(fact)
            signals = self.db.rows("SELECT id,status,received_at FROM crm_signals WHERE entity_id=? AND status IN ('pending','error') ORDER BY received_at",(entity_id,))
            entity.update(fields=values, relations=self.db.rows('SELECT * FROM crm_relations WHERE entity_id=? OR (target_type=\'entity\' AND target_id=?)',(entity_id,entity_id)),
                          external_ids=self.db.rows('SELECT * FROM crm_external_ids WHERE entity_id=?',(entity_id,)),
                          freshness=dict(revision=entity['revision'],unprocessed=signals,pending_proposals=sorted({p['id'] for p in pending}),
                                         ready=not signals and not pending and not entity['archived'],coverage='received_signals_only',
                                         instruction='Before acting, re-read this revision. External messages may not yet have been received.'))
            return entity

    def check_revision(self, entity_id, revision):
        with self.db.lock:
            result = self.read(entity_id)
            if result['revision'] != revision or not result['freshness']['ready']:
                raise FileExistsError('Stand ist geändert oder ungeprüft. Akte erneut lesen.')
            return result['freshness']

    def external_id(self, mapping, actor='owner'):
        mapping = ExternalID.model_validate(mapping)
        self._connection(mapping.connection_id)
        source = self.signal(mapping.signal_id)
        if source['connection_id'] != mapping.connection_id:
            raise ValueError('Zuordnung und Quelle gehören nicht zur gleichen Verbindung.')
        if source['entity_id'] and source['entity_id'] != mapping.entity_id:
            raise ValueError('Quelle gehört zu einem anderen Eintrag.')
        with self.db.transaction() as cx:
            self._entity(cx,mapping.entity_id,mapping.expected_revision)
            current = cx.execute('SELECT entity_id FROM crm_external_ids WHERE connection_id=? AND object_type=? AND external_id=?',
                                 (mapping.connection_id,mapping.object_type,mapping.external_id)).fetchone()
            if current:
                if current['entity_id'] != mapping.entity_id:
                    raise FileExistsError('Externe Kennung gehört bereits zu einer anderen Identität. Klärung erforderlich.')
                return self.read(mapping.entity_id)
            cx.execute('INSERT INTO crm_external_ids VALUES(?,?,?,?,?)',(mapping.connection_id,mapping.object_type,mapping.external_id,mapping.entity_id,mapping.signal_id))
            self._touch(cx,mapping.entity_id)
            self._audit(cx,mapping.entity_id,'identity.link',actor,mapping.reason,mapping.signal_id)
        return self.read(mapping.entity_id)

    def resolve(self, *, connection_id=None, object_type=None, external_id=None, email=None, phone=None):
        if external_id is not None:
            if not connection_id or not object_type:
                raise ValueError('Externe Identität benötigt Verbindung und Objekttyp.')
            rows = self.db.rows('SELECT entity_id FROM crm_external_ids WHERE connection_id=? AND object_type=? AND external_id=?',(connection_id,object_type,external_id))
            return {'status':'linked' if rows else 'unmatched','candidates':[r['entity_id'] for r in rows]}
        key, field = None,None
        if email:
            _,key = self.normalize('person',dict(field='email',slot='lookup',value={'address':email}));field='email'
        elif phone:
            _,key = self.normalize('person',dict(field='phone',slot='lookup',value={'number':phone}));field='phone'
        if not key or key.startswith('local:'):
            return {'status':'needs_review','candidates':[], 'reason':'Exakte E-Mail oder internationale Telefonnummer erforderlich.'}
        ids = [r['entity_id'] for r in self.db.rows('SELECT DISTINCT f.entity_id FROM crm_facts f JOIN crm_entities e ON e.id=f.entity_id WHERE e.kind=\'person\' AND f.field=? AND f.normalized=? AND f.active=1',(field,key))]
        return {'status':'candidate' if len(ids)==1 else 'needs_review' if ids else 'unmatched','candidates':ids,
                'reason':'Kontaktmerkmal liefert Kandidaten. Kein automatisches Zusammenführen bestehender Personen.'}

    def relate(self, relation, actor='owner'):
        relation = Relation.model_validate(relation)
        source = self.signal(relation.signal_id)
        if source['entity_id'] and source['entity_id'] != relation.entity_id:
            raise ValueError('Quelle gehört zu einem anderen Eintrag.')
        with self.db.transaction() as cx:
            entity = self._entity(cx,relation.entity_id,relation.expected_revision)
            if relation.target_type=='entity':
                target = self._entity(cx,relation.target_id)
                if relation.entity_id==relation.target_id:
                    raise ValueError('Keine Selbstbeziehung.')
                if relation.relation=='works_at' and (entity['kind']!='person' or target['kind']!='organization'):
                    raise ValueError('Firmenzugehörigkeit verbindet Person und Firma.')
            else:
                if relation.relation=='works_at':
                    raise ValueError('Firmenzugehörigkeit braucht eine Firma.')
                table = 'projects' if relation.target_type=='project' else 'chats'
                if not cx.execute(f'SELECT 1 FROM {table} WHERE id=?',(relation.target_id,)).fetchone():
                    raise ValueError('Verknüpfungsziel nicht vorhanden.')
            identical = cx.execute('SELECT id FROM crm_relations WHERE entity_id=? AND target_type=? AND target_id=? AND relation=? AND role=? AND department=?',
                                   (relation.entity_id,relation.target_type,relation.target_id,relation.relation,relation.role,relation.department)).fetchone()
            if not identical:
                cx.execute('INSERT INTO crm_relations VALUES(?,?,?,?,?,?,?,?,?,?)',
                           (uid(),relation.entity_id,relation.target_type,relation.target_id,relation.relation,relation.role,relation.department,relation.signal_id,actor,time()))
                self._touch(cx,relation.entity_id)
                if relation.target_type=='entity':
                    self._touch(cx,relation.target_id)
                self._audit(cx,relation.entity_id,'relation.create',actor,relation.reason,relation.signal_id)
        return self.read(relation.entity_id)

    def _filter(self, kind, field, value):
        definitions = self.fields(kind)
        # Custom keys contain dots; only explicit object properties can be traversed.
        if field in definitions:
            root, path = field, None
        else:
            root, _, path = field.partition('.')
        definition = definitions.get(root)
        if not definition or definition['type']=='notes':
            raise ValueError('Feld ist nicht strukturiert abfragbar.')
        properties = {'email':Email,'phone':Phone,'address':Address,'process':Process,'money':Money}
        if path:
            model = properties.get(definition['type'])
            if not model or path not in model.model_fields or not isinstance(value,(str,int,bool)):
                raise ValueError('Ungültiger Feldfilter.')
            return root, path, value
        typed,key = self.normalize(kind,dict(field=root,slot='filter' if definition['multiple'] else '',value=value))
        return root, None, key

    def search(self, query):
        query = EntityQuery.model_validate(query)
        if query.filters and not query.kind:
            raise ValueError('Feldfilter benötigen einen Entitätstyp.')
        where, parameters = ['e.archived=0'],[]
        if query.kind:
            where.append('e.kind=?');parameters.append(query.kind)
        if query.query:
            where.append("EXISTS(SELECT 1 FROM crm_facts f WHERE f.entity_id=e.id AND f.active=1 AND f.field IN ('given_name','family_name','display_name','name','title','email','phone','tag') AND instr(f.normalized,?)>0)")
            parameters.append(query.query.casefold())
        for filter in query.filters:
            field,path,value = self._filter(query.kind,filter.field,filter.equals)
            where.append('EXISTS(SELECT 1 FROM crm_facts f WHERE f.entity_id=e.id AND f.active=1 AND f.field=? AND '+('json_extract(f.value,?)=?' if path else 'f.normalized=?')+')')
            parameters.extend([field, '$.'+path,value] if path else [field,value])
        sql = 'SELECT e.id FROM crm_entities e' + (' WHERE '+' AND '.join(where) if where else '') + ' ORDER BY e.id LIMIT ? OFFSET ?'
        with self.db.lock:
            rows = self.db.rows(sql,(*parameters,query.limit+1,query.offset))
            return {'results':[self.read(r['id']) for r in rows[:query.limit]],'has_more':len(rows)>query.limit,
                    'next_offset':query.offset+query.limit if len(rows)>query.limit else None}

    def save_view(self, view, actor='owner'):
        view = SavedView.model_validate(view)
        for key in view.columns:
            root = key if key in self.fields(view.kind) else key.partition('.')[0]
            definition = self.fields(view.kind).get(root)
            path = None if key==root else key[len(root)+1:]
            models = {'email':Email,'phone':Phone,'address':Address,'process':Process,'money':Money}
            if not definition or (path and (definition['type'] not in models or path not in models[definition['type']].model_fields)):
                raise ValueError('Ansicht verwendet unbekanntes Feld.')
        for filter in view.filters:
            self._filter(view.kind,filter.field,filter.equals)
        if view.layout=='board' and (view.kind!='case' or not view.workflow):
            raise ValueError('Board benötigt Vorgänge und einen definierten Ablauf.')
        if view.workflow and not self.db.rows('SELECT 1 FROM crm_workflows WHERE id=?',(view.workflow,)):
            raise ValueError('Ablauf nicht vorhanden.')
        with self.db.transaction() as cx:
            current = cx.execute('SELECT revision FROM crm_views WHERE id=?',(view.id,)).fetchone()
            revision = current['revision'] if current else 0
            if revision != view.expected_revision:
                raise FileExistsError('Ansicht wurde zwischenzeitlich verändert.')
            definition = view.model_dump(exclude={'expected_revision'})
            cx.execute('INSERT INTO crm_views VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,definition=excluded.definition',
                       (view.id,revision+1,dump(definition)))
            self._audit(cx,None,'view.save',actor,'Ansicht gespeichert',view.id)
        return dict(id=view.id,revision=revision+1,definition=definition)

    def context_sources(self, query, budget=2500):
        """Fresh, bounded CRM references for memory requests; no derived CRM summary cache."""
        if not query.strip():
            return []
        with self.db.lock:
            matches = self.db.rows("SELECT DISTINCT entity_id FROM crm_facts JOIN crm_entities ON crm_entities.id=crm_facts.entity_id WHERE archived=0 AND active=1 AND field IN ('display_name','family_name','name','title','email') AND length(normalized)>=4 AND instr(?,normalized)>0 ORDER BY entity_id LIMIT 3",(query.casefold(),))
            result, used = [],0
            for match in matches:
                entity = self.read(match['entity_id'])
                data = dict(id=entity['id'],revision=entity['revision'],kind=entity['kind'],freshness=entity['freshness'],
                            fields={field:[dict(value=f['value'],status=f['status'],source=f['signal_id']) for f in facts] for field,facts in entity['fields'].items() if field!='notes'},
                            instruction='CRM snapshot of received evidence, not external completeness. Use crm_read before acting. Narrative memory is historical and must not override this snapshot.')
                text = dump(data)
                if len(text) > budget-used:
                    text = dump(dict(id=entity['id'],revision=entity['revision'],ready=entity['freshness']['ready'],instruction='Read current CRM facts with crm_read; do not infer current state from historical prose.'))
                if len(text) > budget-used:
                    break
                result.append(dict(path='crm/entity/'+entity['id'],version=str(entity['revision']),method='crm',offset=0,text=text))
                used += len(text)
            return result


    def archive(self, entity_id, expected_revision, archived, reason, actor='owner'):
        if type(archived) is not bool or not isinstance(reason,str) or not reason.strip() or len(reason)>1000:
            raise ValueError('Archivstatus und Begründung erforderlich.')
        with self.db.transaction() as cx:
            entity = self._entity(cx,entity_id,expected_revision)
            if bool(entity['archived']) != archived:
                cx.execute('UPDATE crm_entities SET archived=?,revision=revision+1 WHERE id=?',(int(archived),entity_id))
                self._audit(cx,entity_id,'entity.archive' if archived else 'entity.restore',actor,reason,entity_id)
        return self.read(entity_id)
