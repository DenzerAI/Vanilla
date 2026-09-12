import asyncio
import json
from collections import Counter
import pytest
from core.config import Config
from core.database import Database
from core.mail import Mail
from core.inbox_triage import InboxTriage, Correction, classify


def message(subject='',text='',**extra):
    return {'subject':subject,'text':text,'sender':'person@example.com','time':'2026-01-01T10:00:00Z','outgoing':False,**extra}


@pytest.mark.parametrize('mail,category',[
    (message('20 % Rabatt heute','Unsubscribe'), 'promotion'),
    (message('Ihr Angebot','Hier ist mein persönliches Angebot.'), 'focus'),
    (message('Frage zu Ihrem Newsletter','Ich brauche Hilfe beim Abbestellen.'), 'focus'),
    (message('Willkommen',triageSignals={'labels':['CATEGORY_PROMOTIONS']}), 'promotion'),
    (message('Ihre Rechnung','Unsubscribe'), 'receipts'),
    (message('Zahlung fehlgeschlagen','Unsubscribe',triageSignals={'labels':['CATEGORY_PROMOTIONS']}), 'focus'),
    (message('Mahnung zur Rechnung'), 'focus'),
    (message('Security alert'), 'focus'),
    (message('Sendungsverfolgung aktualisiert'), 'updates'),
    (message('Bitte ein Angebot erstellen'), 'focus'),
    (message('AW: 20 % Rabatt','Unsubscribe'), 'focus'),
    (message('Newsletter',oversized=True), 'focus'),
    (message('Wichtige Nachricht',sender='no-reply@example.com'), 'focus'),
])
def test_conservative_categories(mail,category):
    assert classify([mail])['category']==category


def test_conversation_and_newest_incoming_determine_classification():
    promo=message('Rabatt heute','Unsubscribe')
    assert classify([promo])['category']=='promotion'
    assert classify([promo,message('Meine Rückfrage',outgoing=True,time='2026-01-02')])['category']=='focus'
    assert classify([promo,message('Zahlung fehlgeschlagen',time='2026-01-03')])['category']=='focus'
    assert classify([])['category']=='focus'


def test_overrides_are_scoped_persistent_and_do_not_change_source_or_drafts(tmp_path):
    config=Config(root=tmp_path,start_adapter=False);db=Database(config.data/'agent.sqlite3')
    mail=Mail(db,config);triage=InboxTriage(db,mail);mail.triage=triage
    with db.transaction() as cx:
        for id,project in [('a','default'),('b','other')]:
            cx.execute("INSERT INTO mail_accounts(id,project,provider,address,mode,secret_id,status) VALUES(?,?,'gmail',?,'oauth','unused','connected')",(id,project,id+'@example.com'))
    for id in ['a','b']:
        mail.ingest({'id':id},[{**message('Rabatt heute','Unsubscribe'),'external':'same','thread':'same','attachments':[]}],{})
    t=mail.threads('default')['conversations'][0]
    assert t['triage']['category']=='promotion'
    before=db.rows('SELECT * FROM mail_messages');threads=db.rows('SELECT * FROM mail_threads')
    triage.correct(Correction(id=t['id'],category='focus'))
    assert mail.threads('default')['conversations'][0]['triage']['source']=='manual'
    with pytest.raises(ValueError):triage.correct(Correction(id=t['id'],projectId='other',category='promotion'))
    with pytest.raises(ValueError):triage.correct(Correction(id=t['id'],category='invalid'))
    assert len(db.rows('SELECT * FROM inbox_triage_overrides'))==1
    assert db.rows('SELECT * FROM mail_messages')==before
    assert db.rows('SELECT * FROM mail_threads')==threads
    restarted=InboxTriage(db,mail);mail.triage=restarted
    assert mail.threads('default')['conversations'][0]['triage']['category']=='focus'
    restarted.correct(Correction(id=t['id'],category='auto'))
    assert mail.threads('default')['conversations'][0]['triage']['category']=='promotion'
    asyncio.run(mail.close());db.close()
