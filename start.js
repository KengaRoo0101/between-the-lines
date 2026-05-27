const PATH_COPY = {
  llc: {
    label: "Start an LLC",
    promise: "Turn the idea into a clean business setup path before spending money.",
    firstMoves: [
      "Write the offer in one sentence: who it helps, what it does, and what result it creates.",
      "List the minimum information needed for formation, banking, email, domain, and basic operating documents.",
      "Separate legal setup from product setup so you do not confuse filing paperwork with having a sellable offer.",
    ],
    checklist: [
      "Name and positioning draft",
      "Business purpose statement",
      "Basic operating workflow",
      "Domain and email plan",
      "Privacy, terms, refund, and data-retention drafts",
    ],
    monetization: [
      "Start with one simple paid offer before building a full subscription.",
      "Package setup materials as a paid document packet once the free path proves useful.",
      "Add guided setup or review as a higher-priced service layer later.",
    ],
    dataPlan: [
      "Track selected path, stage, timeline, and requested outputs.",
      "Avoid collecting sensitive personal information in the first intake.",
      "Use aggregate demand patterns to decide which modules deserve deeper buildout.",
    ],
  },
  product: {
    label: "Build a product",
    promise: "Convert the rough idea into a usable offer, page, workflow, and first payment path.",
    firstMoves: [
      "Define the smallest result a user would pay for.",
      "Create a landing page that explains the problem, output, proof, and next action.",
      "Build one workflow that produces visible value before adding accounts, dashboards, or subscriptions.",
    ],
    checklist: [
      "Problem statement",
      "User path",
      "Free sample or demo",
      "Paid upgrade trigger",
      "Support and refund language",
    ],
    monetization: [
      "Use one-time payments first if the value is report-like or export-like.",
      "Use subscriptions only when users have a reason to return weekly or monthly.",
      "Create premium exports, saved projects, or assisted setup as upgrade points.",
    ],
    dataPlan: [
      "Measure which path users choose most often.",
      "Track where users stop before conversion.",
      "Collect feedback on whether the output was useful before expanding features.",
    ],
  },
  documents: {
    label: "Organize documents",
    promise: "Turn scattered files, policies, notes, and templates into a clean packet or export structure.",
    firstMoves: [
      "Define the packet purpose: filing, launch, internal operations, client delivery, or evidence organization.",
      "Create a fixed section order so every packet feels consistent and complete.",
      "Separate source materials from generated summaries and final exports.",
    ],
    checklist: [
      "Cover page and metadata",
      "Document index",
      "Core sections",
      "Disclaimers and usage boundaries",
      "Export-ready PDF structure",
    ],
    monetization: [
      "Sell template packs before building a complex compiler.",
      "Offer premium formatting/export once users understand the value.",
      "Add assisted packet review as a service option later.",
    ],
    dataPlan: [
      "Track packet type and requested export format.",
      "Store templates and metadata separately from sensitive source documents.",
      "Use anonymized structure data to improve default packet formats.",
    ],
  },
  data: {
    label: "Analyze messy data",
    promise: "Turn messages, timelines, records, and exports into a readable report with patterns and next steps.",
    firstMoves: [
      "Identify the source type and what the user wants to understand from it.",
      "Normalize the input into timestamp, actor, event, and content fields.",
      "Generate a concise report before adding advanced filters or heavy dashboards.",
    ],
    checklist: [
      "Supported file/source list",
      "Upload guidance",
      "Sample report",
      "Report structure",
      "Consent and retention language",
    ],
    monetization: [
      "Keep a free sample report available.",
      "Charge for full report export, deeper analysis, or saved project history.",
      "Bundle report tools into Formed. as part of a broader platform subscription later.",
    ],
    dataPlan: [
      "Do not store raw uploads by default.",
      "Track source type, file type, completion status, and report usefulness feedback.",
      "Use consented aggregate insights to improve report templates and detection rules.",
    ],
  },
};

const TIMELINE_COPY = {
  today: "Use the shortest path: one clear output, one visible page, and one next action today.",
  week: "Use a weekly sprint: define, build, review, and publish one working version.",
  month: "Use a monthly rollout: structure the offer, build the workflow, test it, then add monetization.",
  steady: "Use a durable build rhythm: document decisions, avoid overbuilding, and ship one useful layer at a time.",
};

const STAGE_COPY = {
  idea: "Start by forcing the idea into a specific user, result, and output.",
  started: "Clean up what exists before adding more features.",
  live: "Improve conversion, trust, and follow-through before expanding the product line.",
  repair: "Stabilize routing, copy, trust pages, and the core user action before adding new promises.",
};

const OUTPUT_COPY = {
  checklist: "Checklist: convert the path into a step-by-step execution list.",
  page: "Landing page plan: make the promise, proof, and next action visible.",
  data: "Data plan: define what is collected, why it is useful, and how it is protected.",
  monetization: "Monetization path: attach revenue to the moment value is created.",
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getFormValues(form) {
  const formData = new FormData(form);
  const path = formData.get("path") || "llc";
  const outputs = formData.getAll("output");

  return {
    path,
    goal: String(formData.get("goal") || "").trim(),
    timeline: formData.get("timeline") || "today",
    stage: formData.get("stage") || "idea",
    outputs: outputs.length ? outputs : ["checklist", "page", "monetization"],
  };
}

function buildPlan(values) {
  const path = PATH_COPY[values.path] || PATH_COPY.llc;
  const goal = values.goal || "Create a useful first version that can be tested before more money or complexity is added.";
  const selectedOutputCopy = values.outputs.map((item) => OUTPUT_COPY[item]).filter(Boolean);

  return {
    title: `${path.label}: first launch path`,
    promise: path.promise,
    goal,
    timeline: TIMELINE_COPY[values.timeline] || TIMELINE_COPY.today,
    stage: STAGE_COPY[values.stage] || STAGE_COPY.idea,
    firstMoves: path.firstMoves,
    checklist: path.checklist,
    monetization: path.monetization,
    dataPlan: path.dataPlan,
    outputs: selectedOutputCopy,
  };
}

function listItems(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderPlan(plan) {
  return `
    <div class="plan-badge-row">
      <span class="plan-badge">Free plan</span>
      <span class="plan-badge">No payment triggered</span>
      <span class="plan-badge">Formed. intake</span>
    </div>
    <section class="plan-block">
      <h2>${escapeHtml(plan.title)}</h2>
      <p class="plan-meta">${escapeHtml(plan.promise)}</p>
    </section>
    <section class="plan-block">
      <h3>Goal</h3>
      <p>${escapeHtml(plan.goal)}</p>
    </section>
    <section class="plan-block">
      <h3>Operating constraint</h3>
      <ul>
        <li>${escapeHtml(plan.timeline)}</li>
        <li>${escapeHtml(plan.stage)}</li>
      </ul>
    </section>
    <section class="plan-block">
      <h3>First moves</h3>
      <ol>${listItems(plan.firstMoves)}</ol>
    </section>
    <section class="plan-block">
      <h3>Build checklist</h3>
      <ul>${listItems(plan.checklist)}</ul>
    </section>
    <section class="plan-block">
      <h3>Requested outputs</h3>
      <ul>${listItems(plan.outputs)}</ul>
    </section>
    <section class="plan-block">
      <h3>Monetization path</h3>
      <ul>${listItems(plan.monetization)}</ul>
    </section>
    <section class="plan-block">
      <h3>Data trust plan</h3>
      <ul>${listItems(plan.dataPlan)}</ul>
    </section>
  `;
}

function persist(values, plan) {
  try {
    sessionStorage.setItem(
      "formed-start-plan",
      JSON.stringify({ values, plan, createdAt: new Date().toISOString() }),
    );
  } catch {
    // Session storage is optional. The intake still works without it.
  }
}

function restore(form, output) {
  try {
    const saved = JSON.parse(sessionStorage.getItem("formed-start-plan") || "null");
    if (!saved?.values || !saved?.plan) return;

    const pathInput = form.querySelector(`input[name="path"][value="${saved.values.path}"]`);
    if (pathInput) pathInput.checked = true;
    form.elements.goal.value = saved.values.goal || "";
    form.elements.timeline.value = saved.values.timeline || "today";
    form.elements.stage.value = saved.values.stage || "idea";

    form.querySelectorAll('input[name="output"]').forEach((input) => {
      input.checked = saved.values.outputs.includes(input.value);
    });

    output.classList.remove("empty-state");
    output.innerHTML = renderPlan(saved.plan);
  } catch {
    // Ignore invalid saved state.
  }
}

function init() {
  const form = document.getElementById("formed-intake");
  const output = document.getElementById("plan-output");
  if (!form || !output) return;

  restore(form, output);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = getFormValues(form);
    const plan = buildPlan(values);
    output.classList.remove("empty-state");
    output.innerHTML = renderPlan(plan);
    persist(values, plan);
    output.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  form.addEventListener("reset", () => {
    setTimeout(() => {
      try {
        sessionStorage.removeItem("formed-start-plan");
      } catch {}
      output.classList.add("empty-state");
      output.innerHTML = `
        <h2>Your launch path will appear here.</h2>
        <p>Choose a path, define the goal, then generate a structured action plan.</p>
      `;
    }, 0);
  });
}

init();
