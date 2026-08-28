import React, { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Custom Glassmorphism Node
const GlassNode = ({ data }) => {
  const isOnline = data.isOnline !== false;

  return (
    <div
      style={{
        position: 'relative',
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        border: `1.5px solid ${data.color || 'var(--border)'}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        minWidth: '190px',
        opacity: isOnline ? 1 : 0.65,
        transition: 'all 0.25s ease',
      }}
    >
      {data.badge && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            right: 12,
            padding: '2px 8px',
            borderRadius: '10px',
            background: data.badgeColor || '#6366f1',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
        >
          {data.badge}
        </div>
      )}

      <Handle type="target" position={Position.Left} style={{ background: data.color || '#555' }} />
      <Handle type="target" position={Position.Top} id="top" style={{ background: data.color || '#555' }} />

      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: `${data.color}18` || 'rgba(0,0,0,0.05)',
          color: data.color || 'var(--text-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{data.icon}</span>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>{data.label}</div>
        {data.value !== undefined && (
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: data.color || 'var(--text-main)', marginTop: '2px' }}>
            {data.value}
          </div>
        )}
        {data.subLabel && (
          <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>{data.subLabel}</div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: data.color || '#555' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: data.color || '#555' }} />
    </div>
  );
};

// Section Backdrop Group Node
const SectionGroupNode = ({ data }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      borderRadius: '20px',
      border: `2px dashed ${data.borderColor || '#0ea5e9'}`,
      background: data.bgColor || 'rgba(14, 165, 233, 0.03)',
      position: 'relative',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: -12,
        left: 24,
        background: '#f8fafc',
        padding: '3px 12px',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: data.borderColor || '#0ea5e9',
        border: `1px solid ${data.borderColor || '#0ea5e9'}30`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
      }}
    >
      {data.label}
    </div>
  </div>
);

const nodeTypes = {
  glass: GlassNode,
  sectiongroup: SectionGroupNode,
};

export default function SystemFlowDiagram({ statusData, onNodeClick }) {
  const isOnline = statusData?.status === 'Online' || true;
  const edgeColor = '#10b981';

  const initialNodes = useMemo(() => [
    // =========================================================================
    // SECTION 1: THE 4 MULTI-CHANNEL INGESTION & DISCOVERY PRODUCERS
    // =========================================================================
    {
      id: 'group-producers',
      type: 'sectiongroup',
      position: { x: 30, y: 40 },
      style: { width: 440, height: 720 },
      draggable: false,
      selectable: false,
      data: { label: '1. Ingestion & Discovery Producers', borderColor: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.03)' },
    },
    {
      id: 'producer-telegram',
      type: 'glass',
      parentId: 'group-producers',
      extent: 'parent',
      position: { x: 30, y: 50 },
      data: {
        id: 'producer-telegram',
        label: 'Telegram Stream',
        icon: 'telegram',
        subLabel: 'Live GramJS Event + 30s Poller',
        color: '#3b82f6',
        badge: 'Priority 2',
        badgeColor: '#3b82f6',
      },
    },
    {
      id: 'producer-refresher',
      type: 'glass',
      parentId: 'group-producers',
      extent: 'parent',
      position: { x: 30, y: 220 },
      data: {
        id: 'producer-refresher',
        label: '24h Price Refresher',
        icon: 'schedule',
        subLabel: 'Auto-scans >24h stale catalog',
        color: '#8b5cf6',
        badge: 'Priority 3',
        badgeColor: '#8b5cf6',
      },
    },
    {
      id: 'producer-crawler',
      type: 'glass',
      parentId: 'group-producers',
      extent: 'parent',
      position: { x: 30, y: 390 },
      data: {
        id: 'producer-crawler',
        label: 'Category Bestseller Crawler',
        icon: 'star',
        subLabel: '11 categories (Mobiles, Audio, TV...)',
        color: '#ec4899',
        badge: 'Priority 4',
        badgeColor: '#ec4899',
      },
    },
    {
      id: 'producer-interactive',
      type: 'glass',
      parentId: 'group-producers',
      extent: 'parent',
      position: { x: 30, y: 560 },
      data: {
        id: 'producer-interactive',
        label: 'User Live Re-check',
        icon: 'touch_app',
        subLabel: 'On-demand click & URL search',
        color: '#f59e0b',
        badge: 'Priority 1 (Urgent)',
        badgeColor: '#ef4444',
      },
    },

    // =========================================================================
    // SECTION 2: NLP & LINK RESOLUTION PIPELINE (TELEGRAM)
    // =========================================================================
    {
      id: 'group-nlp',
      type: 'sectiongroup',
      position: { x: 530, y: 40 },
      style: { width: 340, height: 720 },
      draggable: false,
      selectable: false,
      data: { label: '2. Normalization & AI Parsing', borderColor: '#0ea5e9', bgColor: 'rgba(14, 165, 233, 0.03)' },
    },
    {
      id: 'step-resolve',
      type: 'glass',
      parentId: 'group-nlp',
      extent: 'parent',
      position: { x: 30, y: 80 },
      data: {
        id: 'step-resolve',
        label: 'URL Unshortener & ASIN',
        icon: 'link',
        subLabel: 'Follows 3xx redirects & extracts PID',
        color: '#0ea5e9',
      },
    },
    {
      id: 'step-deepseek',
      type: 'glass',
      parentId: 'group-nlp',
      extent: 'parent',
      position: { x: 30, y: 250 },
      data: {
        id: 'step-deepseek',
        label: 'DeepSeek NLP Parser',
        icon: 'psychology',
        subLabel: 'Title, Price, MRP, Coupon, Category',
        color: '#eab308',
      },
    },
    {
      id: 'step-dedup',
      type: 'glass',
      parentId: 'group-nlp',
      extent: 'parent',
      position: { x: 30, y: 430 },
      data: {
        id: 'step-dedup',
        label: '60-Minute Deduplicator',
        icon: 'filter_alt',
        subLabel: 'Prevents redundant re-scrapes',
        color: '#f43f5e',
      },
    },

    // =========================================================================
    // SECTION 3: DISTRIBUTED BULLMQ + REDIS SCRAPING ENGINE
    // =========================================================================
    {
      id: 'group-queue',
      type: 'sectiongroup',
      position: { x: 930, y: 40 },
      style: { width: 440, height: 720 },
      draggable: false,
      selectable: false,
      data: { label: '3. Central Distributed Scraping Engine (BullMQ + Redis)', borderColor: '#10b981', bgColor: 'rgba(16, 185, 129, 0.03)' },
    },
    {
      id: 'node-bullmq',
      type: 'glass',
      parentId: 'group-queue',
      extent: 'parent',
      position: { x: 30, y: 80 },
      data: {
        id: 'node-bullmq',
        label: 'Redis BullMQ Queue',
        icon: 'dns',
        value: statusData?.queueLength || 'Active',
        subLabel: 'Central "scraper-queue" (Multi-Machine)',
        color: '#10b981',
      },
    },
    {
      id: 'node-limiter',
      type: 'glass',
      parentId: 'group-queue',
      extent: 'parent',
      position: { x: 30, y: 250 },
      data: {
        id: 'node-limiter',
        label: 'Global Rate Limiter',
        icon: 'speed',
        subLabel: 'Strictly 1 req / 2.5s globally',
        color: '#059669',
        badge: '0 Collisions',
        badgeColor: '#10b981',
      },
    },
    {
      id: 'node-worker',
      type: 'glass',
      parentId: 'group-queue',
      extent: 'parent',
      position: { x: 30, y: 420 },
      data: {
        id: 'node-worker',
        label: 'Scraping Worker & Token Pool',
        icon: 'vpn_key',
        value: `${statusData?.tokens?.active || 1} Ready`,
        subLabel: 'ScrapingAnt token rotation + &country',
        color: '#f59e0b',
      },
    },
    {
      id: 'node-logs',
      type: 'glass',
      parentId: 'group-queue',
      extent: 'parent',
      position: { x: 30, y: 570 },
      data: {
        id: 'node-logs',
        label: 'Scraping Activity Logger',
        icon: 'receipt_long',
        subLabel: 'Real-time inspection & latencies',
        color: '#0284c7',
      },
    },

    // =========================================================================
    // SECTION 4: DATA INTEGRITY & NORMALIZATION (DEALS ⊆ PRODUCTS)
    // =========================================================================
    {
      id: 'group-db',
      type: 'sectiongroup',
      position: { x: 1430, y: 40 },
      style: { width: 440, height: 720 },
      draggable: false,
      selectable: false,
      data: { label: '4. Database Integrity & History (Deals ⊆ Products)', borderColor: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.03)' },
    },
    {
      id: 'node-upsert-product',
      type: 'glass',
      parentId: 'group-db',
      extent: 'parent',
      position: { x: 30, y: 80 },
      data: {
        id: 'node-upsert-product',
        label: 'Product Canonical Record',
        icon: 'inventory_2',
        value: `${statusData?.totalProducts || 5148} Products`,
        subLabel: 'Canonical images, ASIN, MRP, categories',
        color: '#06b6d4',
      },
    },
    {
      id: 'node-history',
      type: 'glass',
      parentId: 'group-db',
      extent: 'parent',
      position: { x: 30, y: 250 },
      data: {
        id: 'node-history',
        label: 'Daily Checkpoints & Bezier',
        icon: 'show_chart',
        subLabel: 'Continuous crosshair price trend graph',
        color: '#0284c7',
      },
    },
    {
      id: 'node-subset-gate',
      type: 'glass',
      parentId: 'group-db',
      extent: 'parent',
      position: { x: 30, y: 420 },
      data: {
        id: 'node-subset-gate',
        label: 'Subset Invariant Gate',
        icon: 'verified',
        subLabel: 'Guarantees Deals ⊆ Products (100% matched)',
        color: '#10b981',
      },
    },
    {
      id: 'node-synthesizer',
      type: 'glass',
      parentId: 'group-db',
      extent: 'parent',
      position: { x: 30, y: 570 },
      data: {
        id: 'node-synthesizer',
        label: 'Autonomous Deal Synthesizer',
        icon: 'auto_awesome',
        value: `${statusData?.totalDeals || 3534} Deals`,
        subLabel: 'Auto-publishes deals on >=15% drop',
        color: '#ec4899',
      },
    },

    // =========================================================================
    // SECTION 5: OMNICHANNEL MULTI-OUTPUT BROADCASTING
    // =========================================================================
    {
      id: 'group-outputs',
      type: 'sectiongroup',
      position: { x: 1930, y: 40 },
      style: { width: 340, height: 720 },
      draggable: false,
      selectable: false,
      data: { label: '5. Omnichannel Broadcasting', borderColor: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.03)' },
    },
    {
      id: 'out-telegram',
      type: 'glass',
      parentId: 'group-outputs',
      extent: 'parent',
      position: { x: 30, y: 60 },
      data: {
        id: 'out-telegram',
        label: 'Telegram Output Channels',
        icon: 'send',
        subLabel: 'HTML deal cards with buy links',
        color: '#3b82f6',
      },
    },
    {
      id: 'out-whatsapp',
      type: 'glass',
      parentId: 'group-outputs',
      extent: 'parent',
      position: { x: 30, y: 190 },
      data: {
        id: 'out-whatsapp',
        label: 'WhatsApp Communities',
        icon: 'chat',
        subLabel: 'Broadcaster groups & channels',
        color: '#25D366',
      },
    },
    {
      id: 'out-twitter',
      type: 'glass',
      parentId: 'group-outputs',
      extent: 'parent',
      position: { x: 30, y: 320 },
      data: {
        id: 'out-twitter',
        label: 'Twitter / X Deal Bot',
        icon: 'flutter_dash',
        subLabel: 'USA & India deal tweets with media',
        color: '#1da1f2',
      },
    },
    {
      id: 'out-algolia',
      type: 'glass',
      parentId: 'group-outputs',
      extent: 'parent',
      position: { x: 30, y: 450 },
      data: {
        id: 'out-algolia',
        label: 'Algolia Search Index',
        icon: 'travel_explore',
        subLabel: 'Instant sub-millisecond full-text search',
        color: '#5468ff',
      },
    },
    {
      id: 'out-webapp',
      type: 'glass',
      parentId: 'group-outputs',
      extent: 'parent',
      position: { x: 30, y: 580 },
      data: {
        id: 'out-webapp',
        label: 'Web & Mobile App Feed',
        icon: 'devices',
        subLabel: 'Live price tracking & interactive chart',
        color: '#f59e0b',
      },
    },
  ], [statusData]);

  const arrowGreen = { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#10b981' };
  const arrowBlue = { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#0ea5e9' };
  const arrowPurple = { type: MarkerType.ArrowClosed, width: 14, height: 14, color: '#8b5cf6' };

  const initialEdges = [
    // Producers -> NLP / Direct to Queue
    { id: 'e-tg-res', source: 'producer-telegram', target: 'step-resolve', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2.5 }, markerEnd: arrowBlue },
    { id: 'e-res-deep', source: 'step-resolve', target: 'step-deepseek', animated: true, style: { stroke: '#0ea5e9', strokeWidth: 2 }, markerEnd: arrowBlue },
    { id: 'e-deep-dedup', source: 'step-deepseek', target: 'step-dedup', animated: true, style: { stroke: '#eab308', strokeWidth: 2 }, markerEnd: arrowBlue },
    { id: 'e-dedup-queue', source: 'step-dedup', target: 'node-bullmq', animated: true, style: { stroke: '#10b981', strokeWidth: 2.5 }, markerEnd: arrowGreen },

    // Other Producers -> Directly into BullMQ Queue
    { id: 'e-ref-queue', source: 'producer-refresher', target: 'node-bullmq', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2.5 }, markerEnd: arrowPurple },
    { id: 'e-crawl-queue', source: 'producer-crawler', target: 'node-bullmq', animated: true, style: { stroke: '#ec4899', strokeWidth: 2.5 }, markerEnd: arrowPurple },
    { id: 'e-inter-queue', source: 'producer-interactive', target: 'node-bullmq', animated: true, style: { stroke: '#ef4444', strokeWidth: 3 }, markerEnd: arrowGreen },

    // Inside BullMQ Queue Engine
    { id: 'e-queue-limiter', source: 'node-bullmq', target: 'node-limiter', animated: true, style: { stroke: '#10b981', strokeWidth: 2.5 }, markerEnd: arrowGreen },
    { id: 'e-limiter-worker', source: 'node-limiter', target: 'node-worker', animated: true, style: { stroke: '#059669', strokeWidth: 2.5 }, markerEnd: arrowGreen },
    { id: 'e-worker-logs', source: 'node-worker', target: 'node-logs', animated: true, style: { stroke: '#0284c7', strokeWidth: 2 }, markerEnd: arrowBlue },

    // Queue -> DB & History
    { id: 'e-worker-product', source: 'node-worker', target: 'node-upsert-product', animated: true, style: { stroke: '#10b981', strokeWidth: 3 }, markerEnd: arrowGreen },
    { id: 'e-product-history', source: 'node-upsert-product', target: 'node-history', animated: true, style: { stroke: '#06b6d4', strokeWidth: 2 }, markerEnd: arrowBlue },
    { id: 'e-history-gate', source: 'node-history', target: 'node-subset-gate', animated: true, style: { stroke: '#0284c7', strokeWidth: 2 }, markerEnd: arrowBlue },
    { id: 'e-gate-synthesizer', source: 'node-subset-gate', target: 'node-synthesizer', animated: true, style: { stroke: '#ec4899', strokeWidth: 2.5 }, markerEnd: arrowPurple },

    // DB -> Omnichannel Outputs
    { id: 'e-synth-tg', source: 'node-synthesizer', target: 'out-telegram', animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 }, markerEnd: arrowBlue },
    { id: 'e-synth-wa', source: 'node-synthesizer', target: 'out-whatsapp', animated: true, style: { stroke: '#25D366', strokeWidth: 2 }, markerEnd: arrowGreen },
    { id: 'e-synth-tw', source: 'node-synthesizer', target: 'out-twitter', animated: true, style: { stroke: '#1da1f2', strokeWidth: 2 }, markerEnd: arrowBlue },
    { id: 'e-synth-algolia', source: 'node-synthesizer', target: 'out-algolia', animated: true, style: { stroke: '#5468ff', strokeWidth: 2 }, markerEnd: arrowBlue },
    { id: 'e-synth-webapp', source: 'node-synthesizer', target: 'out-webapp', animated: true, style: { stroke: '#f59e0b', strokeWidth: 2.5 }, markerEnd: arrowPurple },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, setNodes, setEdges]);

  const handleNodeClick = (event, node) => {
    if (node.type === 'sectiongroup') return;
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', minHeight: '620px', cursor: 'pointer' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={20} size={1.2} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
