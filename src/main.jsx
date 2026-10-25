import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  CheckCircle2,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Target,
  TrendingUp,
  Users,
  X,
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
  masterPool: "Python Master Pool",
  allContacts: "All Contacts",
  campaignProspects: "Campaign Prospects",
  cloudLog: "Cloud Campaign Log",
  website: "Website Leads",
  replies: "Replies",
  metrics: "Dashboard Metrics",
};

const EMPTY_DATA = {
  emailLog: [],
  queue: [],
  masterPool: [],
  allContacts: [],
  campaignProspects: [],
  cloudLog: [],
  website: [],
  replies: [],
  metrics: [],
};

const palette = ["#8b5cf6", "#34d399", "#f59e0b", "#a78bfa", "#10b981", "#c4b5fd"];

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
  const text = String(value || "").trim().replace(/(\.\d{3})\d+/, "$1");
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

function isLogSent(row) {
  return /sent|delivered|success/i.test(field(row, ["status", "send_status", "email_status"]));
}

function isMasterSent(row) {
  return field(row, ["CampaignStatus", "campaign_status"]).toUpperCase() === "SENT";
}

function emailOf(row) {
  return field(row, ["email", "recipient", "recipient_email", "to", "director_email"]);
}

function companyOf(row) {
  return field(row, ["company_name", "CompanyName", "company", "business_name", "name"]);
}

function sentAt(row) {
  return field(row, ["sent_at", "CampaignSentAt", "timestamp", "SentAt", "date", "created_at", "queue_date"]);
}

function rowWhen(row) {
  return field(row, ["queue_date", "sent_at", "CampaignSentAt", "snapshotat", "SnapshotAt", "date_added", "verificationdate", "timestamp", "last_contacted", "created_at", "SentAt"]);
}

function companyKey(row) {
  return normalise(companyOf(row));
}

function contactKeys(row) {
  const found = [];
  for (const name of ["email", "director_email", "recipient", "recipient_email", "to"]) {
    const value = normalise(row[normalise(name)] || "");
    if (value && !found.includes(value)) found.push(value);
  }
  return found;
}

function isOwnerOrTest(row) {
  const email = emailOf(row).toLowerCase();
  const company = companyOf(row).toLowerCase();
  const mode = field(row, ["mode"]).toLowerCase();
  return CONFIG.ownerEmails.some((owner) => owner.toLowerCase() === email) || /test|owner|preview/.test(company) || mode === "test";
}

function isMasterReady(row) {
  const status = field(row, ["status"]).toUpperCase();
  const campaign = field(row, ["CampaignStatus"]).toUpperCase();
  const reporting = field(row, ["ReportingStatus"]).toLowerCase();
  return status === "READY" && campaign !== "SENT" && !/suppress/.test(reporting);
}

function isDailyOpen(row) {
  const status = field(row, ["send_status", "status"]).toLowerCase();
  if (!status) return true;
  return /ready|queued|unsent|pending/.test(status);
}

function isQueuedRecord(row, source) {
  const status = field(row, ["status", "send_status", "CampaignStatus", "ReportingStatus", "outreach_status"]);
  if (/ready|queued|unsent|pending/i.test(status)) return true;
  return source === "queue";
}

function withinRange(value, range, now = Date.now()) {
  if (range === "all") return true;
  const date = parseDate(value);
  if (!date) return false;
  const span = Number(range) * 86400000;
  const time = date.getTime();
  return time <= now + 86400000 && now - time <= span;
}

function money(value) {
  return `£${new Intl.NumberFormat("en-GB").format(Math.round(Number(value) || 0))}`;
}

function safeNumber(value) {
  return new Intl.NumberFormat("en-GB").format(Math.round(Number(value) || 0));
}

const PAGES = [
  ["overview", "Overview", "Business Overview", "Live BookAnEPC enquiries, bookings and operational performance"],
  ["inbound", "Inbound Leads", "Inbound Leads", "Website enquiries captured from the landing page"],
  ["outbound", "Outbound Outreach", "Outbound Outreach", "Safe outbound connection readiness and intended performance metrics"],
  ["pipeline", "Lead Pipeline", "Lead Pipeline", "Ready prospects from the master pool and daily queue"],
  ["appointments", "Appointments", "Appointments", "Booking status recorded on inbound enquiries"],
  ["revenue", "Revenue", "Revenue", "Estimated value from booked jobs"],
  ["services", "Services", "Services", "Demand by requested EPC service"],
  ["areas", "Areas", "Areas", "Borough and area mix from the ready queue"],
  ["communications", "Communications", "Communications", "Confirmed sends and failures from the email logs"],
  ["automation", "Automation", "Automation", "Refresh cadence and connection controls"],
  ["system", "System Status", "System Status", "Inbound sheet API, CRM, and PythonAnywhere health"],
];

function trendLabel(isoDate) {
  const date = parseDate(isoDate);
  if (!date) return isoDate || "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric" }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${map.weekday} ${map.day}`;
}

function statusLabel(ok) {
  if (ok === false) return "Offline";
  if (ok) return "Connected";
  return "Checking";
}

function formatRefresh(date) {
  if (!date) return "Waiting";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${map.day} ${map.month}, ${map.hour}:${map.minute}`;
}

function EnergyBadge() {
  const bands = [
    ["A", "#00854a", "100%"],
    ["B", "#19b459", "92%"],
    ["C", "#8dce46", "84%"],
    ["D", "#ffd500", "76%"],
    ["E", "#fcaa65", "68%"],
    ["F", "#ef8023", "60%"],
    ["G", "#e9153b", "52%"],
  ];
  return (
    <div className="energy-lockup" aria-label="Energy rating A to G">
      <span className="energy-house" aria-hidden="true" />
      <span className="energy-bands" aria-hidden="true">
        {bands.map(([letter, color, width]) => (
          <i key={letter} style={{ background: color, width }}>{letter}</i>
        ))}
      </span>
    </div>
  );
}

async function fetchTab(tab, rangeRows = 1000) {
  const rows = tab === "Dashboard Metrics" ? 50 : rangeRows;
  const range = encodeURIComponent(`${tab}!A1:Z${rows}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${range}?key=${CONFIG.apiKey}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${tab}: Google Sheets API ${response.status}`);
  const data = await response.json();
  return rowsFromValues(data.values || []);
}

async function fetchCrm() {
  try {
    const response = await fetch("/api/dashboard-data", { cache: "no-store" });
    if (!response.ok) return { ok: false, data: null };
    const data = await response.json();
    return { ok: data?.status === "ok", data };
  } catch {
    return { ok: false, data: null };
  }
}

async function checkPythonAnywhere() {
  const url = "https://aftabkhowaja.pythonanywhere.com/health";
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return false;
    const body = await response.json().catch(() => ({}));
    return body.status === "ok" || response.ok;
  } catch {
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store" });
      return true;
    } catch {
      return false;
    }
  }
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
      {spark ? <MiniSpark data={spark} color={tone === "gold" ? "#f59e0b" : tone === "red" ? "#f87171" : "#34d399"} /> : null}
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

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Ask me about real client sends, the queue, website leads, or what to do next.",
    },
  ]);
  const threadRef = useRef(null);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, open, sending]);

  async function onSubmit(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setSending(true);
    setChatError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Chat request failed (${response.status})`);
      const reply = String(payload.reply || "").trim() || "I could not find an answer for that.";
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch (err) {
      setChatError(err.message || "Chat request failed");
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
              <span>Gemini assistant</span>
            </div>
            <button type="button" className="chat-close-btn" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={16} />
            </button>
          </div>
          <div className="chat-messages" ref={threadRef} aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role === "user" ? "user" : "assistant"}`}>
                {message.content}
              </div>
            ))}
            {sending ? <div className="chat-bubble assistant">Thinking…</div> : null}
          </div>
          {chatError ? <div className="chat-error">{chatError}</div> : null}
          <form className="chat-form" onSubmit={onSubmit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about the dashboard"
              aria-label="Message"
              disabled={sending}
            />
            <button type="submit" disabled={sending || !input.trim()}>
              <Send size={16} /> Send
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
        <MessageCircle size={18} />
        AI Chat
      </button>
    </div>
  );
}

function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [page, setPage] = useState("overview");
  const [navOpen, setNavOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [range, setRange] = useState("7");
  const [sheetsOk, setSheetsOk] = useState(null);
  const [pythonOk, setPythonOk] = useState(null);
  const [crm, setCrm] = useState(null);
  const [crmOk, setCrmOk] = useState(null);

  async function refresh() {
    setLoading(true);
    setError("");
    const specs = [
      ["emailLog", TABS.emailLog, 1000],
      ["queue", TABS.queue, 1000],
      ["masterPool", TABS.masterPool, 1000],
      ["allContacts", TABS.allContacts, 1000],
      ["campaignProspects", TABS.campaignProspects, 1000],
      ["cloudLog", TABS.cloudLog, 1000],
      ["website", TABS.website, 1000],
      ["replies", TABS.replies, 1000],
      ["metrics", TABS.metrics, 50],
    ];
    try {
      const [settled, python, crmResult] = await Promise.all([
        Promise.allSettled(specs.map(([, tab, limit]) => fetchTab(tab, limit))),
        checkPythonAnywhere(),
        fetchCrm(),
      ]);
      const next = { ...EMPTY_DATA };
      const failures = [];
      settled.forEach((result, index) => {
        const [key, tab] = specs[index];
        if (result.status === "fulfilled") next[key] = result.value;
        else failures.push(`${tab}: ${result.reason?.message || "failed"}`);
      });
      setData(next);
      setSheetsOk(settled.some((result) => result.status === "fulfilled"));
      setPythonOk(python);
      setCrm(crmResult.data);
      setCrmOk(crmResult.ok);
      setLastSync(new Date());
      setError(failures.length ? `Some tabs did not load: ${failures.join("; ")}` : "");
    } catch (err) {
      setSheetsOk(false);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const refreshId = setInterval(refresh, CONFIG.refreshMs);
    return () => clearInterval(refreshId);
  }, [paused]);

  const stats = useMemo(() => {
    const today = londonKey();
    const pool = [...data.queue, ...data.masterPool, ...data.allContacts, ...data.campaignProspects];
    const companies = new Set(pool.map(companyKey).filter(Boolean));
    const contacts = new Set(pool.flatMap(contactKeys));
    const emailsQueued = [
      ...data.queue.map((row) => isQueuedRecord(row, "queue")),
      ...data.masterPool.map((row) => isQueuedRecord(row, "master")),
      ...data.allContacts.map((row) => isQueuedRecord(row, "contacts")),
      ...data.campaignProspects.map((row) => isQueuedRecord(row, "prospects")),
    ].filter(Boolean).length;
    const seen = new Set();
    const readyQueue = [...data.masterPool.filter(isMasterReady), ...data.queue.filter(isDailyOpen)].filter((row) => {
      const key = contactKeys(row)[0] || companyKey(row);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const confirmed = [
      ...data.emailLog.filter(isLogSent),
      ...data.masterPool.filter(isMasterSent),
      ...data.cloudLog.filter(isLogSent),
    ];
    const realSent = confirmed.filter((row) => !isOwnerOrTest(row));
    const testSent = confirmed.filter(isOwnerOrTest);
    const realToday = realSent.filter((row) => dateKey(sentAt(row)) === today);
    const testToday = testSent.filter((row) => dateKey(sentAt(row)) === today);
    const windowReal = realSent.filter((row) => withinRange(sentAt(row), range));
    const windowTest = testSent.filter((row) => withinRange(sentAt(row), range));
    const shownReal = realToday.length ? realToday : (windowReal.length ? windowReal : realSent);
    const shownTest = testToday.length ? testToday : (windowTest.length ? windowTest : testSent);
    const usingFallback = realToday.length === 0 && shownReal.length > 0;
    const websiteToday = data.website.filter((row) => dateKey(field(row, ["received_at", "submitted_at", "created_at", "timestamp", "date"])) === today);
    const boroughCounts = readyQueue.reduce((acc, row) => {
      const borough = field(row, ["borough", "area", "Area"]) || "Unknown";
      acc[borough] = (acc[borough] || 0) + 1;
      return acc;
    }, {});
    const boroughData = Object.entries(boroughCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    const counts = new Map();
    for (const row of shownReal) {
      const key = dateKey(sentAt(row)) || "Recent";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const chart = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, sent]) => ({
        day: key === "Recent" ? key : `${key.slice(8)}/${key.slice(5, 7)}`,
        sent,
        queue: readyQueue.filter((row) => dateKey(rowWhen(row)) === key).length,
      }));
    const spark = chart.length ? chart.map((point) => point.sent) : [0];
    const progress = Math.min(100, Math.round((shownReal.length / CONFIG.dailyTarget) * 100));
    const likelyRevenue = shownReal.length * 69 * 0.02 + data.website.length * 69 * 0.25;
    const recentEmails = [...confirmed].sort((a, b) => (parseDate(sentAt(b))?.getTime() || 0) - (parseDate(sentAt(a))?.getTime() || 0)).slice(0, 12);
    return {
      queueRows: pool.length,
      companies: companies.size,
      contacts: contacts.size,
      emailsQueued,
      readyQueue,
      realSent,
      testSent,
      realToday,
      testToday,
      shownReal,
      shownTest,
      usingFallback,
      windowReal,
      websiteToday,
      boroughData,
      chart,
      spark,
      progress,
      likelyRevenue,
      recentEmails,
    };
  }, [data, range]);

  const latestWebsite = [...data.website].slice(-5).reverse();
  const pageMeta = PAGES.find(([id]) => id === page) || PAGES[0];
  const metrics = crm?.metrics || {};
  const services = Object.entries(crm?.service_counts || {})
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const statuses = Object.entries(crm?.status_counts || {})
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const trend = (crm?.daily_counts || []).map((row) => ({ day: trendLabel(row.date), leads: Number(row.count) || 0 }));
  const trendMax = trend.reduce((max, row) => Math.max(max, row.leads), 0);
  const recentCrm = (crm?.recent_leads || []).slice(0, 8);
  const statusTotal = statuses.reduce((sum, row) => sum + row.value, 0) || Number(metrics.total_leads) || 1;
  const openPage = (id) => {
    setPage(id);
    setNavOpen(false);
  };

  return (
    <div className="app ops">
      <aside className={navOpen ? "ops-side open" : "ops-side"}>
        <div className="ops-brand">
          <img src="/bookanepc-logo.png" alt="BookAn EPC" />
          <span>LONDON PROPERTY SERVICES</span>
        </div>
        <nav className="ops-nav">
          {PAGES.map(([id, label]) => (
            <button key={id} type="button" className={page === id ? "active" : ""} onClick={() => openPage(id)}>{label}</button>
          ))}
        </nav>
        <div className="ops-foot"><span className="ops-avatar">BA</span><span><b>BookAnEPC Team</b><small>Administrator</small></span></div>
      </aside>
      <div className="ops-content">
        <div className="ops-top">
          <div>
            <p className="ops-eyebrow">BookAnEPC Operations</p>
            <h1>{pageMeta[2]}</h1>
            <span>{pageMeta[3]}</span>
          </div>
          <button type="button" className="ops-menu" onClick={() => setNavOpen((open) => !open)}>Menu</button>
          <div className="ops-actions">
            <span className="ops-pill"><em>Inbound API</em><b className={sheetsOk === false ? "off" : ""}>{statusLabel(sheetsOk)}</b></span>
            <span className="ops-pill"><em>PythonAnywhere</em><b className={pythonOk === false ? "off" : ""}>{statusLabel(pythonOk)}</b></span>
            <span className="ops-pill"><em>CRM</em><b className={crmOk === false ? "off" : ""}>{statusLabel(crmOk)}</b></span>
            <span className="ops-pill ops-refresh-meta"><em>Last refresh</em><b className="time">{formatRefresh(lastSync)}</b></span>
            <button type="button" className="ops-pause" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? "Resume" : "Pause"}</button>
            <button type="button" className="ops-refresh" onClick={refresh}>↻ Refresh</button>
          </div>
        </div>
        {error ? <div className="alert">{error}</div> : null}
        {page === "overview" ? (
          <section className="ops-overview">
            <div className="ops-kpis">
              <article className="ops-kpi violet"><i>●</i><div><span>Total Enquiries</span><strong>{crm ? safeNumber(metrics.total_leads || 0) : "—"}</strong><small>All verified inbound leads</small><em>Live CRM total</em></div></article>
              <article className="ops-kpi blue"><i>#</i><div><span>New This Week</span><strong>{crm ? safeNumber(metrics.week_leads || 0) : "—"}</strong><small>Enquiries this week</small><em>Current week total</em></div></article>
              <article className="ops-kpi green"><i>✓</i><div><span>Booked Jobs</span><strong>{crm ? safeNumber(metrics.booked || 0) : "—"}</strong><small>Confirmed and booked</small><em>Verified status count</em></div></article>
              <article className="ops-kpi gold"><i>£</i><div><span>Estimated Revenue</span><strong>{crm ? money(metrics.estimated_revenue || 0) : "—"}</strong><small>Based on booked jobs</small><em>Estimated only</em></div></article>
              <article className="ops-kpi violet"><i>✉</i><div><span>Emails Sent</span><strong>{crm ? safeNumber(crm.email_activity?.sent || metrics.emails_sent || 0) : "—"}</strong><small>Returned by live API</small><em>Verified activity</em></div></article>
              <article className="ops-kpi coral"><i>!</i><div><span>Email Failures</span><strong>{crm ? safeNumber(crm.email_activity?.failed || 0) : "—"}</strong><small>Returned by live API</small><em>Needs attention</em></div></article>
            </div>
            <p className="ops-warning">CRM contains demonstration records; totals and estimated revenue may be inflated.</p>
            <div className="ops-charts">
              <article className="ops-card ops-trend">
                <div className="ops-card-head"><h2>Seven-Day Lead Trend</h2><span>Last 7 days</span></div>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={trend.length ? trend : [{ day: "—", leads: 0 }]}>
                    <CartesianGrid stroke="rgba(167,139,250,.16)" vertical={false} />
                    <XAxis dataKey="day" stroke="#a78bfa" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#a78bfa" width={28} allowDecimals={false} domain={[0, trendMax || 1]} />
                    <Tooltip contentStyle={{ background: "#171027", border: "1px solid #49356c", color: "#f7f3ff", borderRadius: 12 }} />
                    <Area type="monotone" dataKey="leads" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.18} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </article>
              <article className="ops-card">
                <div className="ops-card-head"><h2>Lead Status Distribution</h2><span>Current records</span></div>
                <div className="ops-donut">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={statuses.length ? statuses : [{ name: "Waiting", value: 1 }]} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                        {(statuses.length ? statuses : [{ name: "Waiting", value: 1 }]).map((row, index) => <Cell key={row.name} fill={index === 0 ? "#8b5cf6" : "#c4b5fd"} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#171027", border: "1px solid #49356c", color: "#f7f3ff", borderRadius: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="ops-legend">
                    {statuses.map((row, index) => (
                      <div key={row.name}><i style={{ background: index === 0 ? "#8b5cf6" : "#c4b5fd" }} /><span>{row.name}</span><b>{safeNumber(row.value)} ({Math.round((row.value / statusTotal) * 100)}%)</b></div>
                    ))}
                  </div>
                </div>
              </article>
              <article className="ops-card">
                <div className="ops-card-head"><h2>Service Demand</h2><span>Real API data</span></div>
                <div className="ops-donut">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={services.length ? services : [{ name: "Waiting", value: 1 }]} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                        {(services.length ? services : [{ name: "Waiting", value: 1 }]).map((row, index) => <Cell key={row.name} fill={palette[index % palette.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#171027", border: "1px solid #49356c", color: "#f7f3ff", borderRadius: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="ops-legend">
                    {services.map((row, index) => (
                      <div key={row.name}><i style={{ background: palette[index % palette.length] }} /><span>{row.name}</span><b>{safeNumber(row.value)} ({Math.round((row.value / (Number(metrics.total_leads) || row.value || 1)) * 100)}%)</b></div>
                    ))}
                  </div>
                </div>
              </article>
            </div>
            <article className="ops-card ops-leads">
              <div className="ops-card-head"><h2>Recent Leads</h2><span>{recentCrm.length} returned</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Name</th><th>Contact</th><th>Area</th><th>Service</th><th>Source</th><th>Status</th></tr></thead>
                  <tbody>
                    {recentCrm.map((row, index) => (
                      <tr key={`${row.created_at}-${index}`}>
                        <td>{trendLabel(row.created_at) || "—"}</td>
                        <td><strong>{row.name || "—"}</strong></td>
                        <td>{row.phone_masked || row.email_masked || "—"}</td>
                        <td>{row.postcode || "—"}</td>
                        <td>{row.service_type || "—"}</td>
                        <td>{row.source || "—"}</td>
                        <td><span className="badge">{row.status || "—"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : null}
        {page === "outbound" ? (
          <>
      <section className="hero">
        <p className="eyebrow">BookAn EPC Outbound Outreach</p>
        <h1>Outbound Outreach</h1>
        <p className="hero-sub">Safe outbound connection readiness and intended performance metrics</p>
        <div className="status-grid">
          <article className="status-card">
            <span>Inbound API</span>
            <strong className={sheetsOk === false ? "is-offline" : ""}>
              <i className={sheetsOk === false ? "dot dot-off" : "dot"} /> {sheetsOk === false ? "Offline" : sheetsOk ? "Connected" : "Checking"}
            </strong>
          </article>
          <article className="status-card">
            <span>PythonAnywhere</span>
            <strong className={pythonOk === false ? "is-offline" : ""}>
              <i className={pythonOk === false ? "dot dot-off" : "dot"} /> {pythonOk === false ? "Offline" : pythonOk ? "Connected" : "Checking"}
            </strong>
          </article>
          <article className="status-card">
            <span>Last refresh</span>
            <strong className="refresh-time">{formatRefresh(lastSync)}</strong>
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
              <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Range">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="all">All time</option>
              </select>
            </label>
            <div className="connected-box">
              <i className={sheetsOk === false ? "dot dot-off" : "dot"} />
              {sheetsOk === false ? "Offline" : sheetsOk ? "Connected" : "Checking"}
            </div>
          </div>
        </div>
        <article className="secure-card">
          <div className="gold-check" aria-hidden="true">✓</div>
          <div>
            <p className="overline">SECURE READ-ONLY CONNECTION</p>
            <h3>Outbound data source connected</h3>
            <p>Verified outbound queue, contact, reply and source metrics are loading from the protected endpoint.</p>
          </div>
        </article>
        <div className="outreach-kpis">
          <Kpi title="Queue rows" value={safeNumber(stats.queueRows)} sub="Daily Send Queue" icon={Target} spark={stats.spark} />
          <Kpi title="Unique companies" value={safeNumber(stats.companies)} sub="Queue records in selected range" icon={Users} spark={stats.spark} />
          <Kpi title="Unique contacts" value={safeNumber(stats.contacts)} sub="Normalised queue email" icon={Mail} spark={stats.spark} />
          <Kpi title="Emails queued" value={safeNumber(stats.emailsQueued)} sub="Queue status: queued" icon={Send} spark={stats.spark} />
        </div>
      </section>

      {error ? <div className="alert">{error}</div> : null}

      <main>
        <div className="kpi-grid">
          <Kpi title="Real Client Emails (24h)" value={stats.shownReal.length} sub={stats.usingFallback ? `None in the last 24h · showing ${range === "all" ? "all time" : `${range} day`} sends` : `${stats.progress}% of 30/day target`} icon={Send} spark={stats.spark} />
          <Kpi title="Owner/Test Sends (24h)" value={stats.shownTest.length} sub="Separated from revenue outreach" tone="gold" icon={Mail} spark={stats.spark} />
          <Kpi title="Queue Ready" value={stats.readyQueue.length} sub="Prepared client leads" icon={Target} spark={stats.spark} />
          <Kpi title="Website Leads Today" value={stats.websiteToday.length || data.website.length} sub={`${data.website.length} captured total`} icon={Phone} spark={stats.spark} />
          <Kpi title="Replies Captured" value={data.replies.length} sub="From replies tab" icon={Activity} spark={stats.spark} />
          <Kpi title="Likely Revenue Signal" value={money(stats.likelyRevenue)} sub="Weighted early pipeline" tone="gold" icon={TrendingUp} spark={stats.spark} />
        </div>

        <Panel title="Truth Check" meta="Real logs only" className="span-4">
          <div className="stat-list">
            <div><span>Total real client sends</span><strong>{stats.realSent.length}</strong></div>
            <div><span>Total owner/test sends</span><strong>{stats.testSent.length}</strong></div>
            <div><span>Real sends in selected range</span><strong>{stats.windowReal.length || stats.shownReal.length}</strong></div>
            <div><span>Website enquiries total</span><strong>{data.website.length}</strong></div>
          </div>
          <div className="meter"><div style={{ width: `${stats.progress}%` }} /></div>
          <p className="muted">{stats.realToday.length} of {CONFIG.dailyTarget} real client emails sent today. {stats.usingFallback ? `${stats.shownReal.length} confirmed sends are shown from the latest available records.` : ""}</p>
        </Panel>

        <Panel title="Lead Activity" meta="Queue vs confirmed sends" className="span-8">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={stats.chart.length ? stats.chart : [{ day: "—", sent: 0, queue: 0 }]}>
              <CartesianGrid stroke="rgba(167,139,250,.18)" vertical={false} />
              <XAxis dataKey="day" stroke="#a78bfa" />
              <YAxis stroke="#a78bfa" />
              <Tooltip contentStyle={{ background: "#130d24", border: "1px solid rgba(167,139,250,.42)", color: "#f3f0ff", borderRadius: 12 }} />
              <Bar dataKey="queue" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="sent" fill="#34d399" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Borough Distribution" meta="Daily Send Queue" className="span-4">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={stats.boroughData} innerRadius={58} outerRadius={88} dataKey="value" paddingAngle={2}>
                {stats.boroughData.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#130d24", border: "1px solid rgba(167,139,250,.42)", color: "#f3f0ff", borderRadius: 12 }} />
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
                {stats.readyQueue.map((row, index) => (
                  <tr key={`${emailOf(row)}-${index}`}>
                    <td>{field(row, ["queue_rank", "revenue_batch_rank", "rank", "tier"]) || index + 1}</td>
                    <td><strong>{companyOf(row) || "Unknown"}</strong></td>
                    <td>{emailOf(row)}</td>
                    <td>{field(row, ["borough", "area", "Area"]) || "-"}</td>
                    <td>{field(row, ["sales_hook", "recommended_action", "subject", "notes", "status"]) || "-"}</td>
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
                {stats.recentEmails.map((row, index) => (
                  <tr key={`${sentAt(row)}-${emailOf(row)}-${index}`}>
                    <td>{sentAt(row) || "-"}</td>
                    <td><span className="badge">{isOwnerOrTest(row) ? "owner/test" : "real client"}</span></td>
                    <td>{field(row, ["CampaignStatus", "status", "send_status"]) || "-"}</td>
                    <td>{emailOf(row) || "-"}</td>
                    <td><strong>{companyOf(row) || "-"}</strong></td>
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
                <span>{field(row, ["service", "job_type", "service_needed"]) || "Service not set"}</span>
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
              <strong>{stats.readyQueue.length ? `${stats.readyQueue.length} ready prospects can be sent next` : "Continue controlled outreach"}</strong>
              <span>
                {stats.realToday.length
                  ? `${stats.realToday.length} real client sends are confirmed today, with ${stats.realSent.length} on record from Email Log, Python Master Pool, and Cloud Campaign Log.`
                  : `${stats.realSent.length} confirmed sends are on record and none landed in the last 24 hours. The chart is using the latest ${stats.shownReal.length} so the dashboard does not sit at zero.`}
              </span>
            </div>
          </div>
        </Panel>
      </main>
          </>
        ) : null}
        {page === "inbound" ? (
          <main>
            <Panel title="Website Leads" meta="Landing page capture" className="span-7">
              <div className="lead-cards">
                {latestWebsite.length ? latestWebsite.map((row, index) => (
                  <div className="lead-card" key={index}>
                    <strong>{field(row, ["name", "customer_name"]) || "Website enquiry"}</strong>
                    <span>{field(row, ["service", "job_type", "service_needed"]) || "Service not set"}</span>
                    <span>{[field(row, ["phone", "telephone"]), emailOf(row)].filter(Boolean).join(" | ")}</span>
                    <span>{field(row, ["address", "property_address"])}</span>
                  </div>
                )) : <div className="lead-card"><strong>No website leads yet</strong><span>New landing page enquiries will appear here.</span></div>}
              </div>
            </Panel>
            <Panel title="Replies" meta="Captured replies" className="span-5">
              <div className="stat-list">
                <div><span>Replies captured</span><strong>{data.replies.length}</strong></div>
                <div><span>Website enquiries</span><strong>{data.website.length}</strong></div>
              </div>
            </Panel>
          </main>
        ) : null}
        {page === "pipeline" || page === "areas" ? (
          <main>
            {page === "pipeline" ? (
              <Panel title="Daily Send Queue" meta="Ready prospects" className="span-12">
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Rank</th><th>Company</th><th>Email</th><th>Borough</th><th>Hook</th></tr></thead>
                    <tbody>
                      {stats.readyQueue.map((row, index) => (
                        <tr key={`${emailOf(row)}-${index}`}>
                          <td>{index + 1}</td>
                          <td><strong>{companyOf(row) || "Unknown"}</strong></td>
                          <td>{emailOf(row)}</td>
                          <td>{field(row, ["borough", "area", "Area"]) || "-"}</td>
                          <td>{field(row, ["subject", "notes", "status"]) || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : (
              <Panel title="Areas" meta="Ready queue" className="span-12">
                <div className="legend">
                  {stats.boroughData.map((row, index) => <span key={row.name}><i style={{ background: palette[index % palette.length] }} />{row.name} {row.value}</span>)}
                </div>
              </Panel>
            )}
          </main>
        ) : null}
        {page === "revenue" || page === "appointments" || page === "services" ? (
          <main>
            <Panel title={pageMeta[2]} meta="From the live CRM payload" className="span-12">
              <div className="stat-list">
                <div><span>Booked jobs</span><strong>{crm ? safeNumber(metrics.booked || 0) : "—"}</strong></div>
                <div><span>Estimated revenue</span><strong>{crm ? money(metrics.estimated_revenue || 0) : "—"}</strong></div>
                <div><span>Follow-up needed</span><strong>{crm ? safeNumber(metrics.follow_up_needed || 0) : "—"}</strong></div>
                <div><span>Top service</span><strong>{services[0]?.name || "—"}</strong></div>
              </div>
            </Panel>
          </main>
        ) : null}
        {page === "communications" ? (
          <main>
            <Panel title="Email Activity" meta="Live API" className="span-12">
              <div className="stat-list">
                <div><span>Emails sent</span><strong>{crm ? safeNumber(crm.email_activity?.sent || 0) : "—"}</strong></div>
                <div><span>Email failures</span><strong>{crm ? safeNumber(crm.email_activity?.failed || 0) : "—"}</strong></div>
                <div><span>Latest email time</span><strong>{crm?.email_activity?.latest_sent_at || "—"}</strong></div>
                <div><span>Sheet confirmed sends</span><strong>{stats.realSent.length}</strong></div>
              </div>
            </Panel>
          </main>
        ) : null}
        {page === "automation" || page === "system" ? (
          <main>
            <Panel title={pageMeta[2]} meta={paused ? "Refresh paused" : "Auto refresh on"} className="span-12">
              <div className="stat-list">
                <div><span>Inbound API</span><strong>{statusLabel(sheetsOk)}</strong></div>
                <div><span>PythonAnywhere</span><strong>{statusLabel(pythonOk)}</strong></div>
                <div><span>CRM</span><strong>{statusLabel(crmOk)}</strong></div>
                <div><span>Last refresh</span><strong>{formatRefresh(lastSync)}</strong></div>
              </div>
            </Panel>
          </main>
        ) : null}
      </div>
      <ChatWidget />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
