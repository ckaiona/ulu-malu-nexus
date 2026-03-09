// ============================================================================
// MSAL Configuration for ULU NEXUS Command Dashboard
// ============================================================================
// TODO: Replace CLIENT_ID with your real Application (client) ID from
//       Azure Portal → App registrations → ULU NEXUS Command Dashboard
// TODO: Grant admin consent for Mail.ReadWrite, Mail.Send, Files.ReadWrite.All,
//       Sites.ReadWrite.All in Azure Portal
// ============================================================================

export const msalConfig = {
  auth: {
    clientId: "d66cf553-c981-415b-8e49-55792547a917", // Kia'i Knowledge Source app
    authority: "https://login.microsoftonline.com/dd59f285-3eee-4150-8bfa-91bd8a96a83b",
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

// Scopes that DON'T need admin consent (work immediately)
export const loginScopes = {
  scopes: ["User.Read", "Calendars.Read"],
};

// Scopes that NEED admin consent (will fail until granted)
export const graphScopes = {
  email: ["Mail.ReadWrite", "Mail.Send"],
  files: ["Files.ReadWrite.All"],
  sharepoint: ["Sites.ReadWrite.All"],
};

// All scopes combined (for full access after admin consent)
export const allScopes = {
  scopes: [
    "User.Read",
    "Calendars.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Files.ReadWrite.All",
    "Sites.ReadWrite.All",
  ],
};

// Graph API base URL
export const graphEndpoint = "https://graph.microsoft.com/v1.0";
