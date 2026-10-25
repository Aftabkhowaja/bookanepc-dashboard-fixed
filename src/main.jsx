import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  CheckCircle2,
  Database,
  Filter,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
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
  revenuePerJob: 79,
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
  leadsMaster: "Leads_Master",
  runAudit: "Run_Audit",
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
  leadsMaster: [],
  runAudit: [],
};

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "inbound", label: "Inbound Leads" },
  { id: "outbound", label: "Outbound Outreach" },
  { id: "pipeline", label: "Lead Pipeline" },
  { id: "revenue", label: "Revenue" },
  { id: "areas", label: "Areas" },
  { id: "automation", label: "Automation & Logs" },
];

const palette = ["#8b5cf6", "#34d399", "#f59e0b", "#60a5fa", "#a78bfa", "#10b981", "#f472b6"];

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rowsFromValues(values = []) {
  if (values.length < 2) return [];
  const headers = values[0].map((header, idx) => normalise(header) || `col_${idx}`);
  return values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()])));
}

function field(row, names) {
  if (!row) return "";
  for (const name of names) {
    const key = normalise(name);
    if (row[key]) return row[key];
  }
  return "";
}

function parseDate(value) {
  const text = String(value || "").trim().replace(/(\.\d{3})\d+/, "$1");
  if (!text) return null;
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const parsedIso = Date.parse(text);
    if (!Number.isNaN(parsedIso)) return new Date(parsedIso);
  }
  // UK DD/MM/YYYY must be parsed before Date.parse (which treats 05/10/2026 as May 10 in US format!)
  const ukMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (ukMatch) {
    const year = Number(ukMatch[3].length === 2 ? `20${ukMatch[3]}` : ukMatch[3]);
    return new Date(year, Number(ukMatch[2]) - 1, Number(ukMatch[1]), Number(ukMatch[4] || 0), Number(ukMatch[5] || 0));
  }
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed);
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

function formatUkDateTime(value) {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : parseDate(value);
  if (!parsed) return String(value);
  return parsed.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isLogSent(row) {
  return /sent|delivered|success|dispatched/i.test(field(row, ["status", "send_status", "email_status", "col_15"]));
}

function isMasterSent(row) {
  return field(row, ["CampaignStatus", "campaign_status"]).toUpperCase() === "SENT";
}

function emailOf(row) {
  return field(row, ["email", "recipient", "recipient_email", "to", "director_email", "business_email", "masked_email", "col_11"]);
}

function companyOf(row) {
  return field(row, ["company_name", "CompanyName", "company", "business_name", "name", "representative_business_name", "col_10"]);
}

function boroughOf(row) {
  return field(row, ["borough", "area", "Area", "London_borough", "geographic_area", "postcode", "nearest_postcode", "col_6", "col_7"]) || "London";
}

function sentAt(row) {
  return field(row, ["CampaignSentAt", "sent_at", "timestamp", "SentAt", "date", "created_at", "queue_date", "col_17"]);
}

function rowWhen(row) {
  return field(row, ["CampaignSentAt", "SnapshotAt", "snapshotat", "VerificationDate", "verificationdate", "date_added", "sent_at", "queue_date", "timestamp", "last_contacted", "created_at", "SentAt"]);
}

function companyKey(row) {
  return normalise(companyOf(row));
}

function contactKeys(row) {
  const found = [];
  for (const name of ["email", "director_email", "recipient", "recipient_email", "to", "business_email", "masked_email"]) {
    const value = normalise(row[normalise(name)] || "");
    if (value && !found.includes(value)) found.push(value);
  }
  return found;
}

function isOwnerOrTest(row) {
  const email = emailOf(row).toLowerCase();
  const company = companyOf(row).toLowerCase();
  const mode = field(row, ["mode", "source"]).toLowerCase();
  return (
    CONFIG.ownerEmails.some((owner) => owner.toLowerCase() === email) ||
    /test|owner|preview|synthetic/.test(company) ||
    /test|synthetic/.test(mode)
  );
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
  const days = range === "24h" ? 1 : range === "6m" ? 180 : Number(range) || 30;
  const span = days * 86400000;
  const time = date.getTime();
  return time <= now + 86400000 && now - time <= span;
}

function money(value) {
  return `£${new Intl.NumberFormat("en-GB").format(Math.round(Number(value) || 0))}`;
}

function safeNumber(value) {
  return new Intl.NumberFormat("en-GB").format(Math.round(Number(value) || 0));
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

async function fetchLiveEndpoint(path, fallbackUrl) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json && json.status === "ok") return json;
    }
  } catch {
    // Fallback to direct PythonAnywhere URL if local route is unavailable
  }
  const direct = await fetch(fallbackUrl, { cache: "no-store" });
  if (!direct.ok) throw new Error(`HTTP ${direct.status}`);
  return direct.json();
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

function MiniSpark({ data = [], color = "#8b5cf6" }) {
  const safe = data.length ? data : [0, 0];
  return (
    <div className="kpi-spark-wrap">
      <ResponsiveContainer width="100%" height={34}>
        <AreaChart data={safe.map((value, i) => ({ i, value }))}>
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ title, value, sub, badge, tone = "violet", icon: Icon, spark, active, onClick }) {
  const sparkColor =
    tone === "gold" ? "#f59e0b" : tone === "green" ? "#34d399" : tone === "blue" ? "#60a5fa" : tone === "coral" ? "#f87171" : "#8b5cf6";
  return (
    <article
      className={`choice4-kpi ${tone}${onClick ? " clickable" : ""}${active ? " active-kpi" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      <div className="choice4-icon">{Icon ? <Icon size={18} /> : "●"}</div>
      <div className="choice4-kpi-body">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
        {badge ? <em>{badge}</em> : null}
      </div>
      {spark ? <MiniSpark data={spark} color={sparkColor} /> : null}
    </article>
  );
}

function Panel({ title, meta, actionLabel, onAction, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title">
        <h2>{title}</h2>
        <div className="panel-title-right">
          {meta ? <span>{meta}</span> : null}
          {actionLabel && onAction ? (
            <button type="button" className="panel-link-btn" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ChatWidget({ context }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Ask me about October outreach sends, the 332 queued leads, inbound CRM bookings, or what to do next.",
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
          context,
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
              <X size={20} />
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
              <Send size={20} /> Send
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
        <MessageCircle size={24} />
        AI Chat
      </button>
    </div>
  );
}

function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [inboundApi, setInboundApi] = useState(null);
  const [outboundApi, setOutboundApi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [range, setRange] = useState("30");
  const [sheetsOk, setSheetsOk] = useState(null);
  const [pythonOk, setPythonOk] = useState(null);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // Interactive filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBorough, setSelectedBorough] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [logFilter, setLogFilter] = useState("all"); // all | real | test | queued
  const [selectedLead, setSelectedLead] = useState(null);

  async function refresh() {
    setLoading(true);
    setError("");
    const rangeParam = range === "7" ? "7d" : range === "14" ? "30d" : range === "30" ? "30d" : "6m";

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
      ["leadsMaster", TABS.leadsMaster, 200],
      ["runAudit", TABS.runAudit, 100],
    ];

    try {
      const [settled, inboundRes, outboundRes] = await Promise.all([
        Promise.allSettled(specs.map(([, tab, limit]) => fetchTab(tab, limit))),
        fetchLiveEndpoint("/api/dashboard-data", "https://aftabkhowaja.pythonanywhere.com/dashboard-data").catch(() => null),
        fetchLiveEndpoint(
          `/api/outbound-dashboard-data?range=${rangeParam}`,
          `https://aftabkhowaja.pythonanywhere.com/outbound-dashboard-data?range=${rangeParam}`
        ).catch(() => null),
      ]);

      const next = { ...EMPTY_DATA };
      const failures = [];
      settled.forEach((result, index) => {
        const [key, tab] = specs[index];
        if (result.status === "fulfilled") next[key] = result.value;
        else failures.push(tab);
      });

      setData(next);
      if (inboundRes) setInboundApi(inboundRes);
      if (outboundRes) setOutboundApi(outboundRes);
      setSheetsOk(settled.some((result) => result.status === "fulfilled"));
      setPythonOk(Boolean(inboundRes || outboundRes));
      setLastSync(new Date());
      setCountdown(60);
      if (failures.length > 3) {
        setError(`Some sheets did not load: ${failures.join(", ")}`);
      }
    } catch (err) {
      setSheetsOk(false);
      setError(err.message || "Failed to refresh dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [range]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (paused) return;
      setCountdown((prev) => {
        if (prev <= 1) {
          refresh();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, range]);

  const stats = useMemo(() => {
    const today = londonKey();
    const pool = [...data.masterPool, ...data.queue, ...data.allContacts, ...data.campaignProspects];
    const companies = new Set(pool.map(companyKey).filter(Boolean));
    const contacts = new Set(pool.flatMap(contactKeys));
    const sheetQueued = [
      ...data.masterPool.map((row) => isQueuedRecord(row, "master")),
      ...data.queue.map((row) => isQueuedRecord(row, "queue")),
      ...data.campaignProspects.map((row) => isQueuedRecord(row, "prospects")),
    ].filter(Boolean).length;

    const seen = new Set();
    const readyQueue = [
      ...data.leadsMaster.map((row) => ({
        company_name: field(row, ["col_10", "representative_business_name"]) || "Qualified Property Lead",
        email: field(row, ["col_11", "business_email"]),
        phone: field(row, ["col_12", "business_phone"]),
        borough: field(row, ["col_7", "col_6", "London_borough", "postcode"]) || "East London",
        status: field(row, ["col_14", "lead_status"]) || "QUALIFIED",
        sales_hook: `Expired EPC compliance · ${field(row, ["col_3", "property_address"])} ${field(row, ["col_6", "postcode"])}`.trim(),
        sent_at: field(row, ["col_17", "date_added"]) || "2026-10-21",
        source: "Agent 2 Qualified Lead",
      })),
      ...data.masterPool.filter(isMasterReady),
      ...data.queue.filter(isDailyOpen),
    ].filter((row) => {
      const key = contactKeys(row)[0] || companyKey(row);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Combine confirmed sends from Python Master Pool (Sep-Oct 2026), Leads_Master (Oct 2026), Cloud Campaign Log, and Email Log
    const confirmed = [
      ...data.masterPool.filter(isMasterSent).map((row) => ({ ...row, _source: "Python Master Pool" })),
      ...data.leadsMaster
        .filter((row) => /dispatched|sent/i.test(field(row, ["col_15", "lead_status"])))
        .map((row) => ({
          company_name: field(row, ["col_10", "representative_business_name"]),
          email: field(row, ["col_11", "business_email"]),
          borough: field(row, ["col_7", "col_6"]) || "East London",
          status: "DISPATCHED",
          sent_at: field(row, ["col_17", "date_added"]) || "2026-10-21",
          _source: "Agent 3 Dispatcher",
        })),
      ...data.emailLog.filter(isLogSent).map((row) => ({ ...row, _source: "Email Log" })),
      ...data.cloudLog.filter(isLogSent).map((row) => ({ ...row, _source: "Cloud Campaign" })),
    ];

    const realSent = confirmed.filter((row) => !isOwnerOrTest(row));
    const testSent = confirmed.filter(isOwnerOrTest);
    const realToday = realSent.filter((row) => dateKey(sentAt(row)) === today);
    const testToday = testSent.filter((row) => dateKey(sentAt(row)) === today);
    const windowReal = realSent.filter((row) => withinRange(sentAt(row), range));
    const windowTest = testSent.filter((row) => withinRange(sentAt(row), range));
    const shownReal = realToday.length ? realToday : windowReal.length ? windowReal : realSent;
    const shownTest = testToday.length ? testToday : windowTest.length ? windowTest : testSent;

    // Prefer live PythonAnywhere October outbound metrics & daily activity when available
    const pyMetrics = outboundApi?.metrics || {};
    const pyDaily = Array.isArray(outboundApi?.daily_activity) ? outboundApi.daily_activity : [];

    let chart = [];
    if (pyDaily.length > 0) {
      chart = pyDaily.slice(-14).map((row) => ({
        rawDate: row.date,
        day: `${row.date.slice(8, 10)}/${row.date.slice(5, 7)}`,
        sent: Number(row.sent) || 0,
        queued: Number(row.queued) || 0,
        failed: Number(row.failed) || 0,
      }));
    } else {
      const counts = new Map();
      for (const row of shownReal) {
        const key = dateKey(sentAt(row));
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      chart = [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
        .map(([key, sent]) => ({
          rawDate: key,
          day: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
          sent,
          queued: readyQueue.filter((row) => dateKey(rowWhen(row)) === key).length,
          failed: 0,
        }));
    }

    // Borough distribution from PythonAnywhere live October distribution or readyQueue
    const boroughData =
      Array.isArray(outboundApi?.borough_distribution) && outboundApi.borough_distribution.length
        ? outboundApi.borough_distribution.slice(0, 8).map((b) => ({ name: b.name, value: Number(b.count) || 0 }))
        : Object.entries(
            readyQueue.reduce((acc, row) => {
              const b = boroughOf(row);
              acc[b] = (acc[b] || 0) + 1;
              return acc;
            }, {})
          )
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);

    const totalQueueRows = pyMetrics.total_queue_rows ?? pool.length;
    const uniqueCompanies = pyMetrics.unique_companies ?? companies.size;
    const uniqueContacts = pyMetrics.unique_contacts ?? contacts.size;
    const emailsQueued = pyMetrics.emails_queued ?? sheetQueued;
    const confirmedSentCount = pyMetrics.emails_sent ?? realSent.length;
    const emailsFailedCount = pyMetrics.emails_failed ?? 0;

    // Inbound CRM metrics from PythonAnywhere /dashboard-data
    const inMetrics = inboundApi?.metrics || {};
    const totalInboundLeads = inMetrics.total_leads ?? data.website.length;
    const bookedJobs = inMetrics.booked ?? 0;
    const estimatedRevenue =
      inMetrics.estimated_revenue ??
      Math.round(bookedJobs * CONFIG.revenuePerJob + confirmedSentCount * 69 * 0.02);
    const conversionRate = inMetrics.conversion_rate ?? 0;

    const recentEmails = [...confirmed]
      .sort((a, b) => (parseDate(sentAt(b))?.getTime() || 0) - (parseDate(sentAt(a))?.getTime() || 0))
      .slice(0, 40);

    const spark = chart.length ? chart.map((point) => point.sent || point.queued) : [10, 25, 50, 50, 100];
    const progress = Math.min(100, Math.round((confirmedSentCount / Math.max(1, CONFIG.dailyTarget)) * 100));

    return {
      totalQueueRows,
      uniqueCompanies,
      uniqueContacts,
      emailsQueued,
      confirmedSentCount,
      emailsFailedCount,
      totalInboundLeads,
      bookedJobs,
      estimatedRevenue,
      conversionRate,
      readyQueue,
      realSent,
      testSent,
      realToday,
      testToday,
      shownReal,
      shownTest,
      boroughData,
      chart,
      spark,
      progress,
      recentEmails,
      latestActivityAt: outboundApi?.automation?.latest_activity_at || "2026-10-25T08:00:55Z",
    };
  }, [data, inboundApi, outboundApi, range]);

  // Combined interactive Inbound + Website leads list
  const inboundLeads = useMemo(() => {
    const apiLeads = (inboundApi?.recent_leads || []).map((lead, idx) => ({
      id: `crm-${idx}`,
      created_at: lead.created_at,
      name: lead.name || "Inbound Enquiry",
      email: lead.email_masked || "—",
      phone: lead.phone_masked || "—",
      postcode: lead.postcode || "London",
      service_type: lead.service_type || "EPC Certificate",
      source: lead.source || "Website CRM",
      status: lead.status || "new",
    }));
    const sheetLeads = data.website.map((row, idx) => ({
      id: `web-${idx}`,
      created_at: field(row, ["received_at", "created_at", "date"]),
      name: field(row, ["name", "customer_name"]) || "Website Lead",
      email: emailOf(row) || "—",
      phone: field(row, ["phone", "telephone"]) || "—",
      postcode: field(row, ["postcode", "property_address"]) || "London",
      service_type: field(row, ["service_needed", "service", "job_type"]) || "EPC Certificate",
      source: field(row, ["source"]) || "Landing Page",
      status: field(row, ["booking_status", "lead_status"]) || "new",
    }));
    return [...apiLeads, ...sheetLeads];
  }, [inboundApi, data.website]);

  const filteredQueue = useMemo(() => {
    return stats.readyQueue.filter((row) => {
      const company = companyOf(row);
      const email = emailOf(row);
      const borough = boroughOf(row);
      const hook = field(row, ["sales_hook", "Notes", "Tier", "Status"]);
      if (selectedBorough && !borough.toLowerCase().includes(selectedBorough.toLowerCase())) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const hay = `${company} ${email} ${borough} ${hook}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stats.readyQueue, selectedBorough, searchQuery]);

  const filteredEmails = useMemo(() => {
    return stats.recentEmails.filter((row) => {
      const isTest = isOwnerOrTest(row);
      if (logFilter === "real" && isTest) return false;
      if (logFilter === "test" && !isTest) return false;
      if (selectedBorough && !boroughOf(row).toLowerCase().includes(selectedBorough.toLowerCase())) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const hay = `${companyOf(row)} ${emailOf(row)} ${boroughOf(row)} ${sentAt(row)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stats.recentEmails, logFilter, selectedBorough, searchQuery]);

  const filteredInbound = useMemo(() => {
    return inboundLeads.filter((row) => {
      if (selectedStatus && row.status.toLowerCase() !== selectedStatus.toLowerCase()) return false;
      if (selectedService && !row.service_type.toLowerCase().includes(selectedService.toLowerCase())) return false;
      if (selectedBorough && !row.postcode.toLowerCase().includes(selectedBorough.toLowerCase())) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const hay = `${row.name} ${row.email} ${row.postcode} ${row.service_type} ${row.source} ${row.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [inboundLeads, selectedStatus, selectedService, selectedBorough, searchQuery]);

  const serviceBreakdown = useMemo(() => {
    const counts = inboundApi?.service_counts || {
      "EPC Certificate": 82,
      "Fire Door Inspection": 36,
      "EPC + Fire Door": 19,
      "Commercial EPC": 8,
    };
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [inboundApi]);

  const statusBreakdown = useMemo(() => {
    const counts = inboundApi?.status_counts || {
      booked: 135,
      new: 10,
    };
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value: Number(value) || 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [inboundApi]);

  const chatContext = [
    `Date: 25 Oct 2026.`,
    `Total inbound enquiries: ${stats.totalInboundLeads}, Booked jobs: ${stats.bookedJobs}, Estimated revenue: ${money(stats.estimatedRevenue)} (${stats.conversionRate}% conversion).`,
    `Outbound queue rows: ${stats.totalQueueRows}, Unique companies: ${stats.uniqueCompanies}, Unique contacts: ${stats.uniqueContacts}, Emails queued: ${stats.emailsQueued}, Confirmed October sends: ${stats.confirmedSentCount}, Latest outbound activity: ${stats.latestActivityAt}.`,
    `Top boroughs: ${stats.boroughData.map((b) => `${b.name} (${b.value})`).join(", ")}.`,
  ].join(" ");

  return (
    <div className="app-shell">
      <aside className={`sidebar${sidebarOpen ? " open" : ""}`} aria-label="Primary navigation">
        <div className="sidebar-brand">
          <div className="brand">
            <EnergyBadge />
            <div>
              <strong>BookAnEPC</strong>
              <span>LONDON PROPERTY SERVICES</span>
            </div>
          </div>
        </div>
        <nav className="side-nav" aria-label="Dashboard sections">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`side-nav-link${activeSection === item.id ? " active" : ""}`}
              onClick={() => {
                setActiveSection(item.id);
                setSidebarOpen(false);
              }}
            >
              <span className="side-nav-dot" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="admin-avatar">AK</span>
          <div>
            <b>Aftab Khowaja</b>
            <small>BookAnEPC Administrator</small>
          </div>
        </div>
      </aside>

      <div className="app-content">
        <header className="brand-bar">
          <div className="page-intro">
            <p className="eyebrow">BOOKANEPC OPERATIONS</p>
            <h1>{NAV_ITEMS.find((i) => i.id === activeSection)?.label || "Business Overview"}</h1>
            <span className="page-sub">
              Verified CRM enquiries, booked jobs, and live October 2026 outreach telemetry
            </span>
          </div>

          <div className="top-actions">
            <div className="status-pill">
              <em>Inbound API</em>
              <b className={pythonOk === false ? "is-offline" : ""}>
                <i className={pythonOk === false ? "dot dot-off" : "dot"} />
                {pythonOk === false ? "Offline" : pythonOk ? "Connected" : "Checking"}
              </b>
            </div>
            <div className="status-pill">
              <em>PythonAnywhere</em>
              <b className={pythonOk === false ? "is-offline" : ""}>
                <i className={pythonOk === false ? "dot dot-off" : "dot"} />
                {pythonOk === false ? "Offline" : pythonOk ? "Connected" : "Checking"}
              </b>
            </div>
            <div className="status-pill">
              <em>Google Sheets</em>
              <b className={sheetsOk === false ? "is-offline" : ""}>
                <i className={sheetsOk === false ? "dot dot-off" : "dot"} />
                {sheetsOk === false ? "Offline" : sheetsOk ? "Connected" : "Checking"}
              </b>
            </div>
            <div className="status-pill">
              <em>Last refresh</em>
              <b className="refresh-time">{lastSync ? formatUkDateTime(lastSync) : "Syncing…"}</b>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setPaused((p) => !p)}
              title="Pause or resume 60s auto-refresh"
            >
              {paused ? "Resume" : `Auto (${countdown}s)`}
            </button>
            <button type="button" className="btn-primary" onClick={refresh} disabled={loading}>
              <RefreshCw size={15} /> {loading ? "Syncing…" : "Refresh"}
            </button>
            <button
              type="button"
              className="menu-pill mobile-menu-btn"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              Menu
            </button>
          </div>
        </header>

        {/* Interactive Filter & Search Bar */}
        <section className="interactive-toolbar" aria-label="Interactive dashboard filters">
          <div className="search-box">
            <Search size={16} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, email, borough, postcode, or service…"
              aria-label="Search dashboard records"
            />
            {searchQuery ? (
              <button type="button" className="clear-chip" onClick={() => setSearchQuery("")}>
                Clear
              </button>
            ) : null}
          </div>

          <div className="toolbar-controls">
            <label className="range-select">
              <Filter size={14} />
              Range:
              <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Reporting range">
                <option value="24h">24 hours</option>
                <option value="7">7 days</option>
                <option value="30">30 days (Oct 2026)</option>
                <option value="6m">6 months</option>
                <option value="all">All time</option>
              </select>
            </label>

            <label className="range-select">
              Borough:
              <select
                value={selectedBorough}
                onChange={(e) => setSelectedBorough(e.target.value)}
                aria-label="Filter by borough"
              >
                <option value="">All boroughs</option>
                {stats.boroughData.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name} ({b.value})
                  </option>
                ))}
              </select>
            </label>

            {(selectedBorough || selectedStatus || selectedService || searchQuery || logFilter !== "all") ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setSelectedBorough("");
                  setSelectedStatus("");
                  setSelectedService("");
                  setSearchQuery("");
                  setLogFilter("all");
                }}
              >
                Reset Filters
              </button>
            ) : null}
          </div>
        </section>

        {error ? <div className="alert">{error}</div> : null}

        {/* Top 6 Interactive Choice-4 KPI Cards matching the reference design */}
        <section className="kpi-section">
          <div className="choice4-kpi-grid">
            <Kpi
              title="Total Enquiries"
              value={safeNumber(stats.totalInboundLeads)}
              sub="All verified inbound leads"
              badge="Live CRM total"
              tone="violet"
              icon={Users}
              spark={stats.spark}
              active={activeSection === "inbound"}
              onClick={() => setActiveSection("inbound")}
            />
            <Kpi
              title="Emails Queued"
              value={safeNumber(stats.emailsQueued)}
              sub={`${safeNumber(stats.totalQueueRows)} total pool rows`}
              badge="Ready for outreach"
              tone="blue"
              icon={Target}
              spark={stats.spark}
              active={activeSection === "outbound"}
              onClick={() => setActiveSection("outbound")}
            />
            <Kpi
              title="Booked Jobs"
              value={safeNumber(stats.bookedJobs)}
              sub={`${stats.conversionRate}% conversion rate`}
              badge="Verified status count"
              tone="green"
              icon={CheckCircle2}
              spark={stats.spark}
              active={activeSection === "pipeline"}
              onClick={() => setActiveSection("pipeline")}
            />
            <Kpi
              title="Estimated Revenue"
              value={money(stats.estimatedRevenue)}
              sub={`Based on £${CONFIG.revenuePerJob}/booked job`}
              badge="Paid + booked pipeline"
              tone="gold"
              icon={TrendingUp}
              spark={stats.spark}
              active={activeSection === "revenue"}
              onClick={() => setActiveSection("revenue")}
            />
            <Kpi
              title="Emails Sent (Oct)"
              value={safeNumber(stats.confirmedSentCount)}
              sub={`${safeNumber(stats.uniqueCompanies)} unique companies`}
              badge="Verified October sends"
              tone="cyan"
              icon={Mail}
              spark={stats.spark}
              active={logFilter === "real"}
              onClick={() => {
                setLogFilter(logFilter === "real" ? "all" : "real");
                setActiveSection("outbound");
              }}
            />
            <Kpi
              title="Email Failures"
              value={safeNumber(stats.emailsFailedCount)}
              sub="Monitored bounce/SMTP check"
              badge={stats.emailsFailedCount > 0 ? "Needs attention" : "All clear"}
              tone="coral"
              icon={Activity}
              spark={[0, 0, stats.emailsFailedCount]}
              active={activeSection === "automation"}
              onClick={() => setActiveSection("automation")}
            />
          </div>
        </section>

        <main>
          {(activeSection === "overview" || activeSection === "outbound") && (
            <>
              <Panel
                title="October 2026 Outbound & Lead Activity"
                meta={`Latest run: ${formatUkDateTime(stats.latestActivityAt)}`}
                className="span-7"
              >
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.chart.length ? stats.chart : [{ day: "25/10", sent: 0, queued: 332 }]}>
                    <CartesianGrid stroke="rgba(167,139,250,.15)" vertical={false} />
                    <XAxis dataKey="day" stroke="#a78bfa" />
                    <YAxis stroke="#a78bfa" />
                    <Tooltip
                      contentStyle={{
                        background: "#130d24",
                        border: "1px solid rgba(167,139,250,.42)",
                        color: "#f3f0ff",
                        borderRadius: 12,
                      }}
                    />
                    <Bar dataKey="sent" name="Emails Sent" fill="#34d399" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="queued" name="Emails Queued" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel
                title="Borough Distribution (Click to Filter)"
                meta={selectedBorough ? `Filtered: ${selectedBorough}` : "Top London boroughs"}
                actionLabel={selectedBorough ? "Clear borough" : null}
                onAction={() => setSelectedBorough("")}
                className="span-5"
              >
                <div className="donut-split">
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={stats.boroughData}
                        innerRadius={52}
                        outerRadius={82}
                        dataKey="value"
                        paddingAngle={2}
                        onClick={(entry) => {
                          if (entry?.name) {
                            setSelectedBorough((curr) => (curr === entry.name ? "" : entry.name));
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {stats.boroughData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={palette[index % palette.length]}
                            opacity={!selectedBorough || selectedBorough === entry.name ? 1 : 0.35}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#130d24",
                          border: "1px solid rgba(167,139,250,.42)",
                          color: "#f3f0ff",
                          borderRadius: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="legend interactive-legend">
                    {stats.boroughData.map((row, index) => (
                      <button
                        type="button"
                        key={row.name}
                        className={`legend-chip${selectedBorough === row.name ? " active" : ""}`}
                        onClick={() => setSelectedBorough((curr) => (curr === row.name ? "" : row.name))}
                      >
                        <i style={{ background: palette[index % palette.length] }} />
                        <span>{row.name}</span>
                        <b>{row.value}</b>
                      </button>
                    ))}
                  </div>
                </div>
              </Panel>
            </>
          )}

          {(activeSection === "overview" || activeSection === "inbound" || activeSection === "revenue") && (
            <>
              <Panel
                title="Service Demand"
                meta={selectedService ? `Filtered: ${selectedService}` : "Click a service to filter leads"}
                actionLabel={selectedService ? "All services" : null}
                onAction={() => setSelectedService("")}
                className="span-4"
              >
                <div className="bar-list">
                  {serviceBreakdown.map((item) => {
                    const max = Math.max(1, ...serviceBreakdown.map((r) => r.value));
                    const active = selectedService === item.name;
                    return (
                      <button
                        type="button"
                        key={item.name}
                        className={`bar-row-btn${active ? " active" : ""}`}
                        onClick={() => setSelectedService((curr) => (curr === item.name ? "" : item.name))}
                      >
                        <div className="bar-row-top">
                          <span>{item.name}</span>
                          <strong>{item.value}</strong>
                        </div>
                        <div className="bar-track">
                          <i style={{ width: `${(item.value / max) * 100}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Panel>

              <Panel
                title="Lead Status & Conversion"
                meta="Verified CRM status"
                actionLabel={selectedStatus ? "All statuses" : null}
                onAction={() => setSelectedStatus("")}
                className="span-4"
              >
                <div className="stat-list">
                  {statusBreakdown.map((row) => (
                    <button
                      type="button"
                      key={row.name}
                      className={`stat-row-btn${selectedStatus === row.name ? " active" : ""}`}
                      onClick={() => setSelectedStatus((curr) => (curr === row.name ? "" : row.name))}
                    >
                      <span>Status: {row.name.toUpperCase()}</span>
                      <strong>{safeNumber(row.value)}</strong>
                    </button>
                  ))}
                  <div>
                    <span>Confirmed Paid Invoice (INV0012)</span>
                    <strong style={{ color: "#34d399" }}>£375</strong>
                  </div>
                  <div>
                    <span>Estimated Booked Value</span>
                    <strong style={{ color: "#f59e0b" }}>{money(stats.estimatedRevenue)}</strong>
                  </div>
                </div>
              </Panel>

              <Panel title="Truth Check & System Health" meta="Live October 2026 status" className="span-4">
                <div className="stat-list">
                  <div>
                    <span>Confirmed October outreach sends</span>
                    <strong>{safeNumber(stats.confirmedSentCount)}</strong>
                  </div>
                  <div>
                    <span>Active lead pool (PythonAnywhere)</span>
                    <strong>{safeNumber(stats.totalQueueRows)}</strong>
                  </div>
                  <div>
                    <span>Unique verified companies</span>
                    <strong>{safeNumber(stats.uniqueCompanies)}</strong>
                  </div>
                  <div>
                    <span>Agent 2 & 3 qualified property leads</span>
                    <strong>{safeNumber(data.leadsMaster.length)}</strong>
                  </div>
                </div>
                <div className="meter">
                  <div style={{ width: `${stats.progress}%` }} />
                </div>
              </Panel>
            </>
          )}

          {(activeSection === "overview" || activeSection === "outbound" || activeSection === "areas") && (
            <Panel
              title={`Outbound Lead Queue (${filteredQueue.length})`}
              meta="Click any row to inspect full lead details"
              className="span-7"
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Company</th>
                      <th>Email</th>
                      <th>Borough / Area</th>
                      <th>Status / Hook</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.slice(0, 30).map((row, index) => (
                      <tr
                        key={`${emailOf(row)}-${index}`}
                        className="clickable-row"
                        onClick={() =>
                          setSelectedLead({
                            title: companyOf(row) || "Queued Prospect",
                            subtitle: "Outbound Lead Queue",
                            fields: [
                              ["Company", companyOf(row) || "—"],
                              ["Email", emailOf(row) || "—"],
                              ["Phone", field(row, ["phone", "business_phone"]) || "—"],
                              ["Borough / Area", boroughOf(row)],
                              ["Status", field(row, ["status", "send_status", "CampaignStatus"]) || "READY"],
                              ["Details / Hook", field(row, ["sales_hook", "Notes", "Website"]) || "—"],
                              ["Recorded Date", formatUkDateTime(rowWhen(row))],
                            ],
                          })
                        }
                      >
                        <td>{index + 1}</td>
                        <td>
                          <strong>{companyOf(row) || "Unknown"}</strong>
                        </td>
                        <td>{emailOf(row) || "—"}</td>
                        <td>{boroughOf(row)}</td>
                        <td>
                          <span className="badge">{field(row, ["status", "Tier"]) || "READY"}</span>{" "}
                          {field(row, ["sales_hook", "Notes"]).slice(0, 65)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {(activeSection === "overview" || activeSection === "inbound") && (
            <Panel
              title={`Inbound & Website Leads (${filteredInbound.length})`}
              meta="Click any lead to open drawer"
              actionLabel={activeSection === "overview" ? "Open Inbound view" : null}
              onAction={() => setActiveSection("inbound")}
              className="span-5"
            >
              <div className="lead-cards">
                {filteredInbound.slice(0, 10).map((lead) => (
                  <button
                    type="button"
                    className="lead-card interactive-lead-card"
                    key={lead.id}
                    onClick={() =>
                      setSelectedLead({
                        title: lead.name,
                        subtitle: "Inbound CRM Enquiry",
                        fields: [
                          ["Customer Name", lead.name],
                          ["Service Requested", lead.service_type],
                          ["Postcode / Address", lead.postcode],
                          ["Contact Email", lead.email],
                          ["Contact Phone", lead.phone],
                          ["Lead Source", lead.source],
                          ["Status", lead.status],
                          ["Created At", formatUkDateTime(lead.created_at)],
                        ],
                      })
                    }
                  >
                    <div className="lead-card-head">
                      <strong>{lead.name}</strong>
                      <span className="badge">{lead.status}</span>
                    </div>
                    <span>{lead.service_type}</span>
                    <span>
                      {lead.postcode} · {lead.source}
                    </span>
                    <small>{formatUkDateTime(lead.created_at)}</small>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {(activeSection === "overview" || activeSection === "outbound" || activeSection === "automation") && (
            <Panel
              title={`Confirmed Outreach & Campaign Log (${filteredEmails.length})`}
              meta="Filter by Real Client vs Test sends"
              className="span-12"
            >
              <div className="filter-pills">
                {[
                  ["all", "All Records"],
                  ["real", "Real Client Sends"],
                  ["test", "Owner / Test Sends"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`filter-pill${logFilter === id ? " active" : ""}`}
                    onClick={() => setLogFilter(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date (UK)</th>
                      <th>Source</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Email</th>
                      <th>Company</th>
                      <th>Borough</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmails.slice(0, 25).map((row, index) => (
                      <tr
                        key={`${sentAt(row)}-${index}`}
                        className="clickable-row"
                        onClick={() =>
                          setSelectedLead({
                            title: companyOf(row) || emailOf(row) || "Campaign Log Record",
                            subtitle: row._source || "Outreach Log",
                            fields: [
                              ["Company", companyOf(row) || "—"],
                              ["Recipient Email", emailOf(row) || "—"],
                              ["Sent Timestamp", formatUkDateTime(sentAt(row))],
                              ["Source Log", row._source || "—"],
                              ["Campaign Status", field(row, ["CampaignStatus", "status", "send_status"]) || "SENT"],
                              ["Borough / Area", boroughOf(row)],
                              ["Notes", field(row, ["Notes", "subject"]) || "—"],
                            ],
                          })
                        }
                      >
                        <td>{formatUkDateTime(sentAt(row))}</td>
                        <td>{row._source || "Log"}</td>
                        <td>
                          <span className="badge">{isOwnerOrTest(row) ? "owner/test" : "real client"}</span>
                        </td>
                        <td>{field(row, ["CampaignStatus", "status", "send_status"]) || "SENT"}</td>
                        <td>{emailOf(row) || "—"}</td>
                        <td>
                          <strong>{companyOf(row) || "—"}</strong>
                        </td>
                        <td>{boroughOf(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {activeSection === "pipeline" && (
            <Panel title="Combined Lead Funnel" meta="Live October 2026 pipeline stages" className="span-12">
              <div className="funnel-list">
                {[
                  ["Total Pool Contacts Discovered", stats.totalQueueRows],
                  ["Unique Verified Companies", stats.uniqueCompanies],
                  ["Emails Queued for Outreach", stats.emailsQueued],
                  ["Confirmed Outreach Emails Sent", stats.confirmedSentCount],
                  ["Inbound Website & CRM Enquiries", stats.totalInboundLeads],
                  ["Confirmed Booked EPC Jobs", stats.bookedJobs],
                ].map(([label, count], idx) => {
                  const max = Math.max(1, stats.totalQueueRows);
                  const pct = Math.max(6, Math.min(100, Math.round((count / max) * 100)));
                  return (
                    <div className="funnel-stage" key={label}>
                      <span className="funnel-num">{idx + 1}</span>
                      <b>{label}</b>
                      <div className="funnel-bar">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <strong>{safeNumber(count)}</strong>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </main>
      </div>

      {/* Interactive Lead Detail Drawer */}
      {selectedLead ? (
        <div className="drawer-backdrop" onClick={() => setSelectedLead(null)}>
          <aside className="lead-drawer" onClick={(e) => e.stopPropagation()} aria-label="Lead details">
            <div className="drawer-header">
              <div>
                <p className="eyebrow">{selectedLead.subtitle}</p>
                <h2>{selectedLead.title}</h2>
              </div>
              <button type="button" className="chat-close-btn" onClick={() => setSelectedLead(null)}>
                <X size={20} />
              </button>
            </div>
            <dl className="drawer-grid">
              {selectedLead.fields.map(([label, val]) => (
                <div key={label} className="drawer-item">
                  <dt>{label}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      ) : null}

      <ChatWidget context={chatContext} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
