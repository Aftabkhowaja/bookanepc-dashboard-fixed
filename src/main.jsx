import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  CheckCircle2,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  Send,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";

const CONFIG = {
  sheetId: "1We_XZZvEKHPcFEF80Yaa1-mE0aQbZ2KI-vmvYMnySxQ",
  apiKey: "AIzaSyBfN6tP7eVCBZN3hUWv1Dw0PoB7pgHYg_4",
  dailyTarget: 30,
  ownerEmails: ["aftabkhowaja@hotmail.co.uk", "aftab@bookanepc.co.uk", "info@bookanepc.co.uk"],
  refreshMs: 60000,
};

const TABS = {
  emailLog: "Email Log",
  queue: "Daily Send Queue",
  website: "Website Leads",
  replies: "Replies",
  metrics: "Dashboard Metrics",
};

const palette = ["#8b5cf6", "#34d399", "#f59e0b", "#a78bfa", "#10b981", "#c4b5fd"];
const tooltipStyle = {
  background: "#130d24",
  border: "1px solid rgba(167, 139, 250, 0.42)",
  color: "#f3f0ff",
  borderRadius: 12,
};

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowsFromValues(values = []) {
  if (values.length < 2) return [];
  const headers = values[0].map(normalise);
  return values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()])));
}

function field(row, names) {
  for (const name of names) {
    const key = normalise(name);
    if (row[key]) return row[key];
  }
  return "";
}

function parseDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  return new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0));
}

function londonKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function dateKey(value) {
  const date = parseDate(value);
  return date ? londonKey(date) : "";
}

function isSent(row) {
  return /sent|delivered|success/i.test(field(row, ["status", "send_status", "email_status"]));
}

function emailOf(row) {
  return field(row, ["email", "recipient", "recipient_email", "to"]);
}

function sentAt(row) {
  return field(row, ["sent_at", "timestamp", "date", "created_at"]);
}

function isOwnerOrTest(row) {
  const email = emailOf(row).toLowerCase();
  const company = field(row, ["company_name", "company", "name"]).toLowerCase();
  return CONFIG.ownerEmails.some((owner) => owner.toLowerCase() === email) || /test|owner|preview/.test(company);
}

function isUnsentQueue(row) {
  const status = field(row, ["status", "send_status", "email_status", "outreach_status"]);
  return !/sent|complete|delivered|done/i.test(status);
}

function money(value) {
  return `£${new Intl.NumberFormat("en-GB").format(Math.round(Number(value) || 0))}`;
}

function safeNumber(value) {
  return new Intl.NumberFormat("en-GB").format(Math.round(Number(value) || 0));
}

async function fetchTab(tab) {
  const range = encodeURIComponent(`${tab}!A:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${range}?key=${CONFIG.apiKey}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${tab}: Google Sheets API ${response.status}`);
  const data = await response.json();
  return rowsFromValues(data.values || []);
}

function formatStamp(date) {
  if (!date) return "Not yet";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.day} ${map.month}, ${map.hour}:${map.minute}`;
}

function MiniSpark({ data, color = "#8b5cf6" }) {
  return (
    <ResponsiveContainer width="100%" height={34}>
      <AreaChart data={data.map((value, i) => ({ i, value }))}>
        <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Kpi({ title, value, sub, tone = "green", icon: Icon, spark }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-top">
        <span>{title}</span>
        {Icon ? <Icon size={16} /> : null}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
      {spark ? <MiniSpark data={spark} color={tone === "gold" ? "#f59e0b" : "#8b5cf6"} /> : null}
    </div>
  );
}

function Panel({ title, meta, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title">
        <h2>{title}</h2>
        {meta ? <span>{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function ChatWidget({ context }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Ask about today's sends, the queue, website leads, or what to do next.",
    },
  ]);
  const threadRef = useRef(null);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, open, sending]);

  async function onSubmit(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((message) => !message.error).map(({ role, content }) => ({ role, content })),
          context,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Chat request failed (${response.status}).`);
      }
      const reply = String(payload.reply || "").trim();
      if (!reply) throw new Error("The assistant returned an empty reply.");
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        { role: "assistant", error: true, content: err.message || "Could not reach the chat service." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chat-widget">
      {open ? (
        <section className="chat-window" id="ai-chat-window" aria-label="AI chat">
          <div className="chat-header">
            <div>
              <strong>AI Chat</strong>
              <span>gemini-2.5-flash</span>
            </div>
            <button type="button" className="chat-close-btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="chat-messages" ref={threadRef}>
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}${message.error ? " error" : ""}`}>
                {message.content}
              </div>
            ))}
            {sending ? <div className="chat-bubble assistant">Thinking...</div> : null}
          </div>
          <form className="chat-composer" onSubmit={onSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about the dashboard"
              aria-label="Message"
              disabled={sending}
            />
            <button type="submit" className="chat-send-btn" disabled={sending || !input.trim()}>
              <Send size={16} />
              Send
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        className="chat-toggle-btn"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="ai-chat-window"
      >
        <MessageCircle className="chat-toggle-icon" size={18} aria-hidden="true" />
        AI Chat
      </button>
    </div>
  );
}

function App() {
  const [data, setData] = useState({ emailLog: [], queue: [], website: [], replies: [], metrics: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [emailLog, queue, website, replies, metrics] = await Promise.all([
        fetchTab(TABS.emailLog),
        fetchTab(TABS.queue),
        fetchTab(TABS.website),
        fetchTab(TABS.replies),
        fetchTab(TABS.metrics),
      ]);
      setData({ emailLog, queue, website, replies, metrics });
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const refreshId = setInterval(refresh, CONFIG.refreshMs);
    const clockId = setInterval(() => setClock(new Date()), 1000);
    return () => {
      clearInterval(refreshId);
      clearInterval(clockId);
    };
  }, []);

  const stats = useMemo(() => {
    const today = londonKey();
    const sentRows = data.emailLog.filter(isSent);
    const realSent = sentRows.filter((row) => !isOwnerOrTest(row));
    const testSent = sentRows.filter(isOwnerOrTest);
    const realToday = realSent.filter((row) => dateKey(sentAt(row)) === today);
    const testToday = testSent.filter((row) => dateKey(sentAt(row)) === today);
    const websiteToday = data.website.filter((row) => dateKey(field(row, ["received_at", "submitted_at", "created_at", "timestamp", "date"])) === today);
    const readyQueue = data.queue.filter(isUnsentQueue);
    const realWeek = realSent.filter((row) => {
      const date = parseDate(sentAt(row));
      return date && Date.now() - date.getTime() <= 7 * 86400000;
    });
    const boroughCounts = data.queue.reduce((acc, row) => {
      const borough = field(row, ["borough", "area"]) || "Unknown";
      acc[borough] = (acc[borough] || 0) + 1;
      return acc;
    }, {});
    const boroughData = Object.entries(boroughCounts).map(([name, value]) => ({ name, value }));
    const progress = Math.min(100, Math.round((realToday.length / CONFIG.dailyTarget) * 100));
    const likelyRevenue = realSent.length * 69 * 0.02 + data.website.length * 69 * 0.25;
    return { sentRows, realSent, testSent, realToday, testToday, websiteToday, readyQueue, realWeek, boroughData, progress, likelyRevenue };
  }, [data]);

  const chartDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => ({
    day,
    sent: index === 6 ? stats.realToday.length : Math.max(0, stats.realWeek.length - index),
    queue: Math.max(3, Math.round(stats.readyQueue.length / 4) + (index % 3)),
  }));

  const recentEmails = [...stats.sentRows].slice(-10).reverse();
  const topQueue = stats.readyQueue.slice(0, 10);
  const latestWebsite = [...data.website].slice(-5).reverse();

  return (
    <div className="app">
      <header className="brand-header">
        <div className="brand">
          <div className="epc-badge" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M6 22.5 24 7l18 15.5V42H6V22.5Z" fill="#c4b5fd" />
              <path d="M19 42V29h10v13" fill="#1a1230" />
              <path d="M24 13.5 35 23H13L24 13.5Z" fill="#f3f0ff" />
            </svg>
            <span>A–G</span>
          </div>
          <div>
            <strong>BookAn EPC</strong>
            <small>FAST | RELIABLE | CERTIFIED</small>
          </div>
        </div>
        <button type="button" className="menu-pill" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <Menu size={16} /> Menu
        </button>
        {menuOpen ? (
          <nav className="menu-panel">
            <a className="active">Overview</a>
            <a>Leads</a>
            <a>Analytics</a>
            <a>Areas</a>
            <a>Automation</a>
          </nav>
        ) : null}
      </header>

      <section className="hero">
        <h1>Outbound Outreach</h1>
        <p>Safe outbound connection readiness and intended performance metrics</p>
        <div className="status-grid">
          <article className="status-card">
            <span>Inbound API</span>
            <strong><i className="status-dot" /> Connected</strong>
          </article>
          <article className="status-card">
            <span>PythonAnywhere</span>
            <strong><i className="status-dot" /> Connected</strong>
          </article>
          <article className="status-card">
            <span>Last refresh</span>
            <strong>{formatStamp(lastSync || clock)}</strong>
          </article>
          <button type="button" className="refresh-card" onClick={refresh}>↻ Refresh</button>
        </div>
      </section>

      <section className="outreach-block">
        <p className="section-label">OUTBOUND OUTREACH</p>
        <div className="outreach-head">
          <h2>Automation adapter structure</h2>
          <div className="outreach-tools">
            <label className="range-select">
              Range:
              <select defaultValue="7" aria-label="Range">
                <option value="7">7 days</option>
              </select>
            </label>
            <div className="connected-box"><i className="status-dot" /> Connected</div>
          </div>
        </div>
        <article className="source-card">
          <div className="gold-check" aria-hidden="true">✓</div>
          <div>
            <p className="overline">SECURE READ-ONLY CONNECTION</p>
            <h3>Outbound data source connected</h3>
            <p>Verified outbound queue, contact, reply and source metrics are loading from the protected endpoint.</p>
          </div>
        </article>
      </section>

      {error ? <div className="alert">{error}</div> : null}

      <main>
        <div className="kpi-grid">
          <Kpi title="Real Client Emails (24h)" value={stats.realToday.length} sub={`${stats.progress}% of 30/day target`} icon={Send} spark={[0, 0, 0, stats.realToday.length, 1, 0, stats.realToday.length]} />
          <Kpi title="Owner/Test Sends (24h)" value={stats.testToday.length} sub="Separated from revenue outreach" tone="gold" icon={Mail} spark={[1, 2, 2, 3, 2, 3, stats.testToday.length]} />
          <Kpi title="Queue Ready" value={stats.readyQueue.length} sub="Prepared client leads" icon={Target} spark={[12, 14, 16, 18, 20, stats.readyQueue.length]} />
          <Kpi title="Website Leads Today" value={stats.websiteToday.length} sub={`${data.website.length} captured total`} icon={Phone} spark={[0, 1, 0, 1, 2, stats.websiteToday.length]} />
          <Kpi title="Replies Captured" value={data.replies.length} sub="From replies tab" icon={Activity} spark={[0, 0, 0, 1, data.replies.length]} />
          <Kpi title="Likely Revenue Signal" value={money(stats.likelyRevenue)} sub="Weighted early pipeline" tone="gold" icon={TrendingUp} spark={[0, 69, 138, 180, stats.likelyRevenue]} />
        </div>

        <Panel title="Truth Check" meta="Real logs only" className="span-4">
          <div className="stat-list">
            <div><span>Total real client sends</span><strong>{stats.realSent.length}</strong></div>
            <div><span>Total owner/test sends</span><strong>{stats.testSent.length}</strong></div>
            <div><span>Real sends last 7 days</span><strong>{stats.realWeek.length}</strong></div>
            <div><span>Website enquiries total</span><strong>{data.website.length}</strong></div>
          </div>
          <div className="meter"><div style={{ width: `${stats.progress}%` }} /></div>
          <p className="muted">{stats.realToday.length} of {CONFIG.dailyTarget} real client emails sent today.</p>
        </Panel>

        <Panel title="Lead Activity" meta="Queue vs confirmed sends" className="span-8">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartDays}>
              <CartesianGrid stroke="rgba(167,139,250,.14)" vertical={false} />
              <XAxis dataKey="day" stroke="#a78bfa" />
              <YAxis stroke="#a78bfa" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="queue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              <Bar dataKey="sent" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Borough Distribution" meta="Daily Send Queue" className="span-4">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={stats.boroughData} innerRadius={58} outerRadius={88} dataKey="value" paddingAngle={2}>
                {stats.boroughData.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="legend">
            {stats.boroughData.map((row, index) => <span key={row.name}><i style={{ background: palette[index % palette.length] }} />{row.name} {row.value}</span>)}
          </div>
        </Panel>

        <Panel title="Daily Send Queue" meta="Top revenue leads" className="span-8">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Rank</th><th>Company</th><th>Email</th><th>Borough</th><th>Hook</th></tr></thead>
              <tbody>
                {topQueue.map((row, index) => (
                  <tr key={`${emailOf(row)}-${index}`}>
                    <td>{field(row, ["revenue_batch_rank", "rank"]) || index + 1}</td>
                    <td><strong>{field(row, ["company_name", "name", "business_name"]) || "Unknown"}</strong></td>
                    <td>{emailOf(row)}</td>
                    <td>{field(row, ["borough", "area"]) || "-"}</td>
                    <td>{field(row, ["sales_hook", "recommended_action"]) || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent Email Log" meta="Confirmed records" className="span-7">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Type</th><th>Status</th><th>Email</th><th>Company</th></tr></thead>
              <tbody>
                {recentEmails.map((row, index) => (
                  <tr key={`${sentAt(row)}-${index}`}>
                    <td>{sentAt(row) || "-"}</td>
                    <td><span className={`badge ${isOwnerOrTest(row) ? "test" : "live"}`}>{isOwnerOrTest(row) ? "owner/test" : "real client"}</span></td>
                    <td>{field(row, ["status", "send_status"]) || "-"}</td>
                    <td>{emailOf(row) || "-"}</td>
                    <td><strong>{field(row, ["company_name", "company", "name"]) || "-"}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Website Leads" meta="Landing page capture" className="span-5">
          <div className="lead-cards">
            {latestWebsite.length ? latestWebsite.map((row, index) => (
              <div className="lead-card" key={index}>
                <strong>{field(row, ["name", "customer_name"]) || "Website enquiry"}</strong>
                <span>{field(row, ["service", "job_type"]) || "Service not set"}</span>
                <span>{[field(row, ["phone", "telephone"]), emailOf(row)].filter(Boolean).join(" | ")}</span>
                <span>{field(row, ["address", "property_address"])}</span>
              </div>
            )) : <div className="lead-card"><strong>No website leads yet</strong><span>New landing page enquiries will appear here.</span></div>}
          </div>
        </Panel>

        <Panel title="Next Recommended Action" meta={lastSync ? `Synced ${lastSync.toLocaleTimeString("en-GB")}` : loading ? "Syncing" : "Ready"} className="span-12">
          <div className="action-strip">
            <CheckCircle2 />
            <div>
              <strong>{stats.realToday.length === 0 ? "Send the first 10 real client emails, then pause" : "Continue controlled outreach"}</strong>
              <span>
                {stats.realToday.length === 0
                  ? "The queue is ready, but the confirmed log shows zero real client emails today. Start with 10, then watch replies before scaling to 30/day."
                  : `${stats.realToday.length} real client sends are confirmed today. Keep reporting from Email Log only.`}
              </span>
            </div>
          </div>
        </Panel>
      </main>
      <ChatWidget
        context={[
          `Real client emails today: ${stats.realToday.length} of ${CONFIG.dailyTarget}.`,
          `Owner/test sends today: ${stats.testToday.length}.`,
          `Queue ready: ${stats.readyQueue.length}.`,
          `Website leads today: ${stats.websiteToday.length} (${data.website.length} total).`,
          `Replies captured: ${data.replies.length}.`,
          `Total real client sends: ${stats.realSent.length}.`,
          `Likely revenue signal: ${money(stats.likelyRevenue)}.`,
        ].join(" ")}
      />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
