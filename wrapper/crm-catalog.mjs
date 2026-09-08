// German CRM / craft ERP shortlist. Evidence reviewed 2026-09-07; not a market ranking.
// Shared by the existing Connections catalog, setup form and server validation.
export const crmCatalog = [
  { id:'hero', name:'HERO', group:'Handwerk', description:'Kunden und Projekte · GraphQL-API', loginUrl:'https://login.hero-software.de',
    api:{auth:'token', check:'hero', url:'https://login.hero-software.de/api/external/v7/graphql', fixed:true,
      note:'Den GraphQL-API-Schlüssel erhältst du beim HERO-Support.', source:'https://hero-software.de/api-doku/graphql-guide'} },
  { id:'labelwin', name:'Labelwin', aliases:['Label','Label Software','Label Mobile'], group:'Handwerk', description:'SHK und Service · Label API',
    api:{auth:'manual', note:'Label bietet eine API für Adressen, Aufgaben und Kundendienstaufträge. Zugang und Einrichtung mit Label klären.', source:'https://www.label-software.de/infomappe'} },
  { id:'plancraft', name:'plancraft', group:'Handwerk', description:'Kontakte und Projekte · API in Beta', loginUrl:'https://plancraft.com/de-de/login',
    api:{auth:'token', note:'API und Webhooks sind in Beta und müssen freigeschaltet sein. Einen API-Schlüssel in plancraft erstellen.', source:'https://help.plancraft.com/de/articles/382804-api-und-webhook-integrationen-fur-kontakte-und-projekte-in-plancraft-beta'} },
  { id:'tooltime', name:'ToolTime', group:'Handwerk', description:'Aufträge und Kunden · REST-API in Beta',
    api:{auth:'manual', note:'Die REST-API ist in Beta und nicht standardmäßig verfügbar. Zugang und Authentifizierung mit ToolTime klären.', source:'https://www.tooltime.app/schnittstellen-handwerk'} },
  { id:'openhandwerk', name:'openHandwerk', group:'Handwerk', description:'Büro und Baustelle · REST-API', loginUrl:'https://openhandwerk.de/login',
    api:{auth:'password', tenant:'Mandantenkennung (idKn)', url:'https://rest.openhandwerk.de', fixed:true,
      note:'Die REST-API nutzt Mandantenkennung, Mitarbeiterkennung und Passwort zum Erzeugen eines JWT-Zugangstokens.', source:'https://docs.openhandwerk.de/'} },
  { id:'pds', name:'pds', group:'Handwerk', description:'Handwerks-ERP · REST-API',
    api:{auth:'manual', note:'pds bietet eine REST-API für weitere Dienste. Freigabe, Adresse und Zugangsschema mit pds abstimmen.', source:'https://pds.de/software/handwerk/schnittstellen'} },
  { id:'streit', name:'STREIT V.1', aliases:['Streit Software','Streit Datentechnik'], group:'Handwerk', description:'Handwerks-ERP · Login hinterlegen',
    api:{note:'Branchenschnittstellen sind dokumentiert; eine allgemeine CRM-API ist in den geprüften öffentlichen Quellen nicht belegt. Anschluss mit STREIT klären.', source:'https://www.streit-software.de/'} },
  { id:'winworker', name:'WinWorker', group:'Handwerk', description:'Büro und Baustelle · Login hinterlegen',
    api:{note:'CRM und Branchenschnittstellen sind dokumentiert; eine allgemeine CRM-API ist in den geprüften öffentlichen Quellen nicht belegt. Anschluss mit WinWorker klären.', source:'https://www.winworker.de/software-fuer-handwerker/'} },
  { id:'weclapp', name:'weclapp', group:'CRM und ERP', description:'CRM und Warenwirtschaft · REST-API',
    api:{auth:'token', check:'weclapp', urlRequired:true, urlLabel:'weclapp-Adresse', placeholder:'https://dein-betrieb.weclapp.com',
      note:'Die Adresse deines weclapp-Mandanten und einen persönlichen API-Token verwenden.', source:'https://www.weclapp.com/api/'} },
  { id:'centralstationcrm', name:'CentralStationCRM', group:'CRM und ERP', description:'Kunden und Vertrieb · REST-API',
    api:{auth:'token', check:'centralstationcrm', url:'https://api.centralstationcrm.net', fixed:true,
      note:'Einen eigenen API-Schlüssel in den CentralStationCRM-Accounteinstellungen erstellen.', source:'https://hilfe.centralstationcrm.de/article/149/crm-account-mit-drittanwendungen-verbinden-api'} },
  { id:'cas', name:'CAS genesisWorld', aliases:['CAS CRM'], group:'CRM und ERP', description:'CRM für den Mittelstand · REST-API',
    api:{auth:'manual', note:'REST-Webservices und OpenSync sind vorhanden. Version, Datenbank, Rechte und Zugang mit eurem CAS-Partner abstimmen.', source:'https://www.cas.de/loesungen/crm-xrm/cas-genesisworld/crm-schnittstellen/'} },
  { id:'cobra', name:'cobra CRM', aliases:['cobra One'], group:'CRM und ERP', description:'Kundenmanagement · REST-API',
    api:{auth:'manual', note:'cobra bietet Integrationen per REST-API. Edition, Modul und Zugang mit cobra oder eurem Partner klären.', source:'https://cobra.de/loesungen/integrationen-und-api/'} },
  { id:'sap-business-one', name:'SAP Business One', aliases:['SAP','SAP B1'], group:'CRM und ERP', description:'ERP für KMU · Service Layer',
    api:{auth:'password', tenant:'Firmendatenbank (CompanyDB)', urlRequired:true, urlLabel:'Service-Layer-Adresse', placeholder:'https://euer-server/b1s/v2',
      note:'Business One nutzt den Service Layer mit Firmendatenbank und Benutzerzugang. SAP Sales Cloud und S/4HANA benötigen eigene Anschlüsse.', source:'https://help.sap.com/doc/056f69366b5345a386bb8149f1700c19/10.0/en-US/Service%20Layer%20API%20Reference.html'} },
];

export const crmDefinition = id => crmCatalog.find(provider => provider.id === id);
export const crmDefaultMethod = provider => provider.api.auth && provider.api.auth !== 'manual' ? 'api' : 'login';
export const crmStatus = connection => connection.check?.ok ? 'API-Zugang geprüft · kein Sync aktiv'
  : connection.check?.ok === false ? 'API-Prüfung fehlgeschlagen'
  : connection.config?.method === 'login' ? 'Login hinterlegt · nicht angemeldet' : 'API-Zugang hinterlegt · ungeprüft';

export function crmFields(provider, method) {
  if (method === 'login') return [
    {key:'url', label:'Anmeldeadresse (optional)', type:'url', default:provider.loginUrl || '', hint:'Bei einer lokalen Desktop-Installation kann die Adresse leer bleiben.'},
    {key:'username', label:'Benutzername / E-Mail', secret:true, required:true},
    {key:'password', label:'Passwort', secret:true, required:true},
  ];
  return [
    ...(!provider.api.fixed ? [{key:'url', label:provider.api.urlLabel || 'API-Adresse (optional)', type:'url', required:!!provider.api.urlRequired, placeholder:provider.api.placeholder || 'https://…'}] : []),
    ...(provider.api.tenant ? [{key:'tenant', label:provider.api.tenant, required:true}] : []),
    ...(provider.api.auth === 'token' ? [{key:'token', label:'API-Schlüssel', secret:true, required:true}]
      : provider.api.auth === 'password' ? [{key:'username', label:provider.id === 'openhandwerk' ? 'Mitarbeiterkennung (employee)' : 'Benutzername', secret:true, required:true}, {key:'password', label:'Passwort', secret:true, required:true}]
      : [{key:'access', label:'API-Zugangsdaten', secret:true, required:true, hint:'Zugang laut Anbieter sicher hinterlegen. Das Zugangsschema wird beim Einrichten des Anschlusses abgestimmt.'}]),
  ];
}
