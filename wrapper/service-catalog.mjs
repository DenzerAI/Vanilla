// Shared by the connection dialog and server validation. Secrets never enter config.
export const serviceCatalog = [
  { id: 'telegram', name: 'Telegram', description: 'Bot und zugelassene Nutzer', runtime: 'polling', fields: [
    {key:'token', label:'Bot-Token', secret:true},
    {key:'users', label:'Zugelassene Nutzer', type:'telegram-users', hint:'Nur eingetragene IDs erhalten Zugang zum gewählten Arbeitsbereich.'},
  ], help:'https://core.telegram.org/bots/features#botfather' },
  { id:'whatsapp-local', name:'WhatsApp', description:'Eigene Nummer und getrennte Bridge', runtime:'bridge', fields:[
    {key:'identity', label:'Nummer / Bezeichnung', required:true},
    {key:'allowedUsers', label:'Zugelassene Rufnummern', type:'list', hint:'Mit Ländervorwahl, eine Nummer pro Zeile.'},
  ], help:'https://faq.whatsapp.com/1317564962315842' },
  { id:'whatsapp-cloud', name:'WhatsApp Business', description:'Offizielle Cloud API', runtime:'webhook', fields:[
    {key:'phoneNumberId', label:'Phone Number ID', required:true},
    {key:'apiVersion', label:'Graph-API-Version', required:true, hint:'Version der eingerichteten Meta-App, zum Beispiel v23.0.'},
    {key:'token', label:'Access Token', secret:true},
    {key:'appSecret', label:'App Secret', secret:true},
    {key:'verifyToken', label:'Webhook Verify Token', secret:true},
    {key:'port', label:'Lokaler Webhook-Port', type:'number', default:9901},
    {key:'allowedUsers', label:'Zugelassene Rufnummern', type:'list'},
  ], help:'https://developers.facebook.com/docs/whatsapp/cloud-api' },
  { id:'a2a', name:'A2A', description:'Agenten miteinander verbinden', runtime:'a2a', fields:[
    {key:'mode',label:'Anschluss',type:'select',default:'client',options:[['client','Bestehenden Agenten verbinden'],['server','Aufträge empfangen']]},
    {key:'url',label:'Agent-Adresse',type:'url',hint:'Bestehender Hermes-Anschluss: dessen aktuelle Adresse und Port 9900 verwenden.',when:['mode','client']},
    {key:'host',label:'Bind Host',default:'127.0.0.1',when:['mode','server']},
    {key:'port',label:'Port',type:'number',default:9900,when:['mode','server']},
    {key:'publicUrl',label:'Veröffentlichte Adresse (optional)',type:'url',when:['mode','server']},
    {key:'token',label:'Bearer-Token',secret:true},
  ], help:'https://hermes-agent.nousresearch.com/docs/user-guide/messaging/a2a' },
  { id:'microsoft-graph', name:'Outlook', description:'Microsoft Graph für E-Mail und Kalender', runtime:null, fields:[
    {key:'tenantId',label:'Mandanten-ID',required:true},
    {key:'clientId',label:'Anwendungs-ID',required:true},
    {key:'clientSecret',label:'Anwendungsgeheimnis',secret:true},
    {key:'mailbox',label:'Postfach-ID oder E-Mail-Adresse',required:true},
  ], help:'https://learn.microsoft.com/en-us/graph/auth-v2-service' },
  { id:'discord', name:'Discord', description:'Bot-Zugang vorbereiten', runtime:null, fields:[
    {key:'token',label:'Bot-Token',secret:true},
    {key:'channelId',label:'Kanal-ID',required:true},
    {key:'allowedUsers',label:'Zugelassene Nutzer-IDs',type:'list'},
  ], help:'https://discord.com/developers/docs/quick-start/getting-started' },
  { id:'openai-image', name:'OpenAI Bilder', description:'Bilder erzeugen und in der Bibliothek ablegen', runtime:null, fields:[
    {key:'token',label:'API-Schlüssel',secret:true},
    {key:'model',label:'Bildmodell',required:true,default:'gpt-image-2'},
  ], help:'https://developers.openai.com/api/docs/guides/image-generation' },
];
export const serviceDefinition = id => serviceCatalog.find(s => s.id === id);
export const connectionStatus = c => c.runtimeStatus === 'running' ? 'Empfang aktiv' : c.runtimeStatus === 'qr' ? 'QR-Kopplung erforderlich' : c.runtimeStatus === 'connecting' ? 'Verbindung wird aufgebaut' : c.runtimeStatus === 'error' ? 'Verbindungsfehler' : c.checkedAt ? (serviceDefinition(c.provider)?.runtime && !(c.provider==='a2a'&&c.config?.mode==='client') ? 'Zugang geprüft · Empfang aus' : 'Zugang geprüft') : 'Gespeichert · noch nicht geprüft';
