import asyncio
import pytest
from core.crm import CRM
from core.mail_workflow import MailWorkflow
from core.tests.test_mail import mail, account, message
from core.tests.test_operations import services
from core.tests.test_routines import FakeAdapter
from core.routines import Routines


def test_mail_crm_and_routine_keep_original_revision_and_deduplicate(mail):
    crm=CRM(mail.db)
    _,_,memory,_,storage,queue,runtime=services(mail.config,mail.db)
    adapter=FakeAdapter(mail.config)
    routines=Routines(storage,adapter,memory)
    workflow=MailWorkflow(mail,crm,routines)
    async def scenario():
        id=await account(mail);a=mail.account(id,'default')
        mail.ingest(a,[message()],{})
        thread=mail.threads('default')['conversations'][0]
        signal=workflow.capture({'id':thread['id']})['signal']
        assert workflow.capture({'id':thread['id']})['signal']['id']==signal['id']
        assert signal['payload']['origin']['threadId']==thread['id']
        assert not mail.db.rows('SELECT * FROM crm_facts')
        body={'id':thread['id'],'name':'Nachfassen','instructions':'Verlauf prüfen und Ergebnis in der App melden.',
              'schedule':{'type':'interval','minutes':60},'requestKey':'follow-up-synthetic-1'}
        result=await workflow.routine(body)
        assert result['created'] and not (await workflow.routine(body))['created']
        job=result['job'];assert thread['id'] in job['instructions']
        storage.sync_jobs();run=queue.enqueue(job['id']);queue.claim();queue.finish(run['id'],'completed',{'text':'Geprüft, Rückmeldung steht noch aus.'})
        from core.notifications import Notifications
        assert Notifications(mail.db).list()['items'][0]['job_id']==job['id']
        assert len(workflow.links(thread['id'],'default')['links'])==2
        mail.ingest(a,[message('m2','Neue Uhrzeit')],{})
        assert all(l['sourceChanged'] for l in workflow.links(thread['id'],'default')['links'])
        with pytest.raises(ValueError):workflow.capture({'id':thread['id'],'projectId':'other'})
        await runtime.close()
    asyncio.run(scenario())
