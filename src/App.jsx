import { useState, useEffect, useRef, useCallback } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginScopes, graphEndpoint } from "./config/auth";

// ─── Theme ───────────────────────────────────────────────────────────────────
const ACCENT="#00E6C3",DARK="#060F1E",CARD="#0D1F35",BORDER="#1A3A5C",WARN="#FF6B35",GREEN="#00FF88",BLUE="#00AAFF";
const glow=(c=ACCENT)=>({boxShadow:`0 0 12px ${c}33,inset 0 0 8px ${c}11`});
const css=`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes ripple{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.5);opacity:0}}@keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`;

// ─── Mock Data (shown when not authenticated) ───────────────────────────────
const clients=[{name:"HEMIC",risk:12,status:"secure",churn:4,last:"2d ago"},{name:"SentinelOne",risk:34,status:"warning",churn:23,last:"5d ago"},{name:"Pacific Defense",risk:8,status:"secure",churn:2,last:"1d ago"},{name:"KoreTech Labs",risk:67,status:"critical",churn:61,last:"12d ago"},{name:"HMSA",risk:21,status:"secure",churn:9,last:"3d ago"}];
const mockAgents=[{name:"PentestForge",status:"running",client:"HEMIC",pct:68},{name:"ScenarioHorizon",status:"running",client:"Q3 Modeling",pct:92},{name:"ChurnSentinel",status:"idle",client:"Monitoring 18",pct:100},{name:"InvoiceGuardian",status:"complete",client:"Feb invoices",pct:100},{name:"ThreatHorizon",status:"alert",client:"KoreTech Labs",pct:45},{name:"AgenticServiceBuilder",status:"idle",client:"Standby",pct:0}];

// ─── Components ──────────────────────────────────────────────────────────────
function Dot({c=GREEN}){return <span style={{position:"relative",display:"inline-block",width:8,height:8,marginRight:6}}><span style={{position:"absolute",inset:0,borderRadius:"50%",background:c,animation:"pulse 2s infinite"}}/><span style={{position:"absolute",inset:-3,borderRadius:"50%",border:`1px solid ${c}`,animation:"ripple 2s infinite"}}/></span>}
function Bar({v}){const c=v>60?WARN:v>30?"#FFD166":GREEN;return <div style={{background:"#0A1A2E",borderRadius:3,height:6,width:"100%",overflow:"hidden"}}><div style={{height:"100%",width:`${v}%`,background:c,borderRadius:3,transition:"width 1s ease",boxShadow:`0 0 6px ${c}88`}}/></div>}
function Spinner(){return <div style={{display:"flex",justifyContent:"center",padding:20}}><div style={{width:20,height:20,border:`2px solid ${BORDER}`,borderTop:`2px solid ${ACCENT}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/></div>}

// ─── Graph API Helper ────────────────────────────────────────────────────────
async function callGraph(token, path) {
  const r = await fetch(`${graphEndpoint}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Graph ${r.status}`);
  return r.json();
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const { instance, accounts } = useMsal();
  const isAuth = useIsAuthenticated();
  const account = accounts[0];

  const [nav, setNav] = useState("ops");
  const [input, setInput] = useState("");
  const [log, setLog] = useState([
    { role: "system", text: "ULU Meta Commander online. Zero-trust verified." },
    { role: "user", text: "Run full external pentest for HEMIC with SOC2 governance." },
    { role: "ai", text: "Routing to Operations Fortress...\n\n✓ SOC2 checklist loaded\n✓ Scope: external perimeter\n✓ Ready for approval." }
  ]);
  const [typing, setTyping] = useState(false);
  const [time, setTime] = useState(new Date());
  const [pending, setPending] = useState(false);
  const end = useRef(null);

  // Graph data
  const [profile, setProfile] = useState(null);
  const [emails, setEmails] = useState([]);
  const [events, setEvents] = useState([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }) }, [log, typing]);

  // ─── Auth Functions ──────────────────────────────────────────────────────
  const handleLogin = async () => {
    try {
      await instance.loginPopup({ ...loginScopes, prompt: "select_account" });
    } catch (e) {
      console.error("Login failed:", e);
    }
  };

  const handleLogout = () => {
    instance.logoutPopup({ postLogoutRedirectUri: "/" });
  };

  const getToken = useCallback(async (scopes) => {
    try {
      const resp = await instance.acquireTokenSilent({ scopes, account });
      return resp.accessToken;
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) {
        const resp = await instance.acquireTokenPopup({ scopes });
        return resp.accessToken;
      }
      throw e;
    }
  }, [instance, account]);

  // ─── Load Graph Data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuth || !account) return;
    let cancelled = false;

    const load = async () => {
      setGraphLoading(true);
      setGraphError(null);
      try {
        const token = await getToken(["User.Read", "Calendars.Read"]);

        const [me, cal] = await Promise.all([
          callGraph(token, "/me"),
          callGraph(token, "/me/calendarView?startDateTime=" +
            new Date().toISOString() + "&endDateTime=" +
            new Date(Date.now() + 7 * 86400000).toISOString() +
            "&$top=10&$orderby=start/dateTime").catch(() => ({ value: [] })),
        ]);

        if (cancelled) return;
        setProfile(me);
        setEvents(cal.value || []);

        // Try emails (may fail without admin consent)
        try {
          const mailToken = await getToken(["Mail.ReadWrite"]);
          const mail = await callGraph(mailToken, "/me/messages?$top=10&$orderby=receivedDateTime desc");
          if (!cancelled) setEmails(mail.value || []);
        } catch {
          // Mail permissions not granted yet — that's OK
          if (!cancelled) setEmails([]);
        }
      } catch (e) {
        if (!cancelled) setGraphError(e.message);
      } finally {
        if (!cancelled) setGraphLoading(false);
      }
    };

    load();
    return () => { cancelled = true };
  }, [isAuth, account, getToken]);

  // ─── Commander ──────────────────────────────────────────────────────────
  const send = () => {
    if (!input.trim()) return;
    setLog(l => [...l, { role: "user", text: input }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setLog(l => [...l, { role: "ai", text: `Analyzing...\n\n✓ Routing to ${nav === "ops" ? "Operations Fortress" : nav === "sales" ? "Sales Shield" : nav === "finance" ? "Finance Vault" : "Client Vigilance"}\n✓ Agents engaged\n✓ Awaiting approval.` }]);
      setTyping(false);
      setPending(true);
    }, 1800);
  };

  const navItems = [
    { id: "ops", icon: "⬡", label: "Operations", sub: "Pentest & Audit" },
    { id: "mail", icon: "✉", label: "Email", sub: "Inbox & Send" },
    { id: "calendar", icon: "◈", label: "Calendar", sub: "Schedule" },
    { id: "sales", icon: "◆", label: "Sales", sub: "Proposals" },
    { id: "finance", icon: "◇", label: "Finance", sub: "Billing" },
    { id: "client", icon: "◉", label: "Clients", sub: "Posture" },
  ];

  // ─── Render Helper: Email Panel ─────────────────────────────────────────
  const renderEmailPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        {[
          ["Inbox", `${emails.length}`, "messages loaded", BLUE],
          ["Unread", `${emails.filter(e => !e.isRead).length}`, "need attention", WARN],
        ].map(([l, v, s, a]) => (
          <div key={l} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px", flex: 1, ...glow(a) }}>
            <div style={{ fontSize: 11, color: "#5A7FA0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: a }}>{v}</div>
            <div style={{ fontSize: 11, color: "#3A6080", marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>
      {!isAuth ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#5A7FA0", marginBottom: 12 }}>Sign in to view your emails</div>
          <button onClick={handleLogin} style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 8, padding: "10px 24px", fontSize: 12, cursor: "pointer", fontFamily: "monospace" }}>⚡ SIGN IN WITH MICROSOFT</button>
        </div>
      ) : emails.length === 0 ? (
        <div style={{ background: CARD, border: `1px solid ${WARN}33`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: WARN }}>⚠ Mail permissions require admin consent</div>
          <div style={{ fontSize: 10, color: "#3A6080", marginTop: 6 }}>Ask your admin to grant Mail.ReadWrite consent for this app</div>
        </div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: ACCENT, letterSpacing: 2 }}>INBOX</span>
            <span style={{ fontSize: 9, color: "#2A5A7A" }}>LIVE</span>
          </div>
          {emails.map((e, i) => (
            <div key={i} style={{ padding: "12px 20px", borderTop: i > 0 ? `1px solid ${BORDER}` : "none", animation: `slideIn 0.3s ${i * 0.05}s ease both`, cursor: "pointer", background: e.isRead ? "transparent" : `${BLUE}08` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: e.isRead ? "#5A8AAA" : "#A0C8E0", fontWeight: e.isRead ? 400 : 600 }}>
                  {e.from?.emailAddress?.name || e.from?.emailAddress?.address || "Unknown"}
                </span>
                <span style={{ fontSize: 9, color: "#2A5A7A" }}>
                  {new Date(e.receivedDateTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div style={{ fontSize: 11, color: e.isRead ? "#3A6080" : "#8AB0C8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.subject || "(no subject)"}
              </div>
              <div style={{ fontSize: 10, color: "#1A4060", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.bodyPreview?.substring(0, 100)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Render Helper: Calendar Panel ──────────────────────────────────────
  const renderCalendarPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        {[
          ["This Week", `${events.length}`, "events upcoming", ACCENT],
          ["Today", `${events.filter(e => new Date(e.start?.dateTime).toDateString() === new Date().toDateString()).length}`, "events today", GREEN],
        ].map(([l, v, s, a]) => (
          <div key={l} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px", flex: 1, ...glow(a) }}>
            <div style={{ fontSize: 11, color: "#5A7FA0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: a }}>{v}</div>
            <div style={{ fontSize: 11, color: "#3A6080", marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>
      {!isAuth ? (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#5A7FA0", marginBottom: 12 }}>Sign in to view your calendar</div>
          <button onClick={handleLogin} style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 8, padding: "10px 24px", fontSize: 12, cursor: "pointer", fontFamily: "monospace" }}>⚡ SIGN IN WITH MICROSOFT</button>
        </div>
      ) : graphLoading ? <Spinner /> : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: ACCENT, letterSpacing: 2 }}>UPCOMING EVENTS</span>
            <span style={{ fontSize: 9, color: "#2A5A7A" }}>7 DAY VIEW</span>
          </div>
          {events.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: "#3A6080" }}>No upcoming events this week</div>
          ) : events.map((ev, i) => {
            const start = new Date(ev.start?.dateTime + "Z");
            const end2 = new Date(ev.end?.dateTime + "Z");
            const isToday = start.toDateString() === new Date().toDateString();
            return (
              <div key={i} style={{ padding: "12px 20px", borderTop: i > 0 ? `1px solid ${BORDER}` : "none", animation: `slideIn 0.3s ${i * 0.05}s ease both`, background: isToday ? `${GREEN}06` : "transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: isToday ? GREEN : "#A0C8E0", fontWeight: 600 }}>{ev.subject || "(no title)"}</span>
                  {isToday && <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: `${GREEN}22`, border: `1px solid ${GREEN}44`, color: GREEN }}>TODAY</span>}
                </div>
                <div style={{ fontSize: 10, color: "#5A8AAA" }}>
                  {start.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" → "}
                  {end2.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </div>
                {ev.location?.displayName && (
                  <div style={{ fontSize: 9, color: "#2A5A7A", marginTop: 2 }}>📍 {ev.location.displayName}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─── Render Helper: Ops Panel (original dashboard) ──────────────────────
  const renderOpsPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        {[["Active Clients", "18", "+2 this week", ACCENT], ["Pentests", "3", "2 awaiting", BLUE], ["Threats", "7", "KoreTech critical", WARN], ["MRR", "$84K", "↑12% vs last", "#FFD166"]].map(([l, v, s, a]) => (
          <div key={l} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px", flex: 1, ...glow(a) }}>
            <div style={{ fontSize: 11, color: "#5A7FA0", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: a }}>{v}</div>
            <div style={{ fontSize: 11, color: "#3A6080", marginTop: 4 }}>{s}</div>
          </div>
        ))}
      </div>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: ACCENT, letterSpacing: 2 }}>CLIENT SECURITY POSTURE</span>
          <span style={{ fontSize: 9, color: "#2A5A7A" }}>LIVE</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["CLIENT", "RISK", "STATUS", "CHURN", "LAST"].map(h => <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontWeight: 400, fontSize: 9, color: "#2A5A7A", letterSpacing: 2 }}>{h}</th>)}</tr></thead>
          <tbody>{clients.map((c, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${BORDER}`, animation: `slideIn 0.3s ${i * 0.08}s ease both` }}>
              <td style={{ padding: "12px 20px", fontSize: 12, color: "#A0C8E0" }}>{c.name}</td>
              <td style={{ padding: "12px 20px", width: 140 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Bar v={c.risk} /><span style={{ fontSize: 11, color: c.risk > 60 ? WARN : c.risk > 30 ? "#FFD166" : GREEN }}>{c.risk}</span></div></td>
              <td style={{ padding: "12px 20px" }}><span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, color: c.status === "secure" ? GREEN : c.status === "warning" ? "#FFD166" : WARN, background: c.status === "secure" ? `${GREEN}15` : c.status === "warning" ? "#FFD16615" : `${WARN}15`, border: `1px solid ${c.status === "secure" ? GREEN + "33" : c.status === "warning" ? "#FFD16633" : WARN + "33"}` }}>{c.status.toUpperCase()}</span></td>
              <td style={{ padding: "12px 20px", fontSize: 11, color: c.churn > 50 ? WARN : "#5A8AAA" }}>{c.churn}%</td>
              <td style={{ padding: "12px 20px", fontSize: 11, color: "#2A5A7A" }}>{c.last}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, fontSize: 11, color: ACCENT, letterSpacing: 2 }}>FOUNDRY AGENT ACTIVITY</div>
        <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {mockAgents.map((a, i) => (
            <div key={i} style={{ background: "#080F1C", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#8AB0C8" }}>{a.name}</span>
                <span style={{ fontSize: 9, color: a.status === "running" ? ACCENT : a.status === "alert" ? WARN : a.status === "complete" ? GREEN : "#2A5A7A" }}>{a.status === "running" ? "LIVE" : a.status === "alert" ? "⚠ ALERT" : a.status === "complete" ? "✓ DONE" : "IDLE"}</span>
              </div>
              <div style={{ fontSize: 10, color: "#2A5A7A", marginBottom: 8 }}>{a.client}</div>
              <Bar v={a.pct} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Main Content Router ────────────────────────────────────────────────
  const renderContent = () => {
    if (graphLoading && nav !== "ops") return <Spinner />;
    if (graphError && nav !== "ops") return (
      <div style={{ background: CARD, border: `1px solid ${WARN}44`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 11, color: WARN }}>⚠ {graphError}</div>
      </div>
    );
    switch (nav) {
      case "mail": return renderEmailPanel();
      case "calendar": return renderCalendarPanel();
      default: return renderOpsPanel();
    }
  };

  return (
    <div style={{ fontFamily: "monospace", background: DARK, minHeight: "100vh", color: "#C8E0F4", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{css}{`*{box-sizing:border-box}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1A3A5C;border-radius:4px}`}</style>
      <div style={{ position: "fixed", inset: 0, background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,230,195,0.015) 2px,rgba(0,230,195,0.015) 4px)", pointerEvents: "none", zIndex: 999 }} />

      {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
      <div style={{ height: 52, background: "#080F1C", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT, letterSpacing: 3, textShadow: `0 0 20px ${ACCENT}88` }}>◈ ULU MALU</div>
          <div style={{ fontSize: 10, color: "#2A5A7A", letterSpacing: 2 }}>COMMAND NEXUS v2.0</div>
          <Dot c={GREEN} /><span style={{ fontSize: 10, color: "#3A7A5A" }}>ZERO-TRUST ACTIVE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 10 }}>
          <span style={{ color: "#2A5A7A" }}>{time.toLocaleTimeString("en-US", { hour12: false })} HST</span>
          {isAuth ? (
            <>
              <Dot c={GREEN} /><span style={{ color: "#3A7A5A" }}>AUTHENTICATED</span>
              <span
                onClick={handleLogout}
                style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}44`, borderRadius: 6, padding: "3px 10px", color: ACCENT, cursor: "pointer" }}
              >
                {profile?.displayName || account?.username || "User"} ✕
              </span>
            </>
          ) : (
            <button
              onClick={handleLogin}
              style={{ background: `${WARN}22`, border: `1px solid ${WARN}`, color: WARN, borderRadius: 6, padding: "4px 12px", fontSize: 10, cursor: "pointer", fontFamily: "monospace", animation: "pulse 2s infinite" }}
            >
              ⚡ SIGN IN
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ─── Left Nav ─────────────────────────────────────────────────── */}
        <div style={{ width: 200, background: "#080F1C", borderRight: `1px solid ${BORDER}`, padding: "16px 0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          {navItems.map(n => {
            const a = nav === n.id;
            return (
              <div key={n.id} onClick={() => setNav(n.id)} style={{ padding: "12px 18px", cursor: "pointer", borderLeft: `2px solid ${a ? ACCENT : "transparent"}`, background: a ? `${ACCENT}08` : "transparent", marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ color: a ? ACCENT : "#2A5A7A" }}>{n.icon}</span>
                  <span style={{ fontSize: 10, color: a ? "#C8E0F4" : "#3A6080" }}>{n.label}</span>
                </div>
                <div style={{ fontSize: 9, color: a ? "#5A9ABA" : "#1A4060", paddingLeft: 22 }}>{n.sub}</div>
              </div>
            );
          })}
          <div style={{ marginTop: "auto", padding: "16px 18px", borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 9, color: "#1A4060", letterSpacing: 2, marginBottom: 8 }}>FOUNDRY MODELS</div>
            {["Grok 4.20 Beta", "Claude 3.5", "o1-preview", "GPT-4o"].map(m => <div key={m} style={{ fontSize: 9, color: "#2A5A7A", padding: "3px 0", display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 4, height: 4, borderRadius: "50%", background: "#1A6A4A", display: "inline-block" }} />{m}</div>)}
          </div>
        </div>

        {/* ─── Meta Commander ───────────────────────────────────────────── */}
        <div style={{ width: "28%", display: "flex", flexDirection: "column", borderRight: `1px solid ${BORDER}`, background: "#080F1C" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, fontSize: 10, color: "#3A6080", letterSpacing: 2 }}><span style={{ color: ACCENT }}>◈</span> META COMMANDER</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {log.map((m, i) => (
              <div key={i} style={{ animation: "fadeIn 0.3s ease" }}>
                {m.role === "system" && <div style={{ fontSize: 10, color: "#2A6A5A", background: `${GREEN}08`, border: `1px solid ${GREEN}22`, borderRadius: 6, padding: "8px 10px" }}><span style={{ color: GREEN }}>// </span>{m.text}</div>}
                {m.role === "user" && <div><div style={{ fontSize: 9, color: "#2A5A7A", marginBottom: 3, textAlign: "right" }}>YOU</div><div style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}33`, borderRadius: "8px 8px 2px 8px", padding: "8px 12px", fontSize: 11, color: "#A0C8E0", lineHeight: 1.5 }}>{m.text}</div></div>}
                {m.role === "ai" && <div><div style={{ fontSize: 9, color: "#2A5A7A", marginBottom: 3 }}>META COMMANDER</div><div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "8px 8px 8px 2px", padding: "10px 12px", fontSize: 11, color: "#8AB0C8", lineHeight: 1.6, whiteSpace: "pre-line" }}>{m.text}</div></div>}
              </div>
            ))}
            {typing && <div style={{ display: "flex", gap: 4, padding: "8px 12px" }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, animation: `pulse 1s ${i * 0.3}s infinite` }} />)}</div>}
            {pending && (
              <div style={{ background: `${WARN}11`, border: `1px solid ${WARN}44`, borderRadius: 8, padding: "10px 12px", margin: "0 0 8px" }}>
                <div style={{ fontSize: 10, color: WARN, marginBottom: 8 }}>⚠ AWAITING APPROVAL</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setPending(false); setLog(l => [...l, { role: "ai", text: "✓ APPROVED.\n✓ Logic App triggered\n✓ Done in 47 seconds." }]) }} style={{ flex: 1, background: `${GREEN}22`, border: `1px solid ${GREEN}`, color: GREEN, borderRadius: 6, padding: "6px", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>✓ APPROVE</button>
                  <button onClick={() => setPending(false)} style={{ flex: 1, background: "transparent", border: `1px solid ${BORDER}`, color: "#3A6080", borderRadius: 6, padding: "6px", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>✗ CANCEL</button>
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Command Meta Commander..." rows={2} style={{ flex: 1, background: "#0D1F35", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", color: "#8AB0C8", fontSize: 11, resize: "none", fontFamily: "monospace", lineHeight: 1.4 }} />
              <button onClick={send} style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}`, borderRadius: 8, color: ACCENT, padding: "8px 12px", cursor: "pointer", fontSize: 14 }}>▶</button>
            </div>
          </div>
        </div>

        {/* ─── Main Content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {renderContent()}
        </div>

        {/* ─── Right Sidebar ────────────────────────────────────────────── */}
        <div style={{ width: 190, background: "#080F1C", borderLeft: `1px solid ${BORDER}`, padding: "16px 12px", overflowY: "auto" }}>
          <div style={{ fontSize: 9, color: "#2A5A7A", letterSpacing: 2, marginBottom: 12 }}>QUICK ACTIONS</div>
          {[["⬡", "LAUNCH PENTEST", ACCENT], ["◈", "DEPLOY AI AGENT", BLUE], ["◆", "SEND OUTREACH", "#FFD166"], ["◉", "RUN SCENARIOS", GREEN], ["◇", "AUDIT INVOICES", WARN], ["⊛", "THREAT SCAN", WARN]].map(([icon, label, color]) => (
            <button key={label} onClick={() => setInput(label)} style={{ width: "100%", padding: "10px 14px", marginBottom: 8, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8, color: "#5A7FA0", fontSize: 11, cursor: "pointer", textAlign: "left", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}><span style={{ color }}>{icon}</span>{label}</button>
          ))}
          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 9, color: "#2A5A7A", letterSpacing: 2, marginBottom: 10 }}>AZURE RESOURCES</div>
            {[
              { name: "kiai-guardian", type: "AI Services", ok: true, url: "https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/overview" },
              { name: "ulu-malu-kv", type: "Key Vault", ok: true, url: "https://portal.azure.com/#browse/Microsoft.KeyVault%2Fvaults" },
              { name: "rg-uluguardian", type: "Resource Group", ok: true, url: "https://portal.azure.com/#browse/resourcegroups" },
              { name: "MS Foundry", type: isAuth ? "Connected" : "Sign-in required", ok: isAuth, action: isAuth ? "https://ai.azure.com" : "login" },
            ].map((r, i) => (
              <div key={i} onClick={() => { if (r.action === "login") { handleLogin(); } else { window.open(r.url || r.action, "_blank"); } }} style={{ marginBottom: 8, padding: "6px 8px", background: CARD, borderRadius: 6, border: `1px solid ${r.ok ? BORDER : WARN + "44"}`, cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={e => { e.currentTarget.style.background = `${ACCENT}11`; e.currentTarget.style.borderColor = r.ok ? ACCENT + "44" : WARN; }} onMouseLeave={e => { e.currentTarget.style.background = CARD; e.currentTarget.style.borderColor = r.ok ? BORDER : WARN + "44"; }}>
                <div style={{ fontSize: 9, color: r.ok ? "#5A9ABA" : WARN, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                <div style={{ fontSize: 8, color: r.ok ? "#2A4A60" : WARN + "88", display: "flex", justifyContent: "space-between" }}><span>{r.type}</span><span style={{ color: ACCENT + "66" }}>↗</span></div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 8, paddingTop: 12 }}>
            <div style={{ fontSize: 9, color: "#2A5A7A", letterSpacing: 2, marginBottom: 10 }}>ULU STACK</div>
            {[
              { name: "Copilot Studio", url: "https://copilotstudio.microsoft.com" },
              { name: "Azure Foundry", url: "https://ai.azure.com" },
              { name: "Azure Functions", url: "https://portal.azure.com/#browse/Microsoft.Web%2Fsites/kind/functionapp" },
              { name: "Logic Apps", url: "https://portal.azure.com/#browse/Microsoft.Logic%2Fworkflows" },
              { name: "Key Vault", url: "https://portal.azure.com/#browse/Microsoft.KeyVault%2Fvaults" },
              { name: "SharePoint", url: "https://admin.microsoft.com/#/homepage" },
              { name: "Power BI", url: "https://app.powerbi.com" },
            ].map(s => <div key={s.name} onClick={() => window.open(s.url, "_blank")} style={{ fontSize: 9, color: "#1A4A6A", padding: "4px 4px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", borderRadius: 4, transition: "all 0.15s ease" }} onMouseEnter={e => { e.currentTarget.style.color = ACCENT; e.currentTarget.style.background = `${ACCENT}08`; }} onMouseLeave={e => { e.currentTarget.style.color = "#1A4A6A"; e.currentTarget.style.background = "transparent"; }}><span style={{ width: 4, height: 4, borderRadius: "50%", background: "#0A4A3A", display: "inline-block", flexShrink: 0 }} />{s.name}<span style={{ marginLeft: "auto", fontSize: 7, opacity: 0.4 }}>↗</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
