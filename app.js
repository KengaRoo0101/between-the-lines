import React, { useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);

const agents = [
  { name: "Spotter", area: "Central", status: "Active", permission: "Recommend and request approval", risk: "High", task: "Coordinate MVP launch and approval gates" },
  { name: "Formed Agent", area: "Founder intake", status: "Active", permission: "Draft and recommend", risk: "Medium", task: "Prepare founder workflows" },
  { name: "Builder Agent", area: "Tool creation", status: "Testing", permission: "Draft only", risk: "Medium", task: "Prepare specs for approved tools" },
  { name: "EmailOps Agent", area: "Gmail", status: "Construction", permission: "Draft only until connected", risk: "High", task: "Construction zone to open soon" },
  { name: "CalendarOps Agent", area: "Calendar", status: "Construction", permission: "Recommend only until connected", risk: "Medium", task: "Construction zone to open soon" },
  { name: "AccountOps Agent", area: "Admissions Room", status: "Holding", permission: "Recommend only", risk: "High", task: "Held until needed" },
];

const tasks = [
  { title: "Deploy visible control room", agent: "Spotter", status: "Working", risk: "Medium", next: "Verify deployment" },
  { title: "Place unfinished modules on hold", agent: "Spotter", status: "Completed", risk: "Low", next: "Show construction-zone labels" },
  { title: "Prepare approval gate", agent: "Builder Agent", status: "Waiting Approval", risk: "High", next: "Owner review before external action" },
  { title: "EmailOps integration", agent: "EmailOps Agent", status: "Construction", risk: "High", next: "Connect only after scope approval" },
  { title: "AccountOps governance", agent: "AccountOps Agent", status: "Holding", risk: "High", next: "Remain in Admissions Room" },
];

const approvals = [
  { action: "Send outbound email", status: "Blocked", rule: "Human approval required" },
  { action: "Deploy public site change", status: "Blocked", rule: "Human approval required" },
  { action: "Share contact or user data", status: "Blocked", rule: "Consent and human approval required" },
  { action: "Change account access", status: "Blocked", rule: "AccountOps held; human owner required" },
];

const nav = ["Dashboard", "Agents", "Tasks", "Approvals", "Construction Zones", "Audit Log", "Settings"];

function Badge({ children, tone = "neutral" }) {
  return html`<span className=${`badge ${tone}`}>${children}</span>`;
}

function Card({ title, children }) {
  return html`<section className="card"><h2>${title}</h2>${children}</section>`;
}

function Dashboard() {
  const active = agents.filter((a) => a.status === "Active").length;
  const construction = agents.filter((a) => a.status === "Construction").length;
  const holding = agents.filter((a) => a.status === "Holding").length;
  const blocked = approvals.length;
  return html`
    <div className="grid four">
      <${Card} title="Active Agents"><p className="metric">${active}</p><p>Working in the visible MVP.</p><//>
      <${Card} title="Construction Zones"><p className="metric">${construction}</p><p>Shown publicly as opening soon.</p><//>
      <${Card} title="Admissions Room"><p className="metric">${holding}</p><p>AccountOps is intentionally held.</p><//>
      <${Card} title="Blocked Actions"><p className="metric">${blocked}</p><p>No external action without approval.</p><//>
    </div>
    <${Card} title="Launch Position">
      <p>The live product is the agent operations control room. Incomplete systems are labeled as construction zones rather than hidden or overbuilt.</p>
      <p className="rule">Agents may draft, classify, summarize, and recommend. They may not publish, send, deploy, spend, file, expose data, or change accounts without approval.</p>
    <//>
  `;
}

function Agents() {
  return html`<div className="list">${agents.map((agent) => html`
    <article className="row" key=${agent.name}>
      <div><h3>${agent.name}</h3><p>${agent.area}</p><p>${agent.task}</p></div>
      <div className="right"><${Badge} tone=${agent.status.toLowerCase()}>${agent.status}<//><${Badge}>${agent.risk}<//><small>${agent.permission}</small></div>
    </article>
  `)}</div>`;
}

function Tasks() {
  const columns = ["Working", "Waiting Approval", "Completed", "Construction", "Holding"];
  return html`<div className="kanban">${columns.map((column) => html`
    <section className="lane" key=${column}><h2>${column}</h2>${tasks.filter((task) => task.status === column).map((task) => html`
      <article className="task" key=${task.title}><h3>${task.title}</h3><p>${task.agent}</p><p>${task.next}</p><${Badge}>${task.risk}<//></article>
    `)}</section>
  `)}</div>`;
}

function Approvals() {
  return html`<div className="list">${approvals.map((approval) => html`
    <article className="row" key=${approval.action}><div><h3>${approval.action}</h3><p>${approval.rule}</p></div><${Badge} tone="blocked">${approval.status}<//></article>
  `)}</div>`;
}

function ConstructionZones() {
  return html`<div className="grid three">
    <${Card} title="EmailOps"><p>Construction zone to open soon. Draft-only until Gmail scopes and approval rules are finalized.</p><//>
    <${Card} title="CalendarOps"><p>Construction zone to open soon. Scheduling actions require approval before live invites are created.</p><//>
    <${Card} title="Matches and Analytics"><p>Construction zone to open soon. Matchmaking and analytics require consent, audit logs, and backend state.</p><//>
  </div>`;
}

function AuditLog() {
  const events = [
    "Control Room MVP prepared for deployment",
    "AccountOps moved to Admissions Room holding state",
    "Construction-zone labels applied to incomplete modules",
    "Approval-required policy confirmed for external actions",
  ];
  return html`<${Card} title="Audit Log MVP"><ul>${events.map((event) => html`<li key=${event}>${event}</li>`)}</ul><//>`;
}

function Settings() {
  return html`<div className="grid two">
    <${Card} title="Live Now"><ul><li>Dashboard</li><li>Agents</li><li>Tasks</li><li>Approvals</li><li>Audit Log</li><li>Settings</li></ul><//>
    <${Card} title="Held Until Complete"><ul><li>EmailOps integration</li><li>CalendarOps integration</li><li>AccountOps permissions</li><li>Live matching</li><li>Analytics backend</li></ul><//>
  </div>`;
}

function App() {
  const [active, setActive] = useState("Dashboard");
  const content = useMemo(() => {
    if (active === "Agents") return html`<${Agents} />`;
    if (active === "Tasks") return html`<${Tasks} />`;
    if (active === "Approvals") return html`<${Approvals} />`;
    if (active === "Construction Zones") return html`<${ConstructionZones} />`;
    if (active === "Audit Log") return html`<${AuditLog} />`;
    if (active === "Settings") return html`<${Settings} />`;
    return html`<${Dashboard} />`;
  }, [active]);

  return html`<main>
    <aside><div className="brand"><strong>Spotter</strong><span>Control Room MVP</span></div>${nav.map((item) => html`<button key=${item} className=${active === item ? "active" : ""} onClick=${() => setActive(item)}>${item}</button>`)}</aside>
    <section className="workspace"><header><div><p className="eyebrow">Coulter Operations</p><h1>${active}</h1></div><${Badge} tone="live">Deployable MVP<//></header>${content}</section>
  </main>`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
