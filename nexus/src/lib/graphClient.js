/**
 * Microsoft Graph API client
 * Uses MSAL to acquire tokens silently, falls back to interactive login
 */
import { GRAPH_BASE, graphScopes } from './msalConfig'

async function getToken(msalInstance, scopes) {
  const accounts = msalInstance.getAllAccounts()
  if (!accounts.length) throw new Error('Not signed in')
  try {
    const result = await msalInstance.acquireTokenSilent({ scopes, account: accounts[0] })
    return result.accessToken
  } catch {
    const result = await msalInstance.acquireTokenPopup({ scopes })
    return result.accessToken
  }
}

async function graphFetch(msalInstance, scopes, path, options = {}) {
  const token = await getToken(msalInstance, scopes)
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`Graph ${path}: ${res.status} ${res.statusText}`)
  if (res.status === 204) return null
  return res.json()
}

// ── Outlook ────────────────────────────────────────────────────────────────

export async function getEmailDrafts(msal, top = 50) {
  return graphFetch(msal, graphScopes.mail,
    `/me/mailFolders/Drafts/messages?$top=${top}&$orderby=lastModifiedDateTime desc` +
    `&$select=id,subject,toRecipients,bodyPreview,lastModifiedDateTime,isDraft`)
}

export async function getInboxMessages(msal, top = 20) {
  return graphFetch(msal, graphScopes.mail,
    `/me/mailFolders/Inbox/messages?$top=${top}&$orderby=receivedDateTime desc` +
    `&$select=id,subject,from,bodyPreview,receivedDateTime,isRead`)
}

export async function sendEmail(msal, { to, subject, body, saveToSentItems = true }) {
  return graphFetch(msal, graphScopes.mail, '/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: body },
        toRecipients: to.map(email => ({ emailAddress: { address: email } })),
      },
      saveToSentItems,
    }),
  })
}

export async function createDraft(msal, { to, subject, body }) {
  return graphFetch(msal, graphScopes.mail, '/me/messages', {
    method: 'POST',
    body: JSON.stringify({
      subject,
      body: { contentType: 'HTML', content: body },
      toRecipients: to.map(email => ({ emailAddress: { address: email } })),
      isDraft: true,
    }),
  })
}

// ── Calendar ───────────────────────────────────────────────────────────────

export async function getTodayEvents(msal) {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const endOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
  return graphFetch(msal, graphScopes.calendar,
    `/me/calendarView?startDateTime=${startOfDay}&endDateTime=${endOfDay}` +
    `&$orderby=start/dateTime&$select=id,subject,start,end,location,organizer,isOnlineMeeting,onlineMeetingUrl`)
}

// ── OneDrive ───────────────────────────────────────────────────────────────

export async function getRecentFiles(msal, top = 20) {
  return graphFetch(msal, graphScopes.onedrive,
    `/me/drive/recent?$top=${top}&$select=id,name,lastModifiedDateTime,webUrl,size`)
}

export async function listFolder(msal, folderId = 'root') {
  return graphFetch(msal, graphScopes.onedrive,
    `/me/drive/items/${folderId}/children?$select=id,name,lastModifiedDateTime,webUrl,size,folder,file`)
}

export async function uploadFile(msal, folderId, filename, content) {
  const token = await getToken(msal, graphScopes.onedrive)
  const res = await fetch(`${GRAPH_BASE}/me/drive/items/${folderId}:/${filename}:/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
    body: content,
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return res.json()
}

// ── SharePoint ─────────────────────────────────────────────────────────────

export async function getSharePointSite(msal, siteUrl = 'uluco.sharepoint.com:/sites/uhtteam:') {
  return graphFetch(msal, graphScopes.sharepoint, `/sites/${siteUrl}`)
}

export async function getSharePointFiles(msal, siteId, libraryName = 'Documents') {
  return graphFetch(msal, graphScopes.sharepoint,
    `/sites/${siteId}/drives`)
    .then(async ({ value: drives }) => {
      const drive = drives.find(d => d.name === libraryName) || drives[0]
      return graphFetch(msal, graphScopes.sharepoint, `/drives/${drive.id}/root/children`)
    })
}

// ── User profile ───────────────────────────────────────────────────────────

export async function getMyProfile(msal) {
  return graphFetch(msal, ['User.Read'],
    '/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation')
}

export async function getMyPhoto(msal) {
  const token = await getToken(msal, ['User.Read'])
  const res = await fetch(`${GRAPH_BASE}/me/photo/$value`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
