"""Pure provider normalization. No network calls, credentials, entity creation or acceptance.

Reference: https://learn.microsoft.com/en-us/graph/api/resources/contact?view=graph-rest-1.0
Other CRMs feed the same canonical Change contract after their schema has been verified.
"""
from .crm_models import Change

GRAPH_SCALARS = {
    'givenName':'given_name', 'middleName':'middle_name', 'surname':'family_name',
    'displayName':'display_name', 'title':'salutation', 'generation':'name_suffix',
    'jobTitle':'job_title', 'department':'department', 'businessHomePage':'website',
}


def graph_contact(payload, connection_id, current=None):
    """Map a Graph contact snapshot or partial response. Omitted collections stay untouched.

Stable slots are scoped to the connection so that one source cannot erase another
source's phone/address. Only an explicitly supplied collection replaces its slots.
"""
    if not isinstance(payload,dict) or not isinstance(payload.get('id'),str) or not payload['id']:
        raise ValueError('Graph-Kontakt benötigt eine ID.')
    prefix = connection_id + ':'
    if len(prefix)>60:
        # Keep external identifiers opaque; derive only the internal slot namespace.
        from hashlib import sha256
        prefix = sha256(connection_id.encode()).hexdigest()[:24] + ':'
    changes, replaced = [],set()
    def add(field,slot,value):
        changes.append(Change(field=field,slot=slot,value=value).model_dump())
    for source, target in GRAPH_SCALARS.items():
        if source in payload:
            add(target,'',payload[source] or None)
    if 'emailAddresses' in payload:
        if not isinstance(payload['emailAddresses'],list):
            raise ValueError('Graph emailAddresses muss eine Liste sein.')
        replaced.add(('email',prefix+'email:'))
        for n,item in enumerate(payload['emailAddresses']):
            if not isinstance(item,dict) or not item.get('address'):
                raise ValueError('Graph E-Mail benötigt eine Adresse.')
            add('email',prefix+'email:'+str(n),dict(address=item['address'],label='other'))
    for source,label in [('businessPhones','work'),('homePhones','home')]:
        if source not in payload:
            continue
        if not isinstance(payload[source],list):
            raise ValueError('Graph-Telefonliste ist ungültig.')
        replaced.add(('phone',prefix+source+':'))
        for n,number in enumerate(payload[source]):
            add('phone',prefix+source+':'+str(n),dict(number=number,label=label))
    if 'mobilePhone' in payload:
        add('phone',prefix+'mobile',dict(number=payload['mobilePhone'],label='mobile') if payload['mobilePhone'] else None)
    for source,label in [('businessAddress','business'),('homeAddress','home'),('otherAddress','other')]:
        if source not in payload:
            continue
        address = payload[source]
        if address is not None and not isinstance(address,dict):
            raise ValueError('Graph-Adresse ist ungültig.')
        if not address or not any(v for k,v in address.items() if not k.startswith('@')):
            add('address',prefix+label,None)
        else:
            add('address',prefix+label,dict(label=label,street=address.get('street') or '',city=address.get('city') or '',
                postal_code=address.get('postalCode') or '',region=address.get('state') or '',country=address.get('countryOrRegion') or ''))
    if 'categories' in payload:
        if not isinstance(payload['categories'],list):
            raise ValueError('Graph-Kategorien sind ungültig.')
        replaced.add(('tag',prefix+'tag:'))
        for n,tag in enumerate(payload['categories']):
            add('tag',prefix+'tag:'+str(n),tag)
    present = {(c['field'],c['slot']) for c in changes}
    for field,slots in (current or {}).items():
        for fact in slots:
            if any(field==f and fact['slot'].startswith(p) for f,p in replaced) and (field,fact['slot']) not in present:
                add(field,fact['slot'],None)
    mapped = set(GRAPH_SCALARS) | {'emailAddresses','businessPhones','homePhones','mobilePhone','businessAddress','homeAddress','otherAddress','categories'}
    metadata = {'id','changeKey','lastModifiedDateTime','createdDateTime','parentFolderId','@odata.context','@odata.etag'}
    return {'kind':'person','changes':changes,'external_id':payload['id'],
            'unmapped_fields':sorted(set(payload)-mapped-metadata),
            'identity_note':'companyName is not an organization ID; do not silently create or merge a company.',
            'required_read_header':'Prefer: IdType="ImmutableId"'}
