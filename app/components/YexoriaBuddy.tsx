"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "@/src/lib/session";
import "./yexoria-buddy.css";

/* ------------------------------------------------------------------ types */

type BuddyRole = "accountant" | "client";

type StepState = "pending" | "running" | "done" | "failed";

type RunStep = { label: string; state: StepState };

type RunLink = { label: string; href: string };

type Message =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "buddy"; text: string; chips?: string[] }
  | {
      id: string;
      kind: "run";
      title: string;
      steps: RunStep[];
      startedAt: number;
      endedAt: number | null;
      result: string | null;
      link: RunLink | null;
      failed: boolean;
    };

type StepFn = (ctx: RunContext) => Promise<string | void>;

type Plan = {
  title: string;
  steps: { label: string; run: StepFn }[];
  link?: RunLink;
};

type RunContext = {
  token: () => Promise<string>;
  navigate: (href: string) => void;
  notes: string[];
  signal: AbortSignal;
};

type ClientRow = { id: string; name: string; email: string; status: string; assignedAccountantName?: string };
type EntityRow = { id: string; name: string; entityType: string };

/* --------------------------------------------------------------- helpers */

const MIN_STEP_MS = 450;
const uid = () => Math.random().toString(36).slice(2, 10);

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(t);
      reject(new DOMException("Stopped", "AbortError"));
    });
  });
}

function formatElapsed(ms: number) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function getJson<T>(path: string, token: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

/* ----------------------------------------------------- command → plan */

// buddy-mode: the buddy runs three fixed pointers per role. Anything else gets
// the "still under development" reply below.
const SUGGESTIONS: Record<BuddyRole, string[]> = {
  accountant: ["How many clients do I have?", "Find client Priya", "Invite a new client"],
  client: ["List my entities", "Add a new entity", "Add a transaction"],
};

const CAPABILITIES: Record<BuddyRole, string> = {
  accountant: "Right now I can summarise your clients, find a client, or start a client invite.",
  client: "Right now I can list your entities, start a new entity, or start a new transaction.",
};

const UNDER_DEVELOPMENT =
  "This feature is still under development. It will be updated soon. Meanwhile, try one of these:";

function go(label: string, href: string, title: string): Plan {
  return {
    title,
    link: { label, href },
    steps: [
      { label: "Understanding your request", run: async () => undefined },
      {
        label: `Opening ${label}`,
        run: async (ctx) => {
          ctx.navigate(href);
          return `${label} is open.`;
        },
      },
    ],
  };
}

function planFor(role: BuddyRole, raw: string): Plan | null {
  const text = raw.toLowerCase().trim();
  const has = (...words: string[]) => words.some((w) => text.includes(w));

  if (role === "accountant") {
    const find = text.match(/(?:find|search|look ?up)\s+(?:for\s+)?(?:a\s+)?(?:client\s+)?(.+)/);
    if (has("how many", "count", "summary", "overview") && has("client")) {
      return {
        title: "Counting your clients",
        link: { label: "Clients", href: "/dashboard/accountant/clients" },
        steps: [
          { label: "Understanding your request", run: async () => undefined },
          {
            label: "Fetching clients from your organisation",
            run: async (ctx) => {
              const data = await getJson<{ clients?: ClientRow[] }>(
                "/api/users/me/clients",
                await ctx.token(),
                ctx.signal,
              );
              const list = data.clients || [];
              const active = list.filter((c) => /active/i.test(c.status)).length;
              ctx.notes.push(
                `You have **${list.length} clients**, ${active} active and ${list.length - active} still pending.`,
              );
            },
          },
          { label: "Preparing the summary", run: async (ctx) => ctx.notes.join(" ") },
        ],
      };
    }
    if (has("invite")) {
      return go("the invite form", "/dashboard/accountant/clients?invite=1", "Starting a client invite");
    }
    if (find) {
      const query = find[1].replace(/[?.!]+$/, "").trim();
      return {
        title: `Looking up “${query}”`,
        link: { label: "Search results", href: `/dashboard/accountant/clients?q=${encodeURIComponent(query)}` },
        steps: [
          { label: "Understanding your request", run: async () => undefined },
          {
            label: "Searching your clients",
            run: async (ctx) => {
              const data = await getJson<{ clients?: ClientRow[] }>(
                "/api/users/me/clients",
                await ctx.token(),
                ctx.signal,
              );
              const hits = (data.clients || []).filter((c) =>
                `${c.name} ${c.email}`.toLowerCase().includes(query.toLowerCase()),
              );
              ctx.notes.push(
                hits.length
                  ? `Found **${hits.length} ${hits.length === 1 ? "match" : "matches"}**: ${hits
                      .slice(0, 4)
                      .map((c) => `${c.name}${c.assignedAccountantName ? ` (with ${c.assignedAccountantName})` : ""}`)
                      .join(", ")}.`
                  : `No client matches “${query}”.`,
              );
            },
          },
          {
            label: "Opening the client list",
            run: async (ctx) => {
              ctx.navigate(`/dashboard/accountant/clients?q=${encodeURIComponent(query)}`);
              return ctx.notes.join(" ");
            },
          },
        ],
      };
    }
    return null;
  }

  // client
  if (has("entit") && has("add", "new", "create", "register")) {
    return go("a new entity", "/dashboard/client/entities/new", "Starting a new entity");
  }
  if (has("entit", "summary", "overview", "what do i have")) {
    return {
      title: "Listing your entities",
      link: { label: "Your entities", href: "/dashboard/client/entities" },
      steps: [
        { label: "Understanding your request", run: async () => undefined },
        {
          label: "Fetching your entities",
          run: async (ctx) => {
            const data = await getJson<{ items?: EntityRow[] }>("/api/entities", await ctx.token(), ctx.signal);
            const list = data.items || [];
            ctx.notes.push(
              list.length
                ? `You have **${list.length} entities**: ${list
                    .map((e) => `${e.name} (${titleCase(e.entityType)})`)
                    .join(", ")}.`
                : "You haven't added an entity yet. Say “add a new entity” and I'll start one.",
            );
          },
        },
        { label: "Preparing the summary", run: async (ctx) => ctx.notes.join(" ") },
      ],
    };
  }
  if (has("add", "new", "create", "record") && has("transaction", "expense", "income", "invoice")) {
    return go("a new transaction", "/dashboard/client/transactions/new", "Starting a new transaction");
  }
  return null;
}

/* ---------------------------------------------------------- welcome data */

type IconName = "users" | "search" | "invite" | "receipt" | "list" | "rules" | "building" | "user" | "spark";

type Tone = "violet" | "amber" | "sage" | "rose";

const CARDS: Record<BuddyRole, { icon: IconName; tone: Tone; title: string; sub: string; command: string }[]> = {
  accountant: [
    { icon: "users", tone: "violet", title: "Client summary", sub: "Count active and pending clients", command: "How many clients do I have?" },
    { icon: "search", tone: "amber", title: "Find a client", sub: "Search by name or email", command: "Find client Priya" },
    { icon: "invite", tone: "sage", title: "Invite a client", sub: "Open the invite form", command: "Invite a new client" },
  ],
  client: [
    { icon: "building", tone: "violet", title: "My entities", sub: "See every entity you own", command: "List my entities" },
    { icon: "spark", tone: "amber", title: "Add an entity", sub: "Company, trust or SMSF", command: "Add a new entity" },
    { icon: "receipt", tone: "sage", title: "Add transaction", sub: "Income or expense", command: "Add a transaction" },
  ],
};

const ORBIT: Record<BuddyRole, { icon: IconName; label: string; command: string }[]> = {
  accountant: [
    { icon: "users", label: "Client summary", command: "How many clients do I have?" },
    { icon: "search", label: "Find a client", command: "Find client Priya" },
    { icon: "invite", label: "Invite", command: "Invite a new client" },
  ],
  client: [
    { icon: "building", label: "My entities", command: "List my entities" },
    { icon: "spark", label: "New entity", command: "Add a new entity" },
    { icon: "receipt", label: "Add transaction", command: "Add a transaction" },
  ],
};

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    users: (
      <>
        <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
        <circle cx="9.5" cy="7" r="3.5" />
        <path d="M20 19v-1a3.4 3.4 0 0 0-2.6-3.3M15.6 3.8a3.6 3.6 0 0 1 0 6.6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </>
    ),
    invite: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
        <path d="M9 8h6M9 12h6M12 15v0" />
      </>
    ),
    list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
    rules: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" />,
    building: (
      <>
        <rect x="4" y="3" width="11" height="18" rx="1.5" />
        <path d="M15 9h4a1 1 0 0 1 1 1v11M8 7h3M8 11h3M8 15h3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" />
      </>
    ),
    spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="txb-ico">
      {paths[name]}
    </svg>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/* ------------------------------------------------------------- character */

/** Glossy little robot: pearl shell, dark visor, glowing violet eyes. */
export function BuddyBot({ size = 120, mood = "idle" }: { size?: number; mood?: "idle" | "thinking" }) {
  const id = `b${size}`;
  return (
    <svg className={`txb-bot is-${mood}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-shell`} cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".55" stopColor="#EEF1FA" />
          <stop offset="1" stopColor="#C6CEEA" />
        </radialGradient>
        <radialGradient id={`${id}-body`} cx="40%" cy="20%" r="90%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#CDD5EF" />
        </radialGradient>
        <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E2654" />
          <stop offset="1" stopColor="#0F1330" />
        </linearGradient>
        <radialGradient id={`${id}-ear`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#E4E9F9" />
          <stop offset="1" stopColor="#4A56A6" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* body */}
      <path d="M30 120c0-20 13-31 30-31s30 11 30 31z" fill={`url(#${id}-body)`} />
      <circle cx="60" cy="104" r="3.2" fill="none" stroke="#9FAAE0" strokeWidth="1.4" />
      {/* ears */}
      <ellipse cx="22" cy="52" rx="7.5" ry="11" fill={`url(#${id}-ear)`} />
      <ellipse cx="98" cy="52" rx="7.5" ry="11" fill={`url(#${id}-ear)`} />
      {/* head */}
      <rect x="24" y="16" width="72" height="70" rx="34" fill={`url(#${id}-shell)`} />
      <ellipse cx="44" cy="26" rx="12" ry="5" fill="#fff" opacity=".9" />
      {/* visor */}
      <rect x="32" y="33" width="56" height="40" rx="19" fill={`url(#${id}-visor)`} />
      <rect x="35" y="35.5" width="50" height="10" rx="5" fill="#fff" opacity=".07" />
      {/* face */}
      <g className="txb-bot-eyes" filter={`url(#${id}-glow)`} fill="#DDE3F7">
        <rect x="45" y="46" width="7" height="11" rx="3.5" />
        <rect x="68" y="46" width="7" height="11" rx="3.5" />
      </g>
      <path
        className="txb-bot-mouth"
        d="M54 63c3.6 3 8.4 3 12 0"
        stroke="#DDE3F7"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        filter={`url(#${id}-glow)`}
      />
      {/* antenna light */}
      <circle className="txb-bot-led" cx="60" cy="12" r="3.6" fill="#2E387A" />
      <path d="M60 15.5V18" stroke="#C6CEEA" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Orb({ size, mood, bot = true }: { size: number; mood?: "idle" | "thinking"; bot?: boolean }) {
  return (
    <span className={`txb-orb ${mood === "thinking" ? "is-thinking" : ""}`} style={{ width: size, height: size }}>
      <i className="txb-orb-glow" />
      {bot ? <BuddyBot size={Math.round(size * 0.82)} mood={mood} /> : null}
    </span>
  );
}

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

/* ------------------------------------------------------------- speech */

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/* ------------------------------------------------------------ component */

export default function YexoriaBuddy({ role, email }: { role: BuddyRole; email?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [quickOpen, setQuickOpen] = useState(false);
  // The buddy only mounts after the client-side session check, so window is available here.
  const [canListen] = useState(() => Boolean(getRecognition()));
  const [listening, setListening] = useState(false);
  const [hello] = useState(greeting);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const firstName = useMemo(() => {
    const local = (email || "").split("@")[0] || "";
    const word = local.split(/[._-]/)[0] || "";
    return word ? word[0].toUpperCase() + word.slice(1) : "";
  }, [email]);

  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [busy]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setQuickOpen((q) => {
          if (!q) setOpen(false);
          return false;
        });
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => recRef.current?.stop(), []);

  const patchRun = useCallback((id: string, patch: (m: Extract<Message, { kind: "run" }>) => Partial<Message>) => {
    setMessages((list) =>
      list.map((m) => (m.id === id && m.kind === "run" ? ({ ...m, ...patch(m) } as Message) : m)),
    );
  }, []);

  const send = useCallback(
    async (input: string) => {
      const text = input.trim();
      if (!text || busy) return;
      setDraft("");
      setQuickOpen(false);
      const userMsg: Message = { id: uid(), kind: "user", text };
      const plan = planFor(role, text);

      if (!plan) {
        setMessages((l) => [
          ...l,
          userMsg,
          {
            id: uid(),
            kind: "buddy",
            text: /^(hi|hello|hey|help)\b/i.test(text)
              ? `Hi${firstName ? ` ${firstName}` : ""}! ${CAPABILITIES[role]}`
              : UNDER_DEVELOPMENT,
            chips: SUGGESTIONS[role],
          },
        ]);
        return;
      }

      const runId = uid();
      const startedAt = Date.now();
      setNow(startedAt);
      setBusy(true);
      setMessages((l) => [
        ...l,
        userMsg,
        {
          id: runId,
          kind: "run",
          title: plan.title,
          steps: plan.steps.map((s) => ({ label: s.label, state: "pending" })),
          startedAt,
          endedAt: null,
          result: null,
          link: plan.link ?? null,
          failed: false,
        },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      const ctx: RunContext = {
        notes: [],
        signal: controller.signal,
        navigate: (href) => router.push(href),
        token: async () => {
          const session = await getSession();
          if (!session) throw new Error("Your session has expired. Please sign in again.");
          return session.getIdToken().getJwtToken();
        },
      };

      let result = "";
      let failed = false;
      for (let i = 0; i < plan.steps.length; i += 1) {
        patchRun(runId, (m) => ({ steps: m.steps.map((s, j) => (j === i ? { ...s, state: "running" } : s)) }));
        try {
          const [out] = await Promise.all([plan.steps[i].run(ctx), wait(MIN_STEP_MS, controller.signal)]);
          if (typeof out === "string" && out) result = out;
          patchRun(runId, (m) => ({ steps: m.steps.map((s, j) => (j === i ? { ...s, state: "done" } : s)) }));
        } catch (error) {
          failed = true;
          const stopped = error instanceof DOMException && error.name === "AbortError";
          result = stopped ? "Stopped. Nothing else was changed." : `That didn't work: ${(error as Error).message}`;
          patchRun(runId, (m) => ({ steps: m.steps.map((s, j) => (j === i ? { ...s, state: "failed" } : s)) }));
          break;
        }
      }
      patchRun(runId, () => ({ endedAt: Date.now(), result: result || "Done.", failed }));
      setBusy(false);
      abortRef.current = null;
    },
    [busy, firstName, patchRun, role, router],
  );

  function toggleListening() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Rec = getRecognition();
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = "en-AU";
    rec.interimResults = true;
    rec.onresult = (event) => {
      const said = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setDraft(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const cards = CARDS[role];
  const orbit = ORBIT[role];
  const empty = messages.length === 0;

  return (
    <div className={`txb ${open ? "is-open" : ""}`}>
      <section className="txb-panel" role="dialog" aria-label="Yexoria Buddy" aria-hidden={!open}>
        <header className="txb-head">
          <div className="txb-head-id">
            <Orb size={36} mood={busy ? "thinking" : "idle"} />
            <span>
              <strong>Yexoria Buddy</strong>
              <em className={busy ? "is-busy" : ""}>
                <i aria-hidden="true" />
                {busy ? "Working on it…" : "Online · acts in your workspace"}
              </em>
            </span>
          </div>
          <div className="txb-head-actions">
            <button
              type="button"
              className="txb-icon"
              aria-label="New chat"
              title="New chat"
              disabled={busy || empty}
              onClick={() => setMessages([])}
            >
              <svg viewBox="0 0 24 24"><path d="M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            </button>
            <button type="button" className="txb-icon" aria-label="Close" title="Close (Esc)" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        </header>

        <div className="txb-body" ref={listRef}>
          {empty ? (
            <div className="txb-welcome">
              <div className="txb-stage">
                <Orb size={168} />
                {orbit.map((o, i) => (
                  <button
                    key={o.label}
                    type="button"
                    className={`txb-float is-${i}`}
                    onClick={() => send(o.command)}
                  >
                    <Icon name={o.icon} />
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="txb-hello">
                {hello}
                {firstName ? `, ${firstName}` : ""}!
              </p>
              <h2>What can I help you with?</h2>
              <div className="txb-cards">
                {cards.map((c) => (
                  <button key={c.title} type="button" className={`txb-card is-${c.tone}`} onClick={() => send(c.command)}>
                    <span className="txb-card-ico">
                      <Icon name={c.icon} />
                    </span>
                    <strong>{c.title}</strong>
                    <span>{c.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              if (m.kind === "user") {
                return (
                  <div key={m.id} className="txb-row is-user">
                    <p className="txb-bubble">{m.text}</p>
                  </div>
                );
              }
              if (m.kind === "buddy") {
                return (
                  <div key={m.id} className="txb-row is-buddy">
                    <Orb size={30} />
                    <div>
                      <p className="txb-say">
                        <Rich text={m.text} />
                      </p>
                      {m.chips ? (
                        <div className="txb-chips is-inline">
                          {m.chips.map((c) => (
                            <button key={c} type="button" onClick={() => send(c)} disabled={busy}>
                              {c}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }
              const elapsed = (m.endedAt ?? now) - m.startedAt;
              const done = m.steps.filter((s) => s.state === "done").length;
              const running = m.endedAt === null;
              return (
                <div key={m.id} className="txb-row is-buddy">
                  <Orb size={30} mood={running ? "thinking" : "idle"} />
                  <div className="txb-run-wrap">
                    <article className={`txb-run ${running ? "is-running" : m.failed ? "is-failed" : "is-done"}`}>
                      <header>
                        <span className="txb-run-title">
                          <i aria-hidden="true" />
                          {m.title}
                        </span>
                        <span className="txb-timer" aria-label="Elapsed time">
                          <svg viewBox="0 0 16 16" aria-hidden="true">
                            <circle cx="8" cy="9" r="5.5" />
                            <path d="M8 6.5V9l1.6 1.2M6.5 2h3" />
                          </svg>
                          {formatElapsed(elapsed)}
                        </span>
                      </header>
                      <div className="txb-bar" aria-hidden="true">
                        <span style={{ width: `${(done / m.steps.length) * 100}%` }} />
                      </div>
                      <ol>
                        {m.steps.map((s, i) => (
                          <li key={i} className={`is-${s.state}`}>
                            <span className="txb-tick" aria-hidden="true">
                              {s.state === "done" ? (
                                <svg viewBox="0 0 16 16"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>
                              ) : s.state === "failed" ? (
                                <svg viewBox="0 0 16 16"><path d="M5 5l6 6M11 5l-6 6" /></svg>
                              ) : null}
                            </span>
                            {s.label}
                          </li>
                        ))}
                      </ol>
                      {!running ? (
                        <footer>
                          <span>
                            {m.failed ? "Stopped" : "Done"} in {(elapsed / 1000).toFixed(1)}s · {done}/{m.steps.length} steps
                          </span>
                          {m.link && !m.failed && pathname !== m.link.href.split("?")[0] ? (
                            <button type="button" onClick={() => router.push(m.link!.href)}>
                              Open {m.link.label} →
                            </button>
                          ) : null}
                        </footer>
                      ) : null}
                    </article>
                    {m.result ? (
                      <p className="txb-say">
                        <Rich text={m.result} />
                      </p>
                    ) : (
                      <p className="txb-typing" aria-label="Buddy is working">
                        <i /> <i /> <i />
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!empty ? (
          <div className="txb-suggest" aria-label="Suggestions">
            {cards.map((c) => (
              <button key={c.title} type="button" className={`is-${c.tone}`} onClick={() => send(c.command)} disabled={busy}>
                <Icon name={c.icon} />
                {c.title}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="txb-composer"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          {open && quickOpen ? (
            <div className="txb-quick" role="menu">
              <p>Quick actions</p>
              {SUGGESTIONS[role].map((s) => (
                <button key={s} type="button" role="menuitem" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <div className="txb-box">
            <textarea
              ref={inputRef}
              rows={2}
              value={draft}
              placeholder={busy ? "Buddy is working…" : listening ? "Listening…" : "Ask me anything…"}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send(draft);
                }
              }}
              aria-label="Message Yexoria Buddy"
            />
            <div className="txb-box-row">
              <button
                type="button"
                className={`txb-plus ${quickOpen ? "is-on" : ""}`}
                aria-label="Quick actions"
                aria-expanded={quickOpen}
                onClick={() => setQuickOpen((q) => !q)}
              >
                <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              <span className="txb-mode">
                <b>Yexoria Buddy</b> Actions
              </span>
              {canListen ? (
                <button
                  type="button"
                  className={`txb-mic ${listening ? "is-on" : ""}`}
                  aria-label={listening ? "Stop listening" : "Speak a command"}
                  onClick={toggleListening}
                  disabled={busy}
                >
                  <svg viewBox="0 0 24 24"><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /><rect x="9" y="3" width="6" height="12" rx="3" /></svg>
                </button>
              ) : null}
              {busy ? (
                <button type="button" className="txb-send is-stop" aria-label="Stop" onClick={() => abortRef.current?.abort()}>
                  <svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
                </button>
              ) : (
                <button type="submit" className="txb-send" aria-label="Send" disabled={!draft.trim()}>
                  <svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9" /></svg>
                </button>
              )}
            </div>
          </div>
          <p className="txb-hint">Buddy only acts inside Yexoria · ⌘K to open</p>
        </form>
      </section>

      <button
        type="button"
        className="txb-launcher"
        aria-label={open ? "Close Yexoria Buddy" : "Open Yexoria Buddy"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="txb-launcher-label">
          <b>Hi{firstName ? ` ${firstName}` : ""}!</b> Need a hand?
        </span>
        <span className="txb-launcher-face">
          <Orb size={68} mood={busy ? "thinking" : "idle"} />
          <i className={busy ? "is-busy" : ""} />
        </span>
      </button>
    </div>
  );
}
