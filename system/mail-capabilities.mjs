// Included by the central installation capability inventory.
export const mailCapabilities = [
  {id:'inbox', sources:['core/mail.py','wrapper/ui/inbox.tsx','core/mcp.py'], contract:'wrapper/surfaces/inbox.md', status:'/api/mail/accounts'},
  {id:'mail.connections', sources:['core/mail.py','core/provider_vault.py','wrapper/ui/mail-connection.tsx'], contract:'docs/MAIL.md', status:'/api/mail/setup'},
];
