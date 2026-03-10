/**
 * MSAL configuration for NEXUS Command Dashboard
 *
 * To activate: set VITE_AZURE_CLIENT_ID in .env.local
 * IT admin needs to create app registration:
 *   Name: ULU NEXUS Command Dashboard
 *   Type: SPA
 *   Redirect URIs: http://localhost:5173, https://blue-meadow-061a5911e.2.azurestaticapps.net
 *   Permissions: User.Read, Mail.ReadWrite, Mail.Send,
 *                Files.ReadWrite.All, Sites.ReadWrite.All,
 *                Calendars.Read, Chat.ReadWrite
 */

export const TENANT_ID = 'dd59f285-3eee-4150-8bfa-91bd8a96a83b'
export const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || ''

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
}

// Scopes requested at login (User.Read is minimal — others requested on demand)
export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
}

// Graph scopes for each service — requested when first used
export const graphScopes = {
  mail:      ['Mail.ReadWrite', 'Mail.Send'],
  calendar:  ['Calendars.Read'],
  onedrive:  ['Files.ReadWrite.All'],
  sharepoint:['Sites.ReadWrite.All'],
  teams:     ['Chat.ReadWrite'],
}

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
export const MSAL_ENABLED = Boolean(CLIENT_ID)
