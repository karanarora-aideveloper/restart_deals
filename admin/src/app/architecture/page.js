'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AdminShell from '@/components/admin-shell';
import SystemFlowDiagram from '@/components/system-flow-diagram';
import BestsellerCrawlerPanel from '@/components/bestseller-crawler-panel';
import TelegramChannelsPanel from '@/app/network/input/page';

// Plain-language description shown under the node title in the side panel.
const DESCRIPTIONS = {
  // Producers
  'producer-telegram': 'GramJS Live Event Handler & 30s Poller: Captures real-time shopping deal posts from monitored Telegram channels. Pushes to Redis BullMQ at Priority 2.',
  'producer-refresher': '24-Hour Autonomous Price Refresher: Regularly queries products in MongoDB whose lastChecked is older than 24 hours. Normalizes daily checkpoints and pushes to BullMQ at Priority 3.',
  'producer-crawler': 'Category Bestseller Discovery Engine: Runs on an admin-configurable schedule (default every 24h — Settings → Bestseller Crawler) across every Master subcategory\'s keyword seed, extracting the top-N ranked Amazon search results per seed. Pushes to BullMQ at Priority 4.',
  'producer-interactive': 'On-Demand Interactive Live Re-check: Triggered when a user clicks "Re-check Live Price" or pastes a URL in the search bar. Pushes to BullMQ at Priority 1 (Urgent Head of Line).',

  // Normalization & AI
  'step-resolve': 'URL Unshortener & Canonical Identifier: Resolves 3xx redirect chains with realistic browser headers and extracts the canonical Amazon ASIN, Flipkart PID, or Myntra style ID.',
  'step-deepseek': 'DeepSeek NLP AI Parser: Extracts structured deal details (title, dealPrice, originalPrice/MRP, discountPercentage, dynamic category from Master DB, and promo coupon codes).',
  'step-dedup': '60-Minute Deduplicator: Checks recent deal history by canonical dealUrl to prevent re-scraping and duplicate alerts within a 1-hour window.',

  // BullMQ & Scraping Engine
  'node-bullmq': 'Distributed Redis BullMQ Queue: Central message broker coordinating all scraping tasks across multiple server machines with 4-tier priority scheduling.',
  'node-limiter': 'Global Distributed Rate Limiter: Enforces strictly 1 request every 2.5 seconds globally, guaranteeing zero 409 concurrency limit collisions with ScrapingAnt.',
  'node-worker': 'Dedicated Scraper Worker & Token Rotation: Leases active tokens from MongoDB Atlas with least-recently-used rotation, headless Chrome rendering, and country proxy routing (&country=IN / &country=US).',
  'node-logs': 'Scraping Activity Logger: Records full request latency, response status, masked token key, and extracted metadata in ScrapingLog collection (inspected at /settings/tokens).',

  // Data Integrity & Gate
  'node-upsert-product': 'Canonical Product Record: Upserts the products collection with high-res images, clean title, canonical MRP, and merchant source.',
  'node-history': 'Daily Normalized Price History Checkpoints: Chronological price points formatted for smooth cubic Bezier spline curves and interactive crosshairs.',
  'node-subset-gate': 'Deals ⊆ Products Subset Invariant Gate: Ensures 100% of all deals link to a valid product record with zero orphan deals in the database.',
  'node-synthesizer': 'Autonomous Deal Synthesizer: Detects >= 15% price drops against product price history and automatically synthesizes and activates deals in the feed.',

  // Omnichannel Outputs
  'out-telegram': 'Telegram Deal Channels: Formats rich HTML messages with price, discount badges, ratings, and affiliate buy links.',
  'out-whatsapp': 'WhatsApp Community Groups: Publishes formatted deal alerts with image previews to active broadcast groups.',
  'out-twitter': 'Twitter / X Bot: Automatically tweets verified US and India deals with media uploads at scheduled posting windows.',
  'out-algolia': 'Algolia Search Engine: Real-time full-text index synchronization for instant sub-millisecond search across deals and products.',
  'out-webapp': 'Web & Mobile App Feed: Responsive frontend feed with live price tracking, interactive trend charts, and deal badges.',
};

// Known open issues (see the "Backend Flow" diagram) — shown as a callout when present.
const ISSUE_NOTES = {};

// Implementation status for nodes NOT fully live/autonomous, verified against
// the actual code 2026-08-29 (see system-flow-diagram.jsx's `implemented`
// field on these same node ids). Nodes with no entry here are fully
// implemented and confirmed running.
const IMPLEMENTATION_NOTES = {
  'producer-interactive': {
    kind: 'partial',
    title: 'Partial — backend ready, no frontend trigger found',
    text: "PRIORITY.INTERACTIVE is real and wired into 3 call sites in api/src/routes/products.js, so a request hitting those routes does get urgent-priority scraping. But there's no \"Re-check Live Price\" button or URL-paste-to-search flow anywhere in frontend/src — cleanUrl there is only ever used to build the affiliate buy link, never to trigger a re-scrape. The backend capability exists; the user-facing trigger described here doesn't yet.",
  },
  'node-subset-gate': {
    kind: 'partial',
    title: 'Partial — not an active, enforced gate',
    text: "Deal.productId is typed as a plain String with no required:true, no ref/foreign-key relationship to Product, and no audit job or validation query anywhere in the codebase (confirmed by grepping for orphan checks and schema constraints). In practice deals are almost always created alongside a product upsert, so the invariant usually holds — but nothing actively checks or guarantees it. It's an emergent property of the code flow, not an enforced gate.",
  },
};

// Each entry is an array of {n, text, label?} — label defaults to "Fixed" but a node can carry
// more than one note (e.g. ai-parser has two separate fixes), and #9 is a "New" capability, not a fix.
const FIXED_NOTES = {
  'cond-product': [{
    n: 1,
    text: 'Previously only the first URL in a message (urls[0]) was ever tried — an intro link or a search-result link before the real product link silently killed the whole message. The verifier now loops every candidate URL and requires isProductUrl:true.',
  }],
  'loop-resolve': [{
    n: 2,
    text: "fetch() sent no headers at all — Node's default User-Agent is literally the string \"node\", about as clear a bot signature as exists. Confirmed: Node's fetch sends Accept-Language: '*' and User-Agent: 'node' by default. Several redirect/shortener services gate on exactly that, serving a JS interstitial or blocking outright instead of a clean 3xx. Both the HEAD and GET attempts now send a real Chrome User-Agent + Accept/Accept-Language headers.",
  }],
  'queue': [{
    n: 3,
    text: "lastSeenMessageId used to only advance inside the poller's own tick, so a message the live handler just processed could still look \"new\" to the next poll cycle — burning a redirect-resolution pass and double-counting messagesCapturedCount. Unified into one lastEnqueuedMessageId map that both the live handler and the poller claim message IDs in, so whichever sees a message first is the only one that enqueues it.",
  }],
  'live-event': [{
    n: 4,
    text: "message.photo was never read — now a new downloadMessagePhoto() util (backend/src/utils/telegramMedia.js) lazily downloads it and serves it at /media/telegram/<file>, only when step 8's abort path actually needs it.",
  }],
  'cond-images': [{
    n: 5,
    text: "A failed scrape with nothing cached used to discard the deal outright. It now falls back to the Telegram post's own photo for the Deal record (never the shared Product record, so future scrapes still retry for a real photo). Only a text-only post with a failed scrape still aborts.",
  }],
  'input-tg': [{
    n: 6,
    text: "Checked against live data — false alarm in practice (real active channels' messagesCapturedCount was incrementing correctly; matchedId arrives bare-digit from this GramJS version, matching what's stored). Fixed the underlying fragility anyway: Channel.updateOne() now normalizes the ID once (toBareChannelId(), anchored to a leading -100/-) instead of the old unanchored $or that would have silently no-op'd if a caller ever passed an already-prefixed ID.",
  }],
  'ai-parser': [
    {
      n: 7,
      text: "The system prompt correctly asked DeepSeek to pick from the live Master category list (general/electronics/fashion/home/beauty), but the code collapsed the answer to category === 'fitness' ? 'fitness' : 'general' — discarding every other category regardless of what the AI returned. Confirmed live: every Deal since 2026-08-05 17:10 UTC was 'general', including obvious fashion/electronics items. Now validates against the actual fetched category list instead.",
    },
    {
      n: 8,
      text: "The user message sent to DeepSeek labeled productDetails.price as \"Scraped Webpage Deal Price\" and the system prompt said to prioritize it over the Telegram text — but this call runs BEFORE any scraping happens this run, so that \"scraped\" price was always just whatever was last cached, sometimes itself AI-guessed. Proved it live: a message saying \"crashed to just Rs 60\" for a product cached at ₹147 came back as dealPrice: 147 every time. Reworded the prompt to trust the message text first, cached price only as a fallback when the message states none.",
    },
    {
      n: 10,
      label: 'New',
      text: "Coupon extraction. Deal posts often advertise an extra coupon the shopper ticks/enters on the merchant page for a further saving ON TOP of the deal price (\"Apply 2% coupon\", \"Use code SAVE20\"). The AI now returns a coupon object — {type: 'percent'|'flat'|'code', value, code, label} — validated by normalizeCoupon() before it's stored (drops half-filled results, percent values >100, and anything with neither a value nor a code). Verified against real messages: the coupon repeated twice in one post is returned once, and bank-card offers are correctly NOT treated as coupons. Stored on Deal (not Product — it's per-post and expires), and surfaced in the app, the admin table, and all three publishers.",
    },
  ],
  'price-history': [{
    n: 9,
    label: 'New',
    text: "Not a bug fix — added on request. When no scraped/text discount exists, compares the AI-parsed dealPrice against this exact product's last recorded price instead of rejecting outright (we don't track how recently that cached price was itself verified, so it's used anyway rather than blocking a legitimate deal). Always best-effort — shown even at 0% — but previousPrice is only set, and it only counts as a genuine tracked \"price drop\", at 5%+. New fields: previousPrice and priceSource ('scraped' | 'ai_text' | 'price_history') on both Product and Deal.",
  }],
};

export default function ArchitecturePage() {
  const [statusData, setStatusData] = useState({});
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    const headers = { ...(options.headers || {}), ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}) };
    return fetch(url, { ...options, headers });
  }, [apiBase, adminApiKey]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/status');
      if (!res.ok) return;
      const data = await res.json();
      setStatusData(data);
    } catch (err) {
      console.error('Fetch status error:', err);
    }
  }, [apiFetch]);

  const [selectedNode, setSelectedNode] = useState(null);

  // This page is the single home for "manage every source that produces deals" — Telegram
  // channels and the Bestseller Crawler each get their own sub-tab — plus the existing
  // pipeline diagram/live-log diagnostic view, kept as a second top-level tab rather than
  // dropped, since it's still the clearest place to see what's actually implemented.
  const [mainTab, setMainTab] = useState('sources');
  const [sourceTab, setSourceTab] = useState('telegram');

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  // Live backend log stream, embedded directly on the diagram so activity in
  // the pipeline can be watched alongside the nodes it's flowing through —
  // same Redis-backed feed as the standalone /logs page (GET /api/admin/logs),
  // just polled here inline instead of on its own page.
  const [showLiveLogs, setShowLiveLogs] = useState(true);
  const [liveLogs, setLiveLogs] = useState([]);
  const [logsConnected, setLogsConnected] = useState(null);
  const lastLogTsRef = useRef(null);
  const logsBottomRef = useRef(null);
  const logsContainerRef = useRef(null);

  const fetchLiveLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '150' });
      if (lastLogTsRef.current) params.set('since', lastLogTsRef.current);
      const res = await apiFetch(`/api/admin/logs?${params}`);
      if (!res.ok) { setLogsConnected(false); return; }
      const data = await res.json();
      setLogsConnected(true);
      if (!data.logs?.length) return;
      setLiveLogs((prev) => {
        const combined = lastLogTsRef.current ? [...prev, ...data.logs] : data.logs;
        const seen = new Set();
        const deduped = combined.filter((l) => { const k = l.ts + l.msg; if (seen.has(k)) return false; seen.add(k); return true; });
        const trimmed = deduped.slice(-300);
        lastLogTsRef.current = trimmed[trimmed.length - 1]?.ts || null;
        return trimmed;
      });
    } catch {
      setLogsConnected(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!showLiveLogs) return;
    fetchLiveLogs();
    const timer = setInterval(fetchLiveLogs, 2000);
    return () => clearInterval(timer);
  }, [showLiveLogs, fetchLiveLogs]);

  useEffect(() => {
    const el = logsContainerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
      logsBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs]);

  const LOG_LEVEL_COLOR = { info: '#cbd5e1', warn: '#f5a623', error: '#e74c3c' };

  function formatLogTs(iso) {
    try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
    catch { return iso; }
  }

  const handlePrint = () => {
    window.print();
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const issueNote = selectedNode ? ISSUE_NOTES[selectedNode.id] : null;
  const fixedNotes = selectedNode ? FIXED_NOTES[selectedNode.id] : null;
  const implNote = selectedNode ? IMPLEMENTATION_NOTES[selectedNode.id] : null;

  return (
    <AdminShell title="System Architecture">
      <section
        className="view-section active-view"
        style={mainTab === 'diagram'
          ? { height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', position: 'relative' }
          : { position: 'relative' }}
      >
        {/* Top-level tabs — this page is the one place to both manage every deal source
            (Telegram channels, Bestseller Crawler) and inspect the pipeline that processes them. */}
        <div className="hide-on-print" style={{ display: 'flex', gap: 16, marginBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setMainTab('sources')}
            style={{
              padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
              color: mainTab === 'sources' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: mainTab === 'sources' ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            <span className="material-symbols-outlined">hub</span>
            Deal Sources
          </button>
          <button
            onClick={() => setMainTab('diagram')}
            style={{
              padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
              color: mainTab === 'diagram' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: mainTab === 'diagram' ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            <span className="material-symbols-outlined">account_tree</span>
            Pipeline Diagram
          </button>
        </div>

        {mainTab === 'sources' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: '1.25rem' }}>
              <button
                onClick={() => setSourceTab('telegram')}
                className="btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: sourceTab === 'telegram' ? 'var(--foreground)' : 'var(--surface)',
                  color: sourceTab === 'telegram' ? 'var(--background)' : 'var(--text-muted)',
                  border: sourceTab === 'telegram' ? 'none' : '1px solid var(--border)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sensors</span>
                Telegram Channels
              </button>
              <button
                onClick={() => setSourceTab('crawler')}
                className="btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: sourceTab === 'crawler' ? 'var(--foreground)' : 'var(--surface)',
                  color: sourceTab === 'crawler' ? 'var(--background)' : 'var(--text-muted)',
                  border: sourceTab === 'crawler' ? 'none' : '1px solid var(--border)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>star</span>
                Bestseller Crawler
              </button>
            </div>

            {sourceTab === 'telegram' ? <TelegramChannelsPanel /> : <BestsellerCrawlerPanel />}
          </div>
        )}

        {mainTab === 'diagram' && (
        <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>Live Data Flow</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              Telegram capture → link resolution → verification → publish, drawn from the actual listener code.
              Click any node for detail — a red badge is a known open issue, an amber/gray dot in the top-left
              corner means that node is only partially implemented or manual-trigger-only (see the panel for why).
            </p>
          </div>
          <div className="hide-on-print" style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowLiveLogs((v) => !v)}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: showLiveLogs ? 'var(--foreground)' : 'var(--surface)',
                color: showLiveLogs ? 'var(--background)' : 'var(--text-muted)',
                border: showLiveLogs ? 'none' : '1px solid var(--border)',
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                background: logsConnected === null ? '#888' : logsConnected ? '#27ae60' : '#e74c3c',
                boxShadow: logsConnected ? '0 0 6px #27ae60' : 'none',
              }} />
              {showLiveLogs ? 'Hide Live Logs' : 'Show Live Logs'}
            </button>
            <button
              onClick={handlePrint}
              className="btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--foreground)',
                color: 'var(--background)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>print</span>
              Print / Save as PDF
            </button>
          </div>
        </div>

        <div className="card glass print-canvas" style={{ flex: showLiveLogs ? '1 1 60%' : 1, padding: 0, overflow: 'hidden', minHeight: 300, position: 'relative' }}>
          <SystemFlowDiagram statusData={statusData} onNodeClick={handleNodeClick} />
        </div>

        {showLiveLogs && (
          <div className="hide-on-print" style={{
            flex: '0 0 220px',
            marginTop: 12,
            display: 'flex',
            flexDirection: 'column',
            background: '#0f1117',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', flexShrink: 0,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>terminal</span>
              Live Backend Logs
              <span style={{ marginLeft: 'auto' }}>
                {logsConnected === null ? 'Connecting…' : logsConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>
            <div ref={logsContainerRef} style={{
              flex: 1, overflowY: 'auto', overflowX: 'hidden',
              fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
              fontSize: '0.72rem', lineHeight: 1.6,
            }}>
              {liveLogs.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
                  {logsConnected === false ? 'Cannot reach API.' : 'Waiting for backend logs…'}
                </div>
              ) : (
                liveLogs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 0, padding: '1px 12px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginRight: 10, userSelect: 'none' }}>
                      {formatLogTs(log.ts)}
                    </span>
                    <span style={{ color: LOG_LEVEL_COLOR[log.level] || '#ccc', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                      {log.msg}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsBottomRef} />
            </div>
          </div>
        )}

        {selectedNode && (
          <div className="hide-on-print" style={{
            position: 'absolute',
            top: 0, right: 0, bottom: 0,
            width: '400px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid var(--border)',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
            padding: '24px',
            overflowY: 'auto',
            animation: 'slideIn 0.3s ease forwards',
            zIndex: 10
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: selectedNode.data.color || '#64748b' }}>{selectedNode.data.icon}</span>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedNode.data.label}</h3>
              </div>
              <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
              {DESCRIPTIONS[selectedNode.id] || 'Pipeline endpoint logic is active.'}
            </p>

            {implNote && (
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                padding: '10px 12px', marginBottom: '20px'
              }}>
                <span className="material-symbols-outlined" style={{ color: implNote.kind === 'manual' ? '#94a3b8' : '#f59e0b', fontSize: 20, flex: 'none' }}>
                  {implNote.kind === 'manual' ? 'pan_tool' : 'warning'}
                </span>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                    {implNote.title}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#78350f' }}>{implNote.text}</div>
                </div>
              </div>
            )}

            {issueNote && (
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: '10px 12px', marginBottom: '20px'
              }}>
                <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: 20, flex: 'none' }}>error</span>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                    Open issue #{issueNote.n}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#7f1d1d' }}>{issueNote.text}</div>
                </div>
              </div>
            )}

            {fixedNotes && fixedNotes.map((note) => (
              <div key={note.n} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                padding: '10px 12px', marginBottom: '12px'
              }}>
                <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 20, flex: 'none' }}>
                  {note.label === 'New' ? 'auto_awesome' : 'check_circle'}
                </span>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                    {note.label || 'Fixed'} — {note.label === 'New' ? 'capability' : 'issue'} #{note.n}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#065f46' }}>{note.text}</div>
                </div>
              </div>
            ))}

            {selectedNode.id === 'ai-parser' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '8px' }}>System Prompt</h4>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#334155', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                    You are a shopping deal analyzer. Analyze the Telegram message and any previously recorded details.
                    {"

"}
                    Respond ONLY with a valid JSON object matching this schema.
                    {"

"}
                    <span style={{ color: '#0ea5e9' }}>// Category list is fetched live from Master DB</span>
                    {"
"}Extract dealPrice/originalPrice from the message text FIRST.
                    {"
"}<span style={{ color: '#10b981' }}>// Fixed #8 — this used to say "prioritize the scraped price," which silently</span>
                    {"
"}<span style={{ color: '#10b981' }}>// overrode the message even though nothing was actually scraped this run.</span>
                    {"
"}Only fall back to the previously recorded price if the message states none at all.
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '8px' }}>JSON Schema Output</h4>
                  <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#a5b4fc', whiteSpace: 'pre-wrap' }}>
                    {`{
  "title": "Clean concise product name",
  "description": "Short summary",
  "originalPrice": 1299.00,
  "dealPrice": 599.00,
  "discountPercentage": 54,
  "category": "fitness",
  "coupon": {
    "type": "percent",
    "value": 2,
    "code": null,
    "label": "Apply 2% coupon"
  }
}`}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    <b>coupon</b> is null unless the post advertises an extra coupon to apply on the
                    merchant page. Bank/card offers don&apos;t count, and the deal&apos;s own discount is never
                    treated as a coupon. Validated by normalizeCoupon() before it&apos;s stored.
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '8px' }}>Ordering note</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    This runs <b>before</b> the cache-valid check and any fresh scrape — the cache-valid decision
                    needs to know whether AI already found a price.
                  </p>
                </div>
              </div>
            )}

            {selectedNode.id === 'scraper' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '8px' }}>Token Rotation Strategy</h4>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#334155', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#0ea5e9' }}>await</span> ScrapingAntToken.findOne(&#123; status: <span style={{ color: '#16a34a' }}>'active'</span> &#125;)
                    <br />  .sort(&#123; lastUsedAt: <span style={{ color: '#d97706' }}>1</span> &#125;);
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Fetches the "coldest" (least recently used) active API token from MongoDB to distribute request load and prevent rate limits.
                    On a 403/429 the token is marked exhausted and the call retries recursively with the next one.
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '8px' }}>Extraction Payload</h4>
                  <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#cbd5e1' }}>
                    https://api.scrapingant.com/v2/general?<br/>
                    <span style={{ color: '#fbbf24' }}>x-api-key</span>=&#123;token&#125;&<br/>
                    <span style={{ color: '#fbbf24' }}>url</span>=&#123;targetUrl&#125;&<br/>
                    <span style={{ color: '#fbbf24' }}>browser</span>=<span style={{ color: '#34d399' }}>true</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Injects headless browser rendering (`browser=true`) to bypass client-side React/Vue rendering on Amazon and Flipkart.
                  </p>
                </div>
              </div>
            )}

            {(selectedNode.id === 'upsert-product' || selectedNode.id === 'upsert-deal') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    {selectedNode.id === 'upsert-product' ? 'Price History Append' : 'Feed Bump on Repost'}
                  </h4>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#334155', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                    {selectedNode.id === 'upsert-product'
                      ? `if (dealPrice !== productRecord.price) {
  productRecord.priceHistory.push({
    price: dealPrice, originalPrice, timestamp: now
  });
}`
                      : `// existing dealUrl found:
deal.createdAt = now; // bumps to top of feed
await deal.save();`}
                  </div>
                </div>
              </div>
            )}

            {selectedNode.id === 'dedupe' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '8px' }}>Duplicate Check</h4>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#334155', border: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>// 60-minute duplicate window</span><br/>
                    <span style={{ color: '#0ea5e9' }}>const</span> count = <span style={{ color: '#0ea5e9' }}>await</span> Deal.countDocuments(&#123;<br/>
                    &nbsp;&nbsp;dealUrl: cleanUrl,<br/>
                    &nbsp;&nbsp;createdAt: &#123; <span style={{ color: '#d97706' }}>$gte</span>: sixtyMinsAgo &#125;<br/>
                    &#125;);
                  </div>
                </div>
              </div>
            )}

            {selectedNode.id === 'price-history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '8px' }}>Best-Effort Comparison</h4>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#334155', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                    <span style={{ color: '#64748b' }}>{'// only runs if discountPercentage is still 0/null here'}</span><br/>
                    <span style={{ color: '#0ea5e9' }}>const</span> cachedPrice = <span style={{ color: '#0ea5e9' }}>await</span> Product.findOne(&#123;productId&#125;).price;<br/>
                    discountPercentage = calculateDiscount(cachedPrice, dealPrice); <span style={{ color: '#64748b' }}>{'// may be 0'}</span><br/>
                    priceSource = <span style={{ color: '#16a34a' }}>'price_history'</span>;<br/>
                    <span style={{ color: '#0ea5e9' }}>if</span> (discountPercentage &gt;= <span style={{ color: '#d97706' }}>5</span>) previousPrice = cachedPrice;
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    We don't track how recently cachedPrice was itself verified — it's used anyway rather than
                    blocking a legitimate deal. The 5% bar only gates whether it counts as a genuine tracked
                    "price drop" (previousPrice set); below that, the deal can still pass the gate at 0%.
                  </p>
                </div>
              </div>
            )}

            {(selectedNode.id === 'loop-resolve' || selectedNode.id === 'loop-clean') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    {selectedNode.id === 'loop-resolve' ? 'Affiliate Unwrapping' : 'Product-Link Classification'}
                  </h4>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace', color: '#334155', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                    {selectedNode.id === 'loop-resolve'
                      ? `for (const [param, value] of urlObj.searchParams) {
  if (value.match(/https?:\/\/[^\s"'<>]+/i)) {
    return decodeURIComponent(value);
  }
}`
                      : `const dpMatch = pathname.match(/\/dp\/([A-Z0-9]{10})/i);
isProductUrl = !!dpMatch; // false for /s?k=... search pages`}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </>
        )}

      </section>

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body, html {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: #fff !important;
          }
          .sidebar, .top-header, .hide-on-print {
            display: none !important;
          }
          .main-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .app-container, .view-section {
            height: 100% !important;
            width: 100% !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-canvas {
            border: none !important;
            box-shadow: none !important;
            background: #fff !important;
            height: 180mm !important; /* Perfect fit for A4 landscape with margins */
            width: 100% !important;
            page-break-inside: avoid;
            margin: 0 !important;
          }
          .react-flow__background {
            background: #fff !important;
          }
        }
      `}</style>
    </AdminShell>
  );
}
