// ============================================================================
// Microsoft Graph API Service
// ============================================================================
import { graphEndpoint } from "./auth";

async function callGraph(accessToken, endpoint) {
  const response = await fetch(`${graphEndpoint}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || `Graph API error: ${response.status}`);
  }
  return response.json();
}

// User profile
export async function getMe(token) {
  return callGraph(token, "/me");
}

// Calendar events (next 7 days)
export async function getCalendarEvents(token) {
  const now = new Date();
  const next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return callGraph(
    token,
    `/me/calendarView?startDateTime=${now.toISOString()}&endDateTime=${next.toISOString()}&$top=20&$orderby=start/dateTime`
  );
}

// Recent emails
export async function getEmails(token, count = 20) {
  return callGraph(token, `/me/messages?$top=${count}&$orderby=receivedDateTime desc`);
}

// Send email
export async function sendEmail(token, to, subject, body) {
  const response = await fetch(`${graphEndpoint}/me/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
  if (!response.ok) throw new Error("Failed to send email");
  return true;
}

// OneDrive recent files
export async function getRecentFiles(token) {
  return callGraph(token, "/me/drive/recent?$top=20");
}

// SharePoint sites
export async function getSharePointSites(token) {
  return callGraph(token, "/sites?search=*&$top=10");
}

// SharePoint list items
export async function getListItems(token, siteId, listId) {
  return callGraph(token, `/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=50`);
}
