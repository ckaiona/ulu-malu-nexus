import os
import imaplib
import smtplib
import textwrap
from io import BytesIO
from email import message_from_bytes
from email.message import EmailMessage
from email.utils import parseaddr

import streamlit as st
import streamlit.components.v1 as components
from litellm import completion
from openai import OpenAI


def transcribe_audio(uploaded_audio, openai_key):
    if uploaded_audio is None:
        return "", "Record audio first."
    if not openai_key:
        return "", "Add OpenAI API Key (Voice) in the sidebar."

    audio_buffer = BytesIO(uploaded_audio.getvalue())
    audio_buffer.name = getattr(uploaded_audio, "name", "voice_input.wav")

    try:
        client = OpenAI(api_key=openai_key)
        result = client.audio.transcriptions.create(
            model="gpt-4o-mini-transcribe",
            file=audio_buffer,
        )
        transcript = getattr(result, "text", "").strip()
        if not transcript:
            return "", "Transcription returned empty text."
        return transcript, ""
    except Exception as exc:
        return "", f"Transcription failed: {exc}"


def fetch_inbox_messages(imap_host, imap_port, email_address, email_password, limit=10):
    mailbox = imaplib.IMAP4_SSL(imap_host, imap_port)
    mailbox.login(email_address, email_password)
    mailbox.select("INBOX")
    status, data = mailbox.search(None, "ALL")
    if status != "OK":
        mailbox.logout()
        return []

    ids = data[0].split()[-limit:]
    messages = []
    for msg_id in reversed(ids):
        fetch_status, msg_data = mailbox.fetch(msg_id, "(RFC822)")
        if fetch_status != "OK" or not msg_data or not msg_data[0]:
            continue
        raw = msg_data[0][1]
        parsed = message_from_bytes(raw)

        subject = parsed.get("Subject", "(No Subject)")
        from_name, from_email = parseaddr(parsed.get("From", ""))
        date_value = parsed.get("Date", "")

        body_text = ""
        if parsed.is_multipart():
            for part in parsed.walk():
                content_type = part.get_content_type()
                disposition = str(part.get("Content-Disposition", ""))
                if content_type == "text/plain" and "attachment" not in disposition:
                    payload = part.get_payload(decode=True)
                    if payload:
                        body_text = payload.decode(errors="ignore")
                        break
        else:
            payload = parsed.get_payload(decode=True)
            if payload:
                body_text = payload.decode(errors="ignore")

        messages.append(
            {
                "id": msg_id.decode(),
                "subject": subject,
                "from_name": from_name,
                "from_email": from_email,
                "date": date_value,
                "body": body_text.strip(),
            }
        )

    mailbox.logout()
    return messages


def generate_reply_draft(model_choice, email_subject, email_body):
    prompt = textwrap.dedent(
        f"""
        Write a concise professional email reply.
        Original subject: {email_subject}
        Original email body:
        {email_body[:5000]}
        """
    ).strip()

    response = completion(
        model=model_choice,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return response["choices"][0]["message"]["content"]


def send_email(smtp_host, smtp_port, smtp_mode, email_address, email_password, to_email, subject, body):
    msg = EmailMessage()
    msg["From"] = email_address
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    if smtp_mode == "STARTTLS":
      with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(email_address, email_password)
        server.send_message(msg)
    else:
      with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
        server.login(email_address, email_password)
        server.send_message(msg)


def test_mail_login(imap_host, imap_port, smtp_host, smtp_port, smtp_mode, email_address, email_password):
    result = {
      "imap_ok": False,
      "smtp_ok": False,
      "imap_error": "",
      "smtp_error": "",
    }

    try:
      mailbox = imaplib.IMAP4_SSL(imap_host, int(imap_port))
      mailbox.login(email_address, email_password)
      mailbox.select("INBOX")
      mailbox.logout()
      result["imap_ok"] = True
    except Exception as exc:
      result["imap_error"] = str(exc)

    try:
      if smtp_mode == "STARTTLS":
        with smtplib.SMTP(smtp_host, int(smtp_port), timeout=20) as server:
          server.ehlo()
          server.starttls()
          server.ehlo()
          server.login(email_address, email_password)
      else:
        with smtplib.SMTP_SSL(smtp_host, int(smtp_port), timeout=20) as server:
          server.login(email_address, email_password)
      result["smtp_ok"] = True
    except Exception as exc:
      result["smtp_error"] = str(exc)

    return result


st.set_page_config(page_title="ULU Command Grid", page_icon="⬛", layout="wide")

st.markdown(
    """
<style>
:root {
  --bg: #000000;
  --bg-elev: #070707;
  --bg-panel: #0d0d0d;
  --line: rgba(255,255,255,0.16);
  --line-strong: rgba(255,255,255,0.28);
  --text: #f2f2f2;
  --muted: #a8a8a8;
  --soft: #7c7c7c;
  --parallax-y: 0px;
  --parallax-y-slow: 0px;
}

.stApp {
  background: var(--bg);
  color: var(--text);
}

.parallax-wrap {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.parallax-layer {
  position: absolute;
  inset: -18% -10%;
}

.layer-1 {
  background:
    linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 80px);
  transform: translateY(calc(var(--parallax-y-slow) * -0.8));
}

.layer-2 {
  background:
    radial-gradient(circle at 75% 20%, rgba(255,255,255,0.08), transparent 26%),
    radial-gradient(circle at 18% 70%, rgba(255,255,255,0.05), transparent 30%);
  transform: translateY(calc(var(--parallax-y) * -1));
}

.layer-3 {
  background: repeating-linear-gradient(180deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 64px);
  transform: translateY(calc(var(--parallax-y) * -0.55));
}

.block-container {
  position: relative;
  z-index: 2;
  max-width: 1200px;
  padding-top: 1.6rem;
  padding-bottom: 2.6rem;
}

.topbar {
  border: 1px solid var(--line);
  background: rgba(6,6,6,0.85);
  border-radius: 6px;
  padding: 0.7rem 1rem;
  margin-bottom: 1rem;
}

.topbar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.brand {
  color: #ffffff;
  font-size: 0.92rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-weight: 700;
}

.top-links {
  display: flex;
  gap: 0.9rem;
  color: var(--muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.hero {
  border: 1px solid var(--line-strong);
  background: linear-gradient(180deg, #060606 0%, #020202 100%);
  border-radius: 6px;
  padding: 1.4rem;
  margin-bottom: 0.9rem;
}

.kicker {
  color: var(--soft);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  margin-bottom: 0.45rem;
}

.hero h1 {
  margin: 0;
  color: #ffffff;
  font-size: clamp(1.55rem, 2.8vw, 2.35rem);
  line-height: 1.1;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero p {
  color: var(--muted);
  margin-top: 0.75rem;
  margin-bottom: 0;
  max-width: 860px;
}

.section-label {
  margin: 1rem 0 0.55rem 0;
  color: var(--soft);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.module {
  border: 1px solid var(--line);
  background: var(--bg-elev);
  border-radius: 4px;
  padding: 0.95rem;
  min-height: 136px;
}

.module h4 {
  margin: 0 0 0.35rem 0;
  font-size: 0.92rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffffff;
}

.module p {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
}

.console {
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 1rem;
  margin-top: 0.8rem;
}

textarea, .stTextArea textarea {
  background: #010101 !important;
  color: #f2f2f2 !important;
  border: 1px solid rgba(255,255,255,0.20) !important;
  border-radius: 4px !important;
}

.stTextInput input, .stSelectbox div[data-baseweb="select"] {
  background: #010101 !important;
  color: #f2f2f2 !important;
}

div.stButton > button {
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.28);
  background: #0a0a0a;
  color: #f4f4f4;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.78rem;
  font-weight: 700;
}

div.stButton > button:hover {
  border-color: rgba(255,255,255,0.45);
  background: #101010;
}

.hr {
  height: 1px;
  margin: 0.9rem 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.30), transparent);
}

.status-chip {
  display: inline-block;
  border: 1px solid var(--line);
  background: #020202;
  color: #d8d8d8;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  border-radius: 3px;
  padding: 0.28rem 0.45rem;
  margin-bottom: 0.75rem;
}

.chat-panel {
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: #080808;
  padding: 0.95rem;
  margin-top: 1rem;
}

.chat-title {
  color: #f4f4f4;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  margin-bottom: 0.65rem;
}

.chat-launcher {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 9999;
  border-radius: 5px;
  border: 1px solid rgba(255,255,255,0.35);
  background: #050505;
  color: #f5f5f5;
  padding: 0.62rem 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  font-size: 0.73rem;
  font-weight: 700;
  cursor: pointer;
}

.chat-launcher:hover {
  border-color: rgba(255,255,255,0.52);
  background: #0e0e0e;
}

.launcher-status {
  color: #bdbdbd;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-top: 0.25rem;
}
</style>
""",
    unsafe_allow_html=True,
)

with st.sidebar:
    st.markdown("### Command Vault")
    xai_key = st.text_input("XAI API Key", type="password")
    anthropic_key = st.text_input("Anthropic API Key", type="password")
    openai_key = st.text_input("OpenAI API Key (Voice)", type="password")

    if xai_key:
        os.environ["XAI_API_KEY"] = xai_key
    if anthropic_key:
        os.environ["ANTHROPIC_API_KEY"] = anthropic_key
    if openai_key:
        os.environ["OPENAI_API_KEY"] = openai_key

    st.markdown("---")
    st.markdown("### Mail Transport")
    mail_provider = st.selectbox("Provider", ["Outlook", "Gmail", "Custom"], index=0)

    if mail_provider == "Outlook":
      default_imap_host = "outlook.office365.com"
      default_imap_port = 993
      default_smtp_host = "smtp.office365.com"
      default_smtp_port = 587
      default_smtp_mode = "STARTTLS"
    elif mail_provider == "Gmail":
      default_imap_host = "imap.gmail.com"
      default_imap_port = 993
      default_smtp_host = "smtp.gmail.com"
      default_smtp_port = 465
      default_smtp_mode = "SSL"
    else:
      default_imap_host = ""
      default_imap_port = 993
      default_smtp_host = ""
      default_smtp_port = 465
      default_smtp_mode = "SSL"

    email_address = st.text_input("Email Address")
    email_password = st.text_input("Email App Password", type="password")
    imap_host = st.text_input("IMAP Host", value=default_imap_host)
    imap_port = st.number_input("IMAP Port", min_value=1, max_value=65535, value=default_imap_port, step=1)
    smtp_host = st.text_input("SMTP Host", value=default_smtp_host)
    smtp_port = st.number_input("SMTP Port", min_value=1, max_value=65535, value=default_smtp_port, step=1)
    smtp_mode = st.selectbox("SMTP Security", ["STARTTLS", "SSL"], index=0 if default_smtp_mode == "STARTTLS" else 1)

    if mail_provider == "Outlook":
      st.caption("Outlook preset: IMAP outlook.office365.com:993 and SMTP smtp.office365.com:587 (STARTTLS).")

    st.caption("Keys are held in session memory only.")

st.markdown(
    """
<div class="parallax-wrap">
  <div class="parallax-layer layer-1"></div>
  <div class="parallax-layer layer-2"></div>
  <div class="parallax-layer layer-3"></div>
</div>
""",
    unsafe_allow_html=True,
)

components.html(
    """
<script>
(function () {
  const p = window.parent;
  const root = p.document.documentElement;
  function update() {
    const y = p.scrollY || p.pageYOffset || 0;
    root.style.setProperty('--parallax-y', `${Math.min(220, y * 0.26)}px`);
    root.style.setProperty('--parallax-y-slow', `${Math.min(260, y * 0.16)}px`);
  }
  update();
  p.addEventListener('scroll', update, { passive: true });
})();
</script>
""",
    height=0,
)

components.html(
    """
<script>
(function () {
  const p = window.parent;
  const id = 'ulu-chat-launcher';

  function isOpen() {
    const url = new URL(p.location.href);
    return url.searchParams.get('chat') === '1';
  }

  function toggleChat() {
    const url = new URL(p.location.href);
    url.searchParams.set('chat', isOpen() ? '0' : '1');
    p.location.href = url.toString();
  }

  function mountButton() {
    let btn = p.document.getElementById(id);
    if (!btn) {
      btn = p.document.createElement('button');
      btn.id = id;
      p.document.body.appendChild(btn);
    }
    btn.style.position = 'fixed';
    btn.style.right = '22px';
    btn.style.bottom = '22px';
    btn.style.zIndex = '99999';
    btn.style.borderRadius = '4px';
    btn.style.border = '1px solid rgba(255,255,255,0.45)';
    btn.style.background = '#050505';
    btn.style.color = '#f5f5f5';
    btn.style.padding = '10px 13px';
    btn.style.textTransform = 'uppercase';
    btn.style.letterSpacing = '0.08em';
    btn.style.fontSize = '11px';
    btn.style.fontWeight = '700';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.08)';
    btn.textContent = isOpen() ? 'Close Chat (⌘K)' : 'Open Chat (⌘K)';
    btn.title = 'Toggle Command Chat';
    btn.onclick = toggleChat;
  }

  mountButton();
})();
</script>
""",
    height=0,
)

components.html(
    """
<script>
(function () {
  const p = window.parent;
  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
      e.preventDefault();
      const url = new URL(p.location.href);
      url.searchParams.set('chat', '1');
      p.location.href = url.toString();
    }
  }
  p.addEventListener('keydown', onKey);
})();
</script>
""",
    height=0,
)

st.markdown(
    """
<div class="topbar">
  <div class="topbar-row">
    <div class="brand">ULU BLACKBOX COMMAND GRID</div>
    <div class="top-links">
      <span>Ops</span>
      <span>Signals</span>
      <span>Sovereignty</span>
      <span>Logs</span>
    </div>
  </div>
</div>
""",
    unsafe_allow_html=True,
)

st.markdown(
    """
<section class="hero">
  <div class="kicker">Operational Interface</div>
  <h1>All-Black Strategic Drafting Console</h1>
  <p>Military-grade visual direction: black surfaces, white to gray text, and minimal chrome. Voice capture and live model routing remain active.</p>
</section>
""",
    unsafe_allow_html=True,
)

st.markdown('<div class="section-label">System Modules</div>', unsafe_allow_html=True)
c1, c2, c3 = st.columns(3)
with c1:
    st.markdown(
        """
<div class="module">
  <h4>Identity Mesh</h4>
  <p>Secure operator context, scoped access, and controlled communication boundaries.</p>
</div>
""",
        unsafe_allow_html=True,
    )
with c2:
    st.markdown(
        """
<div class="module">
  <h4>Signal Routing</h4>
  <p>Model route selection with deterministic fallback behavior under service disruption.</p>
</div>
""",
        unsafe_allow_html=True,
    )
with c3:
    st.markdown(
        """
<div class="module">
  <h4>Draft Engine</h4>
  <p>Executive-grade email output with concise structure and traceable prompt intent.</p>
</div>
""",
        unsafe_allow_html=True,
    )

st.markdown('<div class="hr"></div>', unsafe_allow_html=True)
st.markdown('<div class="section-label">Command Console</div>', unsafe_allow_html=True)

if "voice_input" not in st.session_state:
    st.session_state["voice_input"] = ""
if "chat_open" not in st.session_state:
    st.session_state["chat_open"] = False
if "chat_history" not in st.session_state:
    st.session_state["chat_history"] = [
        {
            "role": "assistant",
            "content": "Command Grid chat online. Send a prompt to start.",
        }
    ]
st.session_state["chat_open"] = st.query_params.get("chat", "0") == "1"

if "inbox_messages" not in st.session_state:
  st.session_state["inbox_messages"] = []
if "reply_draft" not in st.session_state:
  st.session_state["reply_draft"] = ""

with st.container():
    st.markdown('<div class="console">', unsafe_allow_html=True)
    st.markdown('<div class="status-chip">System Armed</div>', unsafe_allow_html=True)

    model_choice = st.selectbox(
        "Model Route",
        ["grok-beta", "claude-3-5-sonnet-latest", "gpt-4o-mini"],
        index=0,
    )

    audio_clip = st.audio_input("Voice Channel")
    if st.button("Transcribe Voice"):
        transcript, error = transcribe_audio(audio_clip, openai_key)
        if error:
            st.warning(error)
        else:
            st.session_state["voice_input"] = transcript
            st.success("Voice captured.")

    voice_input = st.text_area(
        "Mission Input",
        key="voice_input",
        placeholder="Type or transcribe operator instructions...",
        height=150,
    )

    if st.button("Deploy Service"):
        if not voice_input.strip():
            st.warning("Provide mission input before deployment.")
        else:
            prompt = textwrap.dedent(
                f"""
                You are ULU Malu AI.
                Produce a concise, executive-grade email draft.
                User request: {voice_input}
                """
            ).strip()

            try:
                response = completion(
                    model=model_choice,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                )
                text = response["choices"][0]["message"]["content"]
                st.success("Draft generated.")
                st.text_area("Generated Draft", value=text, height=260)
            except Exception:
                fallback = (
                    "Subject: Strategic Follow-Up\n\n"
                    "Hello Team,\n\n"
                    f"Received your request: {voice_input}\n\n"
                    "Recommendation: align on scope, owners, timeline, and success metrics in a short operational sync.\n\n"
                    "Regards,\nULU Malu AI"
                )
                st.info("Live model unavailable. Using fallback draft.")
                st.text_area("Generated Draft", value=fallback, height=260)

    st.markdown("</div>", unsafe_allow_html=True)

st.markdown('<div class="hr"></div>', unsafe_allow_html=True)
st.markdown('<div class="section-label">Email Operations</div>', unsafe_allow_html=True)

ops_col_1, ops_col_2 = st.columns([1, 1])
with ops_col_1:
    if st.button("Check Inbox"):
        if not all([email_address, email_password, imap_host, imap_port]):
            st.warning("Provide email address, app password, and IMAP settings.")
        else:
            try:
                st.session_state["inbox_messages"] = fetch_inbox_messages(
                    imap_host,
                    int(imap_port),
                    email_address,
                    email_password,
                    limit=10,
                )
                st.success(f"Loaded {len(st.session_state['inbox_messages'])} messages.")
            except Exception as exc:
                st.error(f"Inbox check failed: {exc}")

        if st.button("Test Mail Login"):
          if not all([email_address, email_password, imap_host, imap_port, smtp_host, smtp_port]):
            st.warning("Fill all mail transport fields first.")
          else:
            diag = test_mail_login(
              imap_host,
              int(imap_port),
              smtp_host,
              int(smtp_port),
              smtp_mode,
              email_address,
              email_password,
            )
            if diag["imap_ok"]:
              st.success("IMAP login: OK")
            else:
              st.error(f"IMAP login failed: {diag['imap_error']}")

            if diag["smtp_ok"]:
              st.success("SMTP login: OK")
            else:
              st.error(f"SMTP login failed: {diag['smtp_error']}")

            if not (diag["imap_ok"] and diag["smtp_ok"]):
              st.info(
                "Outlook tips: use an app password (not your normal password), keep IMAP/SMTP enabled, "
                "and for Microsoft 365 tenants ensure basic auth for IMAP/SMTP is allowed by policy."
              )

with ops_col_2:
    st.caption("Supports IMAP/SMTP with app passwords (Gmail/Outlook/custom server).")

if st.session_state["inbox_messages"]:
    options = [
        f"{m['subject']} — {m['from_email']}"
        for m in st.session_state["inbox_messages"]
    ]
    selected_idx = st.selectbox("Inbox", range(len(options)), format_func=lambda i: options[i], key="inbox_select")
    selected_msg = st.session_state["inbox_messages"][selected_idx]

    st.text_area(
        "Selected Email",
        value=f"From: {selected_msg['from_name']} <{selected_msg['from_email']}>\n"
        f"Date: {selected_msg['date']}\n"
        f"Subject: {selected_msg['subject']}\n\n{selected_msg['body'][:8000]}",
        height=220,
        key="selected_email_view",
    )

    gen_col, send_col = st.columns([1, 1])
    with gen_col:
        if st.button("Generate Reply"):
            try:
                st.session_state["reply_draft"] = generate_reply_draft(
                    model_choice,
                    selected_msg["subject"],
                    selected_msg["body"],
                )
                st.success("Reply draft generated.")
            except Exception as exc:
                st.error(f"Reply generation failed: {exc}")

    reply_body = st.text_area("Reply Draft", key="reply_draft", height=220)

    with send_col:
        if st.button("Send Reply"):
            if not all([email_address, email_password, smtp_host, smtp_port]):
                st.warning("Provide email address, app password, and SMTP settings.")
            elif not selected_msg["from_email"]:
                st.warning("Selected email does not have a valid sender address.")
            elif not reply_body.strip():
                st.warning("Reply draft is empty.")
            else:
                try:
                    subject = selected_msg["subject"]
                    if not subject.lower().startswith("re:"):
                        subject = f"Re: {subject}"
                    send_email(
                        smtp_host,
                        int(smtp_port),
                      smtp_mode,
                        email_address,
                        email_password,
                        selected_msg["from_email"],
                        subject,
                        reply_body,
                    )
                    st.success(f"Reply sent to {selected_msg['from_email']}.")
                except Exception as exc:
                    st.error(f"Send reply failed: {exc}")

st.markdown('<div class="section-label">Compose & Send</div>', unsafe_allow_html=True)
compose_to = st.text_input("To", key="compose_to")
compose_subject = st.text_input("Subject", key="compose_subject")
compose_body = st.text_area("Message", key="compose_body", height=180)
if st.button("Send Email"):
    if not all([email_address, email_password, smtp_host, smtp_port, compose_to, compose_subject, compose_body.strip()]):
        st.warning("Fill all compose fields and SMTP credentials.")
    else:
        try:
            send_email(
                smtp_host,
                int(smtp_port),
              smtp_mode,
                email_address,
                email_password,
                compose_to,
                compose_subject,
                compose_body,
            )
            st.success(f"Email sent to {compose_to}.")
        except Exception as exc:
            st.error(f"Send email failed: {exc}")

if st.session_state["chat_open"]:
    st.markdown('<div class="chat-panel">', unsafe_allow_html=True)
    st.markdown('<div class="chat-title">Interactive Command Chat</div>', unsafe_allow_html=True)
    st.caption("Launcher + Shortcut: ⌘K / Ctrl+K")
    st.markdown('<div class="launcher-status">JS Launcher Active</div>', unsafe_allow_html=True)

    clear_col, _ = st.columns([1, 6])
    with clear_col:
        if st.button("Clear Chat"):
            st.session_state["chat_history"] = [
                {
                    "role": "assistant",
                    "content": "Chat reset complete. Awaiting new instructions.",
                }
            ]

    for msg in st.session_state["chat_history"]:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_chat = st.chat_input("Send command...")
    if user_chat:
        st.session_state["chat_history"].append({"role": "user", "content": user_chat})
        with st.chat_message("user"):
            st.markdown(user_chat)

        try:
            response = completion(
                model=model_choice,
                messages=st.session_state["chat_history"],
                temperature=0.3,
            )
            assistant_text = response["choices"][0]["message"]["content"]
        except Exception:
            assistant_text = (
                "Chat model is unavailable right now. "
                "Try again or continue using the Deploy Service flow above."
            )

        st.session_state["chat_history"].append({"role": "assistant", "content": assistant_text})
        with st.chat_message("assistant"):
            st.markdown(assistant_text)

    st.markdown("</div>", unsafe_allow_html=True)
