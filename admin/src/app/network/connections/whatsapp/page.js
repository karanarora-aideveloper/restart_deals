'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const TABS = [
  { key: 'destinations', label: '🎯 Destinations (Channels, Groups & Users)' },
  { key: 'broadcaster', label: '📤 Deal Broadcaster' },
  { key: 'chats', label: '💬 Live Chats' },
  { key: 'screenshot', label: '🖥️ Live Screen' }
];

function formatTimestamp(unixSeconds) {
  if (!unixSeconds) return '';
  return new Date(unixSeconds * 1000).toLocaleString();
}

function formatPhoneDisplay(jidOrPhone) {
  if (!jidOrPhone) return '';
  const clean = jidOrPhone.split('@')[0].replace(/[^\d]/g, '');
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  if (clean.length === 11 && clean.startsWith('1')) {
    return `+1 (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`;
  }
  return `+${clean}`;
}

export default function WhatsAppPortalPage() {
  const [apiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'https://api.shoppersdeals.in');
  const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
  const [channelId, setChannelId] = useState(null);
  const [tab, setTab] = useState('destinations');

  // Shared account & session status
  const [profileData, setProfileData] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [qrCountdown, setQrCountdown] = useState(0);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [globalError, setGlobalError] = useState('');
  const [prefillTarget, setPrefillTarget] = useState(null);

  // Live Screen modal
  const [liveScreenOpen, setLiveScreenOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setChannelId(params.get('channelId'));
    const initialTab = params.get('tab');
    if (initialTab) {
      if (initialTab === 'channels' || initialTab === 'groups' || initialTab === 'contacts') {
        setTab('destinations');
      } else if (TABS.some(t => t.key === initialTab)) {
        setTab(initialTab);
      }
    }
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    const headers = { ...(options.headers || {}), ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}) };
    return fetch(url, { ...options, headers });
  }, [apiBase, adminApiKey]);

  // Load profile & status
  const loadStatusAndProfile = useCallback(async () => {
    if (!channelId) return;
    try {
      const sRes = await apiFetch(`/api/output-channels/${channelId}/waha/status`);
      const sData = await sRes.json();
      if (sRes.ok && sData.success) {
        setSessionStatus({ status: sData.status, me: sData.me });
        if (sData.status === 'WORKING') {
          setQrCode(null);
          setQrCountdown(0);
        } else if (sData.status === 'SCAN_QR_CODE') {
          try {
            const qrRes = await apiFetch(`/api/output-channels/${channelId}/waha/qr`);
            const qrData = await qrRes.json();
            if (qrRes.ok && qrData.success && qrData.data) {
              setQrCode(qrData.data);
              setQrCountdown(prev => (prev > 0 ? prev : 60));
            }
          } catch {
            // Non-fatal
          }
        }
      }

      const pRes = await apiFetch(`/api/output-channels/${channelId}/waha/profile`);
      const pData = await pRes.json();
      if (pRes.ok && pData.success) {
        setProfileData(pData);
      }
    } catch (err) {
      console.warn('Status/Profile load warning:', err.message);
    }
  }, [apiFetch, channelId]);

  useEffect(() => {
    if (channelId) loadStatusAndProfile();
  }, [channelId, loadStatusAndProfile]);

  // Countdown timer for QR code
  useEffect(() => {
    const timer = setInterval(() => {
      setQrCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll status while in handshake mode
  useEffect(() => {
    if (!channelId) return;
    const interval = setInterval(() => {
      if (sessionStatus?.status === 'STARTING' || sessionStatus?.status === 'SCAN_QR_CODE') {
        apiFetch(`/api/output-channels/${channelId}/waha/status`)
          .then(r => r.json())
          .then(data => {
            if (data?.success && data.status) {
              setSessionStatus({ status: data.status, me: data.me });
              if (data.status === 'WORKING') {
                setQrCode(null);
                setQrCountdown(0);
                loadStatusAndProfile();
              }
            }
          })
          .catch(() => {});
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [channelId, sessionStatus, apiFetch, loadStatusAndProfile]);

  // On-demand QR generator
  const handleGenerateFreshQr = async () => {
    setIsGeneratingQr(true);
    setGlobalError('');
    try {
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/fresh-qr?force=true`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate QR code');
      setSessionStatus({ status: data.status, me: data.me || null });
      if (data.qr) {
        setQrCode(data.qr);
        setQrCountdown(data.expiresInSeconds || 60);
        setIsGeneratingQr(false);
      } else {
        // Chromium is starting up, poll /waha/qr until rendered
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const qrRes = await apiFetch(`/api/output-channels/${channelId}/waha/qr`);
            const qrData = await qrRes.json();
            if (qrRes.ok && qrData.success && qrData.data) {
              clearInterval(poll);
              setQrCode(qrData.data);
              setQrCountdown(60);
              setSessionStatus(prev => ({ ...prev, status: 'SCAN_QR_CODE' }));
              setIsGeneratingQr(false);
              return;
            }
          } catch {}
          if (attempts >= 15) {
            clearInterval(poll);
            setIsGeneratingQr(false);
          }
        }, 1500);
      }
    } catch (err) {
      setGlobalError(err.message);
      setIsGeneratingQr(false);
    }
  };

  const handleSessionAction = async (action) => {
    setBusyAction(action);
    setGlobalError('');
    try {
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed to ${action} session`);
      await loadStatusAndProfile();
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setBusyAction(null);
    }
  };

  if (channelId === null) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading WhatsApp Command Center…</div>;
  }

  if (!channelId) {
    return (
      <div className="card glass" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 10 }}>💬</div>
        <h3>No WhatsApp Channel Selected</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 450, margin: '0 auto 1.5rem' }}>
          Please select a configured WhatsApp gateway connection to open the Command Center.
        </p>
        <a href="/network/connections" className="btn btn-primary" style={{ padding: '8px 20px', textDecoration: 'none' }}>
          ← Back to Connections Dashboard
        </a>
      </div>
    );
  }

  const isWorking = sessionStatus?.status === 'WORKING';
  const isScanQr = sessionStatus?.status === 'SCAN_QR_CODE';
  const isStarting = sessionStatus?.status === 'STARTING';
  const isStoppedOrFailed = sessionStatus?.status === 'STOPPED' || sessionStatus?.status === 'FAILED';
  const hasValidQr = isScanQr && qrCode && qrCountdown > 0;

  return (
    <section className="view-section active-view">
      {/* Top Breadcrumb & Title */}
      <div style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/network/connections" style={{ color: 'var(--accent)', fontSize: '0.88rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            ← Network Connections
          </a>
          <span style={{ color: 'var(--border)' }}>/</span>
          <h2 style={{ margin: 0, fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>WhatsApp Command Center</span>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 20,
              background: isWorking ? 'rgba(5,150,105,0.1)' : isScanQr ? 'rgba(37,99,235,0.1)' : 'rgba(217,119,6,0.1)',
              color: isWorking ? '#059669' : isScanQr ? 'var(--accent)' : '#d97706'
            }}>
              ● {sessionStatus?.status || 'CHECKING…'}
            </span>
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            style={{ padding: '6px 14px', fontSize: '0.82rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={() => setLiveScreenOpen(true)}
          >
            📷 Live Screen
          </button>
          <button
            className="btn"
            style={{ padding: '6px 14px', fontSize: '0.82rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}
            onClick={loadStatusAndProfile}
          >
            🔄 Sync Status
          </button>
        </div>
      </div>

      {globalError && (
        <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1.2rem' }}>
          ⚠️ {globalError}
        </div>
      )}

      {/* Account Profile Banner */}
      <div className="card glass" style={{ padding: '1.2rem', marginBottom: '1.4rem', border: isWorking ? '1px solid rgba(5,150,105,0.3)' : '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {profileData?.profile?.picture ? (
              <img
                src={profileData.profile.picture}
                alt="Profile"
                style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(5,150,105,0.4)' }}
              />
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #25D366, #128C7E)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 700 }}>
                💬
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                {profileData?.profile?.name || sessionStatus?.me?.pushName || 'WhatsApp Account'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                {formatPhoneDisplay(profileData?.profile?.id || sessionStatus?.me?.id)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Engine: <code>{profileData?.version?.engine || 'WEBJS'}</code> · Version: <code>{profileData?.version?.version || '2026.9.2'}</code> · Tier: <code>{profileData?.version?.tier || 'CORE'}</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {isWorking && (
              <>
                <button
                  className="btn"
                  style={{ padding: '6px 14px', fontSize: '0.82rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}
                  onClick={() => handleSessionAction('stop')}
                  disabled={busyAction !== null}
                >
                  {busyAction === 'stop' ? 'Stopping…' : 'Pause Session'}
                </button>
                <button
                  className="btn btn-danger"
                  style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                  onClick={() => {
                    if (window.confirm('This will log out the linked WhatsApp device. Continue?')) {
                      handleSessionAction('logout');
                    }
                  }}
                  disabled={busyAction !== null}
                >
                  {busyAction === 'logout' ? 'Logging out…' : 'Logout Device'}
                </button>
              </>
            )}
            {isStoppedOrFailed && (
              <button
                className="btn btn-primary"
                style={{ padding: '6px 18px', fontSize: '0.85rem', fontWeight: 600 }}
                onClick={handleGenerateFreshQr}
                disabled={isGeneratingQr}
              >
                {isGeneratingQr ? 'Starting…' : '⚡ Start & Generate QR'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Onboarding QR Hero (Displayed prominently when not connected) */}
      {!isWorking && (
        <div className="card glass" style={{ padding: '1.5rem', marginBottom: '1.4rem', border: '1px solid rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.02)' }}>
          {isStarting && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔄</div>
              <div style={{ fontWeight: 600, color: '#d97706' }}>Booting Chromium browser in Docker container...</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Waiting for WhatsApp Web to render. Click <strong>Live Screen</strong> to watch it in real time.
              </div>
            </div>
          )}

          {hasValidQr && (
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ padding: 10, background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                  <img src={`data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" style={{ width: 200, height: 200, display: 'block' }} />
                </div>
                <div style={{ width: 220, marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>
                    <span>⏳ Scan with phone</span>
                    <span>{qrCountdown}s remaining</span>
                  </div>
                  <div style={{ width: '100%', height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(qrCountdown / 60) * 100}%`, height: '100%', background: qrCountdown < 15 ? 'var(--danger)' : 'var(--accent)', transition: 'width 1s linear' }} />
                  </div>
                </div>
              </div>

              <div style={{ maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>Link Your WhatsApp Account</div>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  <li>Open WhatsApp on your mobile phone</li>
                  <li>Tap <strong>Menu (⋮)</strong> or <strong>Settings</strong></li>
                  <li>Select <strong>Linked Devices</strong> → <strong>Link a Device</strong></li>
                  <li>Point your camera at this QR code</li>
                </ol>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    className="btn"
                    style={{ padding: '6px 16px', fontSize: '0.82rem', background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', border: '1px solid rgba(37,99,235,0.3)' }}
                    onClick={handleGenerateFreshQr}
                    disabled={isGeneratingQr}
                  >
                    {isGeneratingQr ? 'Regenerating…' : '🔄 Refresh QR Code'}
                  </button>
                  <button
                    className="btn"
                    style={{ padding: '6px 14px', fontSize: '0.82rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}
                    onClick={() => setLiveScreenOpen(true)}
                  >
                    📷 Live Screen
                  </button>
                </div>
              </div>
            </div>
          )}

          {((isScanQr && (!qrCode || qrCountdown === 0)) || isStoppedOrFailed) && !isStarting && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>
                {isStoppedOrFailed ? 'WhatsApp Session Idle' : 'QR Code Expired'}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 450, margin: '0 auto 14px' }}>
                WhatsApp QR codes expire after 60 seconds for security. Whenever you are ready with your phone, click below to generate a fresh QR code.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 24px', fontSize: '0.9rem', fontWeight: 600 }}
                  onClick={handleGenerateFreshQr}
                  disabled={isGeneratingQr}
                >
                  {isGeneratingQr ? '⚡ Initializing & Generating…' : '⚡ Generate Fresh QR Code'}
                </button>
                <button
                  className="btn"
                  style={{ padding: '8px 16px', fontSize: '0.85rem', background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}
                  onClick={() => setLiveScreenOpen(true)}
                >
                  📷 Live Screen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.4rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="btn"
            style={{
              padding: '10px 18px',
              fontSize: '0.88rem',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '3px solid var(--accent)' : '3px solid transparent',
              borderRadius: 0,
              color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {tab === 'destinations' && (
        <DestinationsTab
          channelId={channelId}
          isWorking={isWorking}
          apiFetch={apiFetch}
          onBroadcast={(targetJid) => {
            setPrefillTarget(targetJid);
            setTab('broadcaster');
          }}
          onOpenChat={(targetJid) => {
            setPrefillTarget(targetJid);
            setTab('chats');
          }}
        />
      )}

      {tab === 'broadcaster' && (
        <DealBroadcasterTab
          channelId={channelId}
          isWorking={isWorking}
          apiFetch={apiFetch}
          prefillTarget={prefillTarget}
          onClearPrefill={() => setPrefillTarget(null)}
        />
      )}

      {tab === 'chats' && (
        <ChatsTab
          channelId={channelId}
          isWorking={isWorking}
          apiFetch={apiFetch}
          onComposeTo={(targetJid) => {
            setPrefillTarget(targetJid);
            setTab('broadcaster');
          }}
        />
      )}

      {tab === 'screenshot' && <ScreenshotTab channelId={channelId} apiFetch={apiFetch} />}

      {/* Live Screen Modal */}
      {liveScreenOpen && (
        <LiveScreenModal channelId={channelId} apiFetch={apiFetch} onClose={() => setLiveScreenOpen(false)} />
      )}
    </section>
  );
}

/* =========================================================================
   TAB 1: 🎯 Destinations (Channels, Groups & Test Users)
   Unified Broadcast & Pipeline Control Center
   ========================================================================= */
function DestinationsTab({ channelId, isWorking, apiFetch, onBroadcast, onOpenChat }) {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [masterCategories, setMasterCategories] = useState([]);

  // Filters
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'channel' | 'group' | 'user'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'paused' | 'unlinked'
  const [search, setSearch] = useState('');

  // Test send state
  const [testSendingId, setTestSendingId] = useState(null);
  const [testNotice, setTestNotice] = useState(null); // { id, message, isError }

  // Add Destination Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addType, setAddType] = useState('channel'); // 'channel' | 'group' | 'user'
  const [addChannelMode, setAddChannelMode] = useState('create'); // 'create' | 'link'
  const [addGroupMode, setAddGroupMode] = useState('invite'); // 'invite' | 'existing'
  
  // Add modal fields
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [channelJid, setChannelJid] = useState('');
  const [channelCustomName, setChannelCustomName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [selectedExistingGroupId, setSelectedExistingGroupId] = useState('');
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [targetCategory, setTargetCategory] = useState('all');
  const [targetRateLimit, setTargetRateLimit] = useState(3);
  const [addingTarget, setAddingTarget] = useState(false);
  const [addError, setAddError] = useState('');

  // Settings Modal
  const [settingsTarget, setSettingsTarget] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('all');
  const [editRateLimit, setEditRateLimit] = useState(15);
  const [editCountry, setEditCountry] = useState('IN');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupPicUrl, setEditGroupPicUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingTarget, setDeletingTarget] = useState(false);

  // Group Participants Modal
  const [activeGroup, setActiveGroup] = useState(null);
  const [participants, setParticipants] = useState(null);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [importingLeads, setImportingLeads] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showLimitsCard, setShowLimitsCard] = useState(true);

  // Load master categories
  useEffect(() => {
    apiFetch('/api/master/category')
      .then(r => r.json())
      .then(d => { if (d.success) setMasterCategories(d.data || []); })
      .catch(() => {});
  }, [apiFetch]);

  // Unified loader: merges WAHA channels, WAHA groups, and MongoDB output channels
  const loadDestinations = useCallback(async () => {
    if (!isWorking) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // 1. Fetch registered output channels
      let outputChannels = [];
      try {
        const pipeRes = await apiFetch('/api/output-channels?platform=whatsapp');
        const pipeData = await pipeRes.json();
        if (pipeRes.ok && pipeData?.channels) {
          outputChannels = pipeData.channels;
        }
      } catch (e) {
        console.warn('Could not load output channels:', e.message);
      }

      // 2. Fetch WAHA channels (newsletters)
      let wahaChannels = [];
      try {
        const cRes = await apiFetch(`/api/output-channels/${channelId}/waha/channels`);
        const cData = await cRes.json();
        if (cRes.ok && cData?.channels) {
          wahaChannels = cData.channels;
        }
      } catch (e) {
        console.warn('Could not load WAHA channels:', e.message);
      }

      // 3. Fetch WAHA groups
      let wahaGroups = [];
      try {
        const gRes = await apiFetch(`/api/output-channels/${channelId}/waha/groups`);
        const gData = await gRes.json();
        if (gRes.ok && gData?.groups) {
          wahaGroups = gData.groups;
        }
      } catch (e) {
        console.warn('Could not load WAHA groups:', e.message);
      }

      // Merge into a single comprehensive list
      const merged = [];
      const processedPipeIds = new Set();
      const processedJids = new Set();

      // Process Channels
      for (const ch of wahaChannels) {
        const matchingPipe = outputChannels.find(
          p => p.credentials?.recipientPhoneNumber === ch.id
        );
        if (matchingPipe) processedPipeIds.add(matchingPipe._id);
        processedJids.add(ch.id);

        merged.push({
          id: ch.id,
          type: 'channel',
          name: ch.name || 'WhatsApp Channel',
          description: ch.description || '',
          jid: ch.id,
          followersCount: ch.subscribersCount || null,
          inviteCode: ch.inviteCode || null,
          isAdmin: ch.role === 'admin' || ch.role === 'owner',
          outputChannel: matchingPipe || null,
          isActive: matchingPipe ? matchingPipe.isActive : false,
          category: matchingPipe?.category || 'all',
          rateLimitMinutes: matchingPipe?.rateLimitMinutes || 3,
          country: matchingPipe?.country || 'IN',
          dealsPublished: matchingPipe?.stats?.dealsPublished ?? matchingPipe?.dealsPublished ?? 0,
          lastPublishedAt: matchingPipe?.stats?.lastPublishedAt ?? matchingPipe?.lastPublishedAt ?? null
        });
      }

      // Process Groups
      for (const grp of wahaGroups) {
        const matchingPipe = grp.outputChannel || outputChannels.find(
          p => p.credentials?.recipientPhoneNumber === grp.id
        );
        if (matchingPipe) processedPipeIds.add(matchingPipe._id);
        processedJids.add(grp.id);

        merged.push({
          id: grp.id,
          type: 'group',
          name: grp.subject || 'WhatsApp Group',
          description: grp.description || '',
          pictureUrl: grp.pictureUrl || null,
          jid: grp.id,
          participantsCount: grp.participantsCount || grp.participants?.length || null,
          isAdmin: grp.isAdmin || false,
          isAnnounce: grp.isAnnounce || false,
          outputChannel: matchingPipe || null,
          isActive: matchingPipe ? matchingPipe.isActive : false,
          category: matchingPipe?.category || 'all',
          rateLimitMinutes: matchingPipe?.rateLimitMinutes || 15,
          country: matchingPipe?.country || 'IN',
          dealsPublished: matchingPipe?.stats?.dealsPublished ?? matchingPipe?.dealsPublished ?? 0,
          lastPublishedAt: matchingPipe?.stats?.lastPublishedAt ?? matchingPipe?.lastPublishedAt ?? null
        });
      }

      // Process Remaining MongoDB Output Channels (Test Users or Custom Destinations)
      for (const pipe of outputChannels) {
        if (processedPipeIds.has(pipe._id)) continue;
        const jid = pipe.credentials?.recipientPhoneNumber || '';
        if (processedJids.has(jid)) continue;

        let detectedType = 'user';
        if (jid.includes('@newsletter')) {
          detectedType = 'channel';
        } else if (jid.includes('@g.us')) {
          detectedType = 'group';
        }

        merged.push({
          id: pipe._id,
          type: detectedType,
          name: pipe.name || (detectedType === 'user' ? `Tester: ${formatPhoneDisplay(jid)}` : 'WhatsApp Target'),
          description: detectedType === 'user' ? 'Test User / Personal Verification Device' : '',
          jid: jid,
          phoneNumber: jid.split('@')[0],
          isAdmin: false,
          outputChannel: pipe,
          isActive: pipe.isActive,
          category: pipe.category || 'all',
          rateLimitMinutes: pipe.rateLimitMinutes || (detectedType === 'channel' ? 3 : detectedType === 'group' ? 15 : 1),
          country: pipe.country || 'IN',
          dealsPublished: pipe?.stats?.dealsPublished ?? pipe?.dealsPublished ?? 0,
          lastPublishedAt: pipe?.stats?.lastPublishedAt ?? pipe?.lastPublishedAt ?? null
        });
      }

      setDestinations(merged);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, channelId, isWorking]);

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  // Sync groups & channels from WhatsApp server
  const handleSyncWithWhatsApp = async () => {
    if (!isWorking || syncing) return;
    setSyncing(true);
    setError('');
    try {
      await apiFetch(`/api/output-channels/${channelId}/waha/groups/refresh`, { method: 'POST' });
      await loadDestinations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Toggle deal broadcasting ON / OFF
  const handleTogglePipeline = async (dest) => {
    try {
      if (dest.outputChannel?._id) {
        const newStatus = !dest.isActive;
        const res = await apiFetch(`/api/output-channels/${dest.outputChannel._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: newStatus })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to toggle status');
        setDestinations(prev => prev.map(item => {
          if (item.id === dest.id) {
            return {
              ...item,
              isActive: newStatus,
              outputChannel: { ...item.outputChannel, isActive: newStatus }
            };
          }
          return item;
        }));
      } else {
        // Create new output channel document
        const prefix = dest.type === 'channel' ? 'WhatsApp Channel' : dest.type === 'group' ? 'WhatsApp Group' : 'WhatsApp Tester';
        const defaultPacing = dest.type === 'channel' ? 3 : dest.type === 'group' ? 15 : 1;
        const res = await apiFetch('/api/output-channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${prefix}: ${dest.name}`,
            platform: 'whatsapp',
            country: 'IN',
            category: 'all',
            isActive: true,
            rateLimitMinutes: defaultPacing,
            credentials: {
              provider: 'waha',
              wahaBaseUrl: 'http://localhost:3000',
              wahaApiKey: 'shoppersdeals_waha_key_2026',
              wahaSession: 'default',
              recipientPhoneNumber: dest.jid
            }
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to enable deals');
        await loadDestinations();
      }
    } catch (err) {
      alert('Pipeline toggle error: ' + err.message);
    }
  };

  // Send a test deal
  const handleSendTestDeal = async (dest) => {
    setTestSendingId(dest.id);
    setTestNotice(null);
    try {
      if (dest.outputChannel?._id) {
        const res = await apiFetch(`/api/output-channels/${dest.outputChannel._id}/test`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Test deal delivery failed');
        setTestNotice({ id: dest.id, message: `✅ Test deal successfully sent to "${dest.name}"!`, isError: false });
      } else {
        // Send a direct message test via WAHA
        const res = await apiFetch(`/api/output-channels/${channelId}/waha/send-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: dest.jid,
            text: `🔥 *ShoppersDeals Pipeline Test*\n\nThis target (*${dest.name}*) is verified and ready to receive price drop deals!\n\n_Sent via ShoppersDeals Autonomous Network_`
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Test message failed');
        setTestNotice({ id: dest.id, message: `✅ Test message delivered to "${dest.name}"!`, isError: false });
      }
    } catch (err) {
      setTestNotice({ id: dest.id, message: `❌ Error: ${err.message}`, isError: true });
    } finally {
      setTestSendingId(null);
    }
  };

  // Open settings modal
  const openSettings = (dest) => {
    setSettingsTarget(dest);
    setEditName(dest.outputChannel?.name || dest.name);
    setEditCategory(dest.category || 'all');
    setEditRateLimit(dest.rateLimitMinutes || (dest.type === 'channel' ? 3 : dest.type === 'group' ? 15 : 1));
    setEditCountry(dest.country || 'IN');
    setEditGroupDesc(dest.description || '');
    setEditGroupPicUrl(dest.pictureUrl || 'https://www.shoppersdeals.in/web-app-manifest-512x512.png');
  };

  // Save settings
  const handleSaveSettings = async () => {
    if (!settingsTarget) return;
    setSavingSettings(true);
    try {
      if (settingsTarget.outputChannel?._id) {
        const res = await apiFetch(`/api/output-channels/${settingsTarget.outputChannel._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editName.trim(),
            category: editCategory,
            rateLimitMinutes: parseInt(editRateLimit, 10) || 15,
            country: editCountry
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save settings');
      }

      // If group, update group description and picture on WhatsApp if edited
      if (settingsTarget.type === 'group' && settingsTarget.jid) {
        if (editGroupDesc && editGroupDesc !== settingsTarget.description) {
          await apiFetch(`/api/output-channels/${channelId}/waha/groups/${encodeURIComponent(settingsTarget.jid)}/description`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: editGroupDesc.trim() })
          });
        }

        if (editGroupPicUrl && editGroupPicUrl !== settingsTarget.pictureUrl) {
          await apiFetch(`/api/output-channels/${channelId}/waha/groups/${encodeURIComponent(settingsTarget.jid)}/picture`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: editGroupPicUrl.trim() })
          });
        }
      }

      setSettingsTarget(null);
      await loadDestinations();
      alert('✅ Settings & WhatsApp group branding saved successfully!');
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Remove from pipeline
  const handleDeleteFromPipeline = async () => {
    if (!settingsTarget?.outputChannel?._id) return;
    if (!confirm(`Are you sure you want to remove "${settingsTarget.name}" from the deals pipeline?`)) return;
    setDeletingTarget(true);
    try {
      const res = await apiFetch(`/api/output-channels/${settingsTarget.outputChannel._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to remove from pipeline');
      setSettingsTarget(null);
      await loadDestinations();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setDeletingTarget(false);
    }
  };

  // Create or add new destination
  const handleAddDestination = async (e) => {
    e.preventDefault();
    setAddingTarget(true);
    setAddError('');

    try {
      if (addType === 'channel') {
        if (addChannelMode === 'create') {
          if (!newChannelName.trim()) throw new Error('Channel name is required');
          // 1. Create channel in WAHA
          const res = await apiFetch(`/api/output-channels/${channelId}/waha/channels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newChannelName.trim(), description: newChannelDesc.trim() })
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'Channel creation failed');
          const createdChannel = data.channel;

          // 2. Add to output channel pipeline
          if (createdChannel?.id) {
            await apiFetch('/api/output-channels', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: `WhatsApp Channel: ${newChannelName.trim()}`,
                platform: 'whatsapp',
                country: 'IN',
                category: targetCategory,
                isActive: true,
                rateLimitMinutes: parseInt(targetRateLimit, 10) || 3,
                credentials: {
                  provider: 'waha',
                  wahaBaseUrl: 'http://localhost:3000',
                  wahaApiKey: 'shoppersdeals_waha_key_2026',
                  wahaSession: 'default',
                  recipientPhoneNumber: createdChannel.id
                }
              })
            });
          }
        } else {
          // Link existing channel
          if (!channelJid.trim()) throw new Error('Channel JID or ID is required (e.g. 120363422620024343@newsletter)');
          const cleanJid = channelJid.trim().includes('@') ? channelJid.trim() : `${channelJid.trim()}@newsletter`;
          await apiFetch('/api/output-channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: channelCustomName.trim() || `WhatsApp Channel (${cleanJid.slice(0, 15)}...)`,
              platform: 'whatsapp',
              country: 'IN',
              category: targetCategory,
              isActive: true,
              rateLimitMinutes: parseInt(targetRateLimit, 10) || 3,
              credentials: {
                provider: 'waha',
                wahaBaseUrl: 'http://localhost:3000',
                wahaApiKey: 'shoppersdeals_waha_key_2026',
                wahaSession: 'default',
                recipientPhoneNumber: cleanJid
              }
            })
          });
        }
      } else if (addType === 'group') {
        if (addGroupMode === 'invite') {
          if (!inviteLink.trim()) throw new Error('WhatsApp group invite link is required');
          const joinRes = await apiFetch(`/api/output-channels/${channelId}/waha/groups/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: inviteLink.trim() })
          });
          const joinData = await joinRes.json();
          if (!joinRes.ok || !joinData.success) throw new Error(joinData.error || 'Failed to join group');
        } else {
          if (!selectedExistingGroupId) throw new Error('Please select an existing group');
          const found = destinations.find(d => d.id === selectedExistingGroupId);
          if (found) {
            await handleTogglePipeline(found);
            setAddModalOpen(false);
            return;
          }
        }
      } else if (addType === 'user') {
        const cleanPhone = userPhone.replace(/[^\d]/g, '');
        if (cleanPhone.length < 10) throw new Error('Please enter a valid phone number (at least 10 digits)');
        const formattedJid = `${cleanPhone}@c.us`;
        const displayName = userName.trim() || `Tester (${formatPhoneDisplay(cleanPhone)})`;

        await apiFetch('/api/output-channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `WhatsApp Tester: ${displayName}`,
            platform: 'whatsapp',
            country: 'IN',
            category: targetCategory,
            isActive: true,
            rateLimitMinutes: parseInt(targetRateLimit, 10) || 1,
            credentials: {
              provider: 'waha',
              wahaBaseUrl: 'http://localhost:3000',
              wahaApiKey: 'shoppersdeals_waha_key_2026',
              wahaSession: 'default',
              recipientPhoneNumber: formattedJid
            }
          })
        });
      }

      setAddModalOpen(false);
      // Reset form
      setNewChannelName('');
      setNewChannelDesc('');
      setChannelJid('');
      setChannelCustomName('');
      setInviteLink('');
      setSelectedExistingGroupId('');
      setUserName('');
      setUserPhone('');
      await loadDestinations();
      alert('🎉 Target successfully added to WhatsApp broadcast pipeline!');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddingTarget(false);
    }
  };

  // Inspect Group Participants
  const openGroupParticipants = async (dest) => {
    setActiveGroup(dest);
    setParticipants(null);
    setImportResult(null);
    setParticipantsLoading(true);
    try {
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/groups/${encodeURIComponent(dest.jid)}/participants`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load participants');
      setParticipants(data.participants || []);
    } catch (err) {
      alert('Participants error: ' + err.message);
    } finally {
      setParticipantsLoading(false);
    }
  };

  // Import Participants as Leads
  const handleImportLeads = async () => {
    if (!activeGroup || !participants) return;
    setImportingLeads(true);
    try {
      const payload = {
        groupName: activeGroup.name,
        phoneNumbers: participants.map(p => ({
          phoneNumber: p.phoneNumber,
          role: p.role
        }))
      };
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/groups/${encodeURIComponent(activeGroup.jid)}/import-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Lead import failed');
      setImportResult(data);
    } catch (err) {
      alert('Import error: ' + err.message);
    } finally {
      setImportingLeads(false);
    }
  };

  // Filtered destinations
  const filteredDestinations = useMemo(() => {
    return destinations.filter(d => {
      // Type filter
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;

      // Status filter
      if (statusFilter === 'active' && !d.isActive) return false;
      if (statusFilter === 'paused' && (!d.outputChannel || d.isActive)) return false;
      if (statusFilter === 'unlinked' && d.outputChannel) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (d.name || '').toLowerCase().includes(q);
        const matchJid = (d.jid || '').toLowerCase().includes(q);
        const matchDesc = (d.description || '').toLowerCase().includes(q);
        const matchPhone = d.phoneNumber ? d.phoneNumber.includes(q.replace(/[^\d]/g, '')) : false;
        if (!matchName && !matchJid && !matchDesc && !matchPhone) return false;
      }
      return true;
    });
  }, [destinations, typeFilter, statusFilter, search]);

  // Counts for pills
  const counts = useMemo(() => {
    const total = destinations.length;
    const channels = destinations.filter(d => d.type === 'channel').length;
    const groups = destinations.filter(d => d.type === 'group').length;
    const users = destinations.filter(d => d.type === 'user').length;
    const active = destinations.filter(d => d.isActive).length;
    return { total, channels, groups, users, active };
  }, [destinations]);

  // Existing groups available to add to pipeline
  const unlinkedGroups = useMemo(() => {
    return destinations.filter(d => d.type === 'group' && !d.outputChannel);
  }, [destinations]);

  return (
    <div>
      {!isWorking && (
        <div className="card glass" style={{ padding: '1.2rem', marginBottom: 14, background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.3rem' }}>🔒</span>
            <div>
              <div style={{ fontWeight: 600, color: '#d97706' }}>WhatsApp Account Pairing Required</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Please scan the QR code above with your WhatsApp app to unlock channel broadcasts, group synchronization, and automated price drop pipelines.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div className="card glass" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: '1.8rem', background: 'rgba(37,99,235,0.08)', width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎯</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Targets</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{counts.total}</div>
          </div>
        </div>

        <div className="card glass" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #9333ea' }}>
          <div style={{ fontSize: '1.8rem', background: 'rgba(147,51,234,0.08)', width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📢</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Channels</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#9333ea' }}>{counts.channels}</div>
          </div>
        </div>

        <div className="card glass" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #2563eb' }}>
          <div style={{ fontSize: '1.8rem', background: 'rgba(37,99,235,0.08)', width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👥</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Groups</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#2563eb' }}>{counts.groups}</div>
          </div>
        </div>

        <div className="card glass" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #d97706' }}>
          <div style={{ fontSize: '1.8rem', background: 'rgba(217,119,6,0.08)', width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Test Users</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#d97706' }}>{counts.users}</div>
          </div>
        </div>

        <div className="card glass" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, borderLeft: '3px solid #059669' }}>
          <div style={{ fontSize: '1.8rem', background: 'rgba(5,150,105,0.08)', width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚡</div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Pipelines</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#059669' }}>{counts.active}</div>
          </div>
        </div>
      </div>

      {/* WhatsApp Web Safety & Operational Limits Guide */}
      <div
        className="card glass"
        style={{
          padding: '16px 20px',
          marginBottom: 16,
          borderLeft: '4px solid #10b981',
          background: 'rgba(16,185,129,0.03)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.3rem' }}>🛡️</span>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                WhatsApp Web Operating Limits & Anti-Spam Safety Rules
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                WAHA emulates a linked WhatsApp Web session. Safety limits reflect WhatsApp’s mobile heuristics to protect your linked phone number.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLimitsCard(!showLimitsCard)}
            className="btn"
            style={{ padding: '4px 12px', fontSize: '0.78rem', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            {showLimitsCard ? 'Collapse Limits ▲' : 'View Safety Limits ▼'}
          </button>
        </div>

        {showLimitsCard && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 14 }}>
            {/* Channels Card */}
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(147,51,234,0.04)', border: '1px solid rgba(147,51,234,0.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1rem' }}>📢</span>
                  <strong style={{ fontSize: '0.86rem', color: '#9333ea' }}>Channels (Newsletters)</strong>
                </div>
                <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 10, background: 'rgba(5,150,105,0.12)', color: '#059669', fontWeight: 700 }}>Zero Spam Risk</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                <li><strong>Followers:</strong> <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Unlimited</span> (1-to-many broadcast feed).</li>
                <li><strong>Safe Pacing:</strong> <strong>3m delay</strong> (50–100+ deals/day without risk).</li>
                <li><strong>Ban Immunity:</strong> Followers voluntarily follow and cannot report posts as spam.</li>
                <li><strong>Gallery Protection:</strong> Sends link preview; 0MB stored on follower phones.</li>
              </ul>
            </div>

            {/* Groups Card */}
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1rem' }}>👥</span>
                  <strong style={{ fontSize: '0.86rem', color: '#2563eb' }}>WhatsApp Groups (@g.us)</strong>
                </div>
                <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 10, background: 'rgba(217,119,6,0.12)', color: '#d97706', fontWeight: 700 }}>Strict Pacing Enforced</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                <li><strong>Members Cap:</strong> <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>1,024 members</span> max per group.</li>
                <li><strong>Safe Pacing:</strong> <strong>15m delay</strong> (Safe ceiling: 20–30 deals/day).</li>
                <li><strong>Spam Hazard:</strong> Rapid posting or user "Report & Exit" flags the host SIM.</li>
                <li><strong>Quality Gate:</strong> Only deals with authentic discount & rating ≥3.8★ qualify.</li>
              </ul>
            </div>

            {/* Test Users Card */}
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(217,119,6,0.04)', border: '1px solid rgba(217,119,6,0.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1rem' }}>👤</span>
                  <strong style={{ fontSize: '0.86rem', color: '#d97706' }}>1:1 Direct DMs (@c.us)</strong>
                </div>
                <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 10, background: 'rgba(220,38,38,0.12)', color: '#dc2626', fontWeight: 700 }}>Sandbox Test Only</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                <li><strong>Audience:</strong> Single verified tester phone number.</li>
                <li><strong>Safe Usage:</strong> Manual 1-click test sends & opt-in personal price drops.</li>
                <li><strong>Zero Cold Outreach:</strong> Never send unsolicited bulk DMs to individuals.</li>
                <li><strong>SIM Ban Hazard:</strong> WhatsApp bans numbers sending unsolicited DMs within hours.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Unified Controls & Filter Bar */}
      <div className="card glass" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Type Segmented Buttons */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: 3, borderRadius: 8, gap: 4 }}>
            <button
              onClick={() => setTypeFilter('all')}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: 6,
                background: typeFilter === 'all' ? '#fff' : 'transparent',
                color: typeFilter === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: typeFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                border: 'none'
              }}
            >
              All ({counts.total})
            </button>
            <button
              onClick={() => setTypeFilter('channel')}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: 6,
                background: typeFilter === 'channel' ? '#9333ea' : 'transparent',
                color: typeFilter === 'channel' ? '#fff' : 'var(--text-muted)',
                boxShadow: typeFilter === 'channel' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                border: 'none'
              }}
            >
              📢 Channels ({counts.channels})
            </button>
            <button
              onClick={() => setTypeFilter('group')}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: 6,
                background: typeFilter === 'group' ? '#2563eb' : 'transparent',
                color: typeFilter === 'group' ? '#fff' : 'var(--text-muted)',
                boxShadow: typeFilter === 'group' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                border: 'none'
              }}
            >
              👥 Groups ({counts.groups})
            </button>
            <button
              onClick={() => setTypeFilter('user')}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: 6,
                background: typeFilter === 'user' ? '#d97706' : 'transparent',
                color: typeFilter === 'user' ? '#fff' : 'var(--text-muted)',
                boxShadow: typeFilter === 'user' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                border: 'none'
              }}
            >
              👤 Test Users ({counts.users})
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn"
              style={{ padding: '7px 14px', fontSize: '0.84rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}
              onClick={handleSyncWithWhatsApp}
              disabled={syncing || !isWorking}
              title="Force sync groups & channels with WhatsApp servers"
            >
              {syncing ? '🔄 Syncing WhatsApp…' : '🔄 Sync with WhatsApp'}
            </button>
            <button
              className="btn btn-primary"
              style={{ padding: '7px 18px', fontSize: '0.84rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => {
                setAddError('');
                setAddModalOpen(true);
              }}
              disabled={!isWorking}
            >
              <span>➕ Add Destination</span>
            </button>
          </div>
        </div>

        {/* Search & Pipeline Status Filter */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="filter-input"
            placeholder="🔍 Search destinations by name, phone or JID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />

          <select
            className="filter-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: 160 }}
          >
            <option value="all">All Statuses</option>
            <option value="active">● Pipeline Active Only</option>
            <option value="paused">⏸️ Paused / Inactive</option>
            <option value="unlinked">○ Not in Pipeline</option>
          </select>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Test Send Feedback Banner */}
      {testNotice && (
        <div style={{
          background: testNotice.isError ? 'rgba(220,38,38,0.08)' : 'rgba(5,150,105,0.08)',
          color: testNotice.isError ? 'var(--danger)' : '#059669',
          padding: '10px 16px',
          borderRadius: 8,
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{testNotice.message}</span>
          <button onClick={() => setTestNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Destinations Cards Grid */}
      {loading ? (
        <div className="card glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          🔄 Loading destinations from WhatsApp & database…
        </div>
      ) : filteredDestinations.length === 0 ? (
        <div className="card glass" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🎯</div>
          <h3 style={{ margin: '0 0 6px 0' }}>No Destinations Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: 440, margin: '0 auto 1.5rem' }}>
            {search || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'No targets match your current filters. Try resetting the filters or search query.'
              : 'You have not connected any WhatsApp channels, groups, or test users yet. Click Add Destination to get started!'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setAddModalOpen(true)}
            disabled={!isWorking}
            style={{ padding: '8px 22px' }}
          >
            ➕ Add Your First Destination
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filteredDestinations.map(dest => {
            const isChannel = dest.type === 'channel';
            const isGroup = dest.type === 'group';
            const isUser = dest.type === 'user';
            const isTestingThis = testSendingId === dest.id;

            return (
              <div
                key={dest.id}
                className="card glass"
                style={{
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${isChannel ? '#9333ea' : isGroup ? '#2563eb' : '#d97706'}`,
                  background: dest.isActive ? 'rgba(5,150,105,0.02)' : 'inherit'
                }}
              >
                <div>
                  {/* Top Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        textTransform: 'uppercase',
                        background: isChannel ? 'rgba(147,51,234,0.1)' : isGroup ? 'rgba(37,99,235,0.1)' : 'rgba(217,119,6,0.1)',
                        color: isChannel ? '#9333ea' : isGroup ? '#2563eb' : '#d97706'
                      }}>
                        {isChannel ? '📢 Channel' : isGroup ? '👥 Group' : '👤 Test User'}
                      </span>

                      {dest.isAdmin && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(217,119,6,0.12)', color: '#d97706' }}>
                          👑 Admin
                        </span>
                      )}

                      {dest.isAnnounce && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                          Broadcast Only
                        </span>
                      )}
                    </div>

                    <div>
                      {dest.outputChannel ? (
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 12,
                          background: dest.isActive ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.1)',
                          color: dest.isActive ? '#059669' : '#d97706'
                        }}>
                          {dest.isActive ? '● Deals Active' : '⏸️ Paused'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: 12, background: 'rgba(0,0,0,0.06)', color: 'var(--text-muted)' }}>
                          ○ Not in Pipeline
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Name & Target Details with Avatar */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    {dest.pictureUrl ? (
                      <img
                        src={dest.pictureUrl}
                        alt={dest.name}
                        style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: isChannel ? 'rgba(147,51,234,0.1)' : isGroup ? 'rgba(37,99,235,0.1)' : 'rgba(217,119,6,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        flexShrink: 0
                      }}>
                        {isChannel ? '📢' : isGroup ? '👥' : '👤'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '1.02rem', wordBreak: 'break-word', color: 'var(--text-main)' }}>
                        {dest.name}
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {isUser ? formatPhoneDisplay(dest.jid) : dest.jid}
                      </div>
                    </div>
                  </div>

                  {dest.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.4, maxHeight: 42, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {dest.description}
                    </div>
                  )}

                  {/* Metrics & Meta */}
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10, flexWrap: 'wrap' }}>
                    {dest.participantsCount !== null && (
                      <span>👥 <strong>{dest.participantsCount}</strong>/1,024 members</span>
                    )}
                    {dest.followersCount !== null && (
                      <span>📢 <strong>{dest.followersCount}</strong> followers (Unlimited)</span>
                    )}
                    {dest.outputChannel && (
                      <>
                        <span>🏷️ Category: <strong style={{ textTransform: 'capitalize' }}>{dest.category}</strong></span>
                        <span>⏱️ Every <strong>{dest.rateLimitMinutes}m</strong></span>
                        <span>📊 <strong>{dest.dealsPublished}</strong> deals sent</span>
                      </>
                    )}
                  </div>

                  {/* Operational Safety Limit Pill */}
                  <div style={{ marginBottom: 12, fontSize: '0.73rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {isChannel && (
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(147,51,234,0.08)', color: '#9333ea', fontWeight: 600 }}>
                        🛡️ Safe Limit: Unlimited • 3m pacing • Low Spam Risk
                      </span>
                    )}
                    {isGroup && (
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(37,99,235,0.08)', color: '#2563eb', fontWeight: 600 }}>
                        ⚠️ Safe Limit: Max 1,024 • 15m pacing • ~25 deals/day cap
                      </span>
                    )}
                    {isUser && (
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(217,119,6,0.08)', color: '#d97706', fontWeight: 600 }}>
                        🧪 Sandbox: On-Demand Test Verification Only
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {/* Pipeline Toggle */}
                    <button
                      className="btn"
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: dest.isActive ? 'rgba(217,119,6,0.1)' : dest.outputChannel ? 'rgba(5,150,105,0.1)' : 'var(--accent)',
                        color: dest.isActive ? '#d97706' : dest.outputChannel ? '#059669' : '#fff',
                        border: 'none'
                      }}
                      onClick={() => handleTogglePipeline(dest)}
                      disabled={!isWorking}
                    >
                      {dest.isActive ? '⏸️ Pause Deals' : dest.outputChannel ? '▶️ Resume Deals' : '➕ Enable Deals'}
                    </button>

                    {/* Send Test Deal */}
                    <button
                      className="btn"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: 'rgba(99,102,241,0.08)',
                        color: '#6366f1',
                        border: '1px solid rgba(99,102,241,0.25)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      onClick={() => handleSendTestDeal(dest)}
                      disabled={!isWorking || isTestingThis}
                      title="Send a real verified price drop deal to this target immediately"
                    >
                      {isTestingThis ? '🚀 Sending…' : '🎯 Test Deal'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* Settings */}
                      {dest.outputChannel && (
                        <button
                          className="btn"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}
                          onClick={() => openSettings(dest)}
                        >
                          ⚙️ Settings
                        </button>
                      )}

                      {/* Group Members */}
                      {isGroup && (
                        <button
                          className="btn"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(37,99,235,0.08)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)' }}
                          onClick={() => openGroupParticipants(dest)}
                          disabled={!isWorking}
                        >
                          👥 Members
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* Switch to Chat */}
                      <button
                        className="btn"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}
                        onClick={() => {
                          if (onOpenChat) onOpenChat(dest.jid);
                        }}
                      >
                        💬 Chat
                      </button>

                      {/* Manual Broadcaster */}
                      <button
                        className="btn"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}
                        onClick={() => {
                          if (onBroadcast) onBroadcast(dest.jid);
                        }}
                      >
                        📤 Compose
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
         MODAL 1: ➕ Add Destination (Channels, Groups & Test Users)
         ========================================================================= */}
      {addModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div className="card glass" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', background: '#fff', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.18rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>➕ Add WhatsApp Destination</span>
              </h3>
              <button onClick={() => setAddModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {/* Type Selector Segmented Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 16, background: 'rgba(0,0,0,0.05)', padding: 4, borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => { setAddType('channel'); setTargetRateLimit(3); }}
                className="btn"
                style={{
                  padding: '8px 10px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: 8,
                  background: addType === 'channel' ? '#9333ea' : 'transparent',
                  color: addType === 'channel' ? '#fff' : 'var(--text-main)',
                  border: 'none',
                  boxShadow: addType === 'channel' ? '0 2px 6px rgba(147,51,234,0.3)' : 'none'
                }}
              >
                📢 Channel
              </button>
              <button
                type="button"
                onClick={() => { setAddType('group'); setTargetRateLimit(15); }}
                className="btn"
                style={{
                  padding: '8px 10px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: 8,
                  background: addType === 'group' ? '#2563eb' : 'transparent',
                  color: addType === 'group' ? '#fff' : 'var(--text-main)',
                  border: 'none',
                  boxShadow: addType === 'group' ? '0 2px 6px rgba(37,99,235,0.3)' : 'none'
                }}
              >
                👥 Group
              </button>
              <button
                type="button"
                onClick={() => { setAddType('user'); setTargetRateLimit(1); }}
                className="btn"
                style={{
                  padding: '8px 10px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: 8,
                  background: addType === 'user' ? '#d97706' : 'transparent',
                  color: addType === 'user' ? '#fff' : 'var(--text-main)',
                  border: 'none',
                  boxShadow: addType === 'user' ? '0 2px 6px rgba(217,119,6,0.3)' : 'none'
                }}
              >
                👤 Test User
              </button>
            </div>

            {addError && (
              <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', marginBottom: 14 }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleAddDestination}>
              {/* CHANNEL FORM */}
              {addType === 'channel' && (
                <div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" checked={addChannelMode === 'create'} onChange={() => setAddChannelMode('create')} />
                      Create New Channel
                    </label>
                    <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" checked={addChannelMode === 'link'} onChange={() => setAddChannelMode('link')} />
                      Link Existing Newsletter JID
                    </label>
                  </div>

                  {addChannelMode === 'create' ? (
                    <>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Channel Name *</label>
                      <input
                        type="text"
                        className="filter-input"
                        placeholder="e.g. ShoppersDeals — Top Loot & Electronics"
                        value={newChannelName}
                        onChange={e => setNewChannelName(e.target.value)}
                        style={{ width: '100%', marginBottom: 12 }}
                        required
                      />

                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Description</label>
                      <textarea
                        className="filter-input"
                        placeholder="Verified price drops, loot alerts & authentic discounts across Indian stores."
                        value={newChannelDesc}
                        onChange={e => setNewChannelDesc(e.target.value)}
                        style={{ width: '100%', marginBottom: 12, resize: 'vertical', minHeight: 60 }}
                      />
                    </>
                  ) : (
                    <>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Channel JID / Newsletter ID *</label>
                      <input
                        type="text"
                        className="filter-input"
                        placeholder="e.g. 120363422620024343@newsletter"
                        value={channelJid}
                        onChange={e => setChannelJid(e.target.value)}
                        style={{ width: '100%', marginBottom: 12 }}
                        required
                      />

                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Display Name</label>
                      <input
                        type="text"
                        className="filter-input"
                        placeholder="e.g. ShoppersDeals Official"
                        value={channelCustomName}
                        onChange={e => setChannelCustomName(e.target.value)}
                        style={{ width: '100%', marginBottom: 12 }}
                      />
                    </>
                  )}
                </div>
              )}

              {/* GROUP FORM */}
              {addType === 'group' && (
                <div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" checked={addGroupMode === 'invite'} onChange={() => setAddGroupMode('invite')} />
                      Join via Invite Link
                    </label>
                    <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input type="radio" checked={addGroupMode === 'existing'} onChange={() => setAddGroupMode('existing')} />
                      Select Joined Group
                    </label>
                  </div>

                  {addGroupMode === 'invite' ? (
                    <>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>WhatsApp Group Invite Link *</label>
                      <input
                        type="text"
                        className="filter-input"
                        placeholder="https://chat.whatsapp.com/GzXyZ123456789"
                        value={inviteLink}
                        onChange={e => setInviteLink(e.target.value)}
                        style={{ width: '100%', marginBottom: 12 }}
                        required
                      />
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                        Paste any public WhatsApp group invite link. The connected WhatsApp session will automatically join and enable deal broadcasting.
                      </div>
                    </>
                  ) : (
                    <>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Select WhatsApp Group *</label>
                      <select
                        className="filter-input"
                        value={selectedExistingGroupId}
                        onChange={e => setSelectedExistingGroupId(e.target.value)}
                        style={{ width: '100%', marginBottom: 12 }}
                        required
                      >
                        <option value="">-- Choose a Group --</option>
                        {unlinkedGroups.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.participantsCount || '?'} members)
                          </option>
                        ))}
                      </select>
                      {unlinkedGroups.length === 0 && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                          No unlinked groups found. Try syncing with WhatsApp or join via invite link above.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TEST USER FORM */}
              {addType === 'user' && (
                <div>
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', marginBottom: 14 }}>
                    <div style={{ fontWeight: 600, color: '#d97706', fontSize: '0.85rem', marginBottom: 2 }}>
                      💡 Pre-Broadcast Personal Verification
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Add your personal WhatsApp phone number here. You can click <strong>🎯 Test Deal</strong> on your card anytime to verify live deal formatting, discount pricing, and store links before blasting your main channels.
                    </div>
                  </div>

                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>WhatsApp Phone Number *</label>
                  <input
                    type="tel"
                    className="filter-input"
                    placeholder="e.g. +91 99990 41935 or 919999041935"
                    value={userPhone}
                    onChange={e => setUserPhone(e.target.value)}
                    style={{ width: '100%', marginBottom: 12, fontFamily: 'monospace' }}
                    required
                  />

                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Tester / Device Name</label>
                  <input
                    type="text"
                    className="filter-input"
                    placeholder="e.g. Karan Arora (Admin Phone)"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    style={{ width: '100%', marginBottom: 12 }}
                  />
                </div>
              )}

              {/* SHARED PIPELINE SETTINGS */}
              <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Target Category</label>
                    <select
                      className="filter-input"
                      value={targetCategory}
                      onChange={e => setTargetCategory(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="all">All Categories</option>
                      {masterCategories.map(c => (
                        <option key={c.slug || c._id} value={c.slug || c.name?.toLowerCase()}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Broadcast Pacing (Minutes)</label>
                    <input
                      type="number"
                      className="filter-input"
                      min="1"
                      max="1440"
                      value={targetRateLimit}
                      onChange={e => setTargetRateLimit(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setAddModalOpen(false)}
                  disabled={addingTarget}
                  style={{ padding: '7px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addingTarget}
                  style={{ padding: '7px 22px', fontWeight: 600 }}
                >
                  {addingTarget ? 'Saving & Linking…' : 'Add Destination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL 2: ⚙️ Settings Modal
         ========================================================================= */}
      {settingsTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div className="card glass" style={{ width: '100%', maxWidth: 480, padding: '1.5rem', background: '#fff', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Destination Settings</h3>
              <button onClick={() => setSettingsTarget(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Destination Name</label>
              <input
                type="text"
                className="filter-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Filter Category</label>
                <select
                  className="filter-input"
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="all">All Categories</option>
                  {masterCategories.map(c => (
                    <option key={c.slug || c._id} value={c.slug || c.name?.toLowerCase()}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Pacing (Minutes)</label>
                <input
                  type="number"
                  className="filter-input"
                  min="1"
                  max="1440"
                  value={editRateLimit}
                  onChange={e => setEditRateLimit(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Dynamic Anti-Spam Safety Advice */}
            {settingsTarget.type === 'group' && parseInt(editRateLimit, 10) < 10 && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', color: '#dc2626', fontSize: '0.78rem', marginBottom: 14 }}>
                ⚠️ <strong>High Spam Hazard:</strong> Setting group broadcast interval under 10 minutes risks WhatsApp automated anti-spam detection on your phone number. Minimum 15 minutes is strongly recommended.
              </div>
            )}
            {settingsTarget.type === 'group' && parseInt(editRateLimit, 10) >= 10 && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(37,99,235,0.06)', color: '#2563eb', fontSize: '0.78rem', marginBottom: 14 }}>
                💡 <strong>Group Safety Limit:</strong> 15m delay ensures safe throughput (~20–30 deals/day) without triggering member churn or spam bans.
              </div>
            )}
            {settingsTarget.type === 'channel' && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(147,51,234,0.06)', color: '#9333ea', fontSize: '0.78rem', marginBottom: 14 }}>
                💡 <strong>Channel Safety Limit:</strong> Channels support fast 3–5m pacing with zero spam reporting risk from followers.
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>Target Country</label>
              <select
                className="filter-input"
                value={editCountry}
                onChange={e => setEditCountry(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="IN">India (IN - ₹ INR)</option>
                <option value="US">United States (US - $ USD)</option>
                <option value="all">Global (All)</option>
              </select>
            </div>

            {settingsTarget.type === 'group' && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.18)', marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#2563eb', marginBottom: 10 }}>
                  WhatsApp Group Profile & Branding
                </div>

                {/* Group Logo */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Group Logo / Profile Picture URL</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {editGroupPicUrl && (
                      <img src={editGroupPicUrl} alt="Logo" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
                    )}
                    <input
                      type="text"
                      className="filter-input"
                      value={editGroupPicUrl}
                      onChange={e => setEditGroupPicUrl(e.target.value)}
                      placeholder="https://..."
                      style={{ flex: 1, fontSize: '0.8rem' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn"
                    style={{ marginTop: 6, padding: '4px 10px', fontSize: '0.74rem', background: 'rgba(37,99,235,0.08)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)' }}
                    onClick={() => setEditGroupPicUrl('https://www.shoppersdeals.in/web-app-manifest-512x512.png')}
                  >
                    🖼️ Use Official ShoppersDeals Logo
                  </button>
                </div>

                {/* Group Description */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Group Description</label>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '2px 8px', fontSize: '0.72rem', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border)' }}
                      onClick={() => setEditGroupDesc("Welcome to ShoppersDeals Official! 🔥\n\nWe track and broadcast verified price drops, lightning loot deals & authentic discounts across Amazon, Flipkart, Myntra & Nykaa.\n\n⚡ Real price drops verified against historical lows\n🛍️ Hand-curated electronics, fashion & daily loots\n🌐 Website: https://www.shoppersdeals.in\n\nSave big on every purchase!")}
                    >
                      ✨ Insert Template
                    </button>
                  </div>
                  <textarea
                    className="filter-input"
                    rows={4}
                    value={editGroupDesc}
                    onChange={e => setEditGroupDesc(e.target.value)}
                    style={{ width: '100%', fontSize: '0.8rem', resize: 'vertical' }}
                    placeholder="Enter group description..."
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="btn"
                style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', border: 'none', fontSize: '0.82rem' }}
                onClick={handleDeleteFromPipeline}
                disabled={deletingTarget}
              >
                {deletingTarget ? 'Removing…' : '🗑️ Remove from Pipeline'}
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSettingsTarget(null)}
                  disabled={savingSettings}
                  style={{ padding: '6px 14px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  style={{ padding: '6px 18px', fontWeight: 600 }}
                >
                  {savingSettings ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
         MODAL 3: 👥 Group Participants & Leads Inspection
         ========================================================================= */}
      {activeGroup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div className="card glass" style={{ width: '100%', maxWidth: 580, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>👥 {activeGroup.name}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {participants ? `${participants.length} members loaded` : 'Loading participants…'}
                </div>
              </div>
              <button onClick={() => setActiveGroup(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {importResult && (
              <div style={{ background: 'rgba(5,150,105,0.08)', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', marginBottom: 12 }}>
                🎉 Successfully imported <strong>{importResult.importedCount}</strong> new leads into ShoppersDeals CRM!
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
              {participantsLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Fetching live participants from WhatsApp…
                </div>
              ) : !participants || participants.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No participants found.
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.03)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Phone / JID</th>
                      <th style={{ padding: '8px 12px' }}>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map(p => (
                      <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                          {formatPhoneDisplay(p.phoneNumber || p.id)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {p.isAdmin ? (
                            <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 8, background: 'rgba(217,119,6,0.1)', color: '#d97706', fontWeight: 600 }}>
                              👑 Admin
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Member</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={handleImportLeads}
                disabled={importingLeads || !participants || participants.length === 0}
                style={{ padding: '7px 16px', fontSize: '0.82rem' }}
              >
                {importingLeads ? 'Importing Leads…' : `📥 Import All (${participants?.length || 0}) as CRM Leads`}
              </button>

              <button
                className="btn"
                onClick={() => setActiveGroup(null)}
                style={{ padding: '7px 16px', fontSize: '0.82rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   TAB 3: 🎯 Deal Broadcaster (Shoppers Deals Studio)
   ========================================================================= */
function DealBroadcasterTab({ channelId, isWorking, apiFetch, prefillTarget, onClearPrefill }) {
  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState(null);

  // Broadcaster form state
  const [targetChatId, setTargetChatId] = useState(prefillTarget || '');
  const [mode, setMode] = useState('image'); // 'image' | 'text'
  const [imageUrl, setImageUrl] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Sync prefill target if supplied from another tab
  useEffect(() => {
    if (prefillTarget) {
      setTargetChatId(prefillTarget);
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefillTarget, onClearPrefill]);

  // Load verified deals
  useEffect(() => {
    setDealsLoading(true);
    fetch('https://api.shoppersdeals.in/api/deals?limit=8&country=IN')
      .then(r => r.json())
      .then(d => {
        if (d?.success && Array.isArray(d.data)) {
          setDeals(d.data);
        }
      })
      .catch(() => {})
      .finally(() => setDealsLoading(false));
  }, []);

  const selectDeal = (d) => {
    setSelectedDeal(d);
    setImageUrl(d.imageUrl || '');

    const price = d.dealPrice ? `₹${d.dealPrice.toLocaleString('en-IN')}` : 'Special Price';
    const original = d.originalPrice ? `~₹${d.originalPrice.toLocaleString('en-IN')}~` : '';
    const discount = d.discountPercentage ? `*${d.discountPercentage}% OFF*` : '';
    const merchant = (d.merchant || 'Amazon').toUpperCase();
    const link = `https://www.shoppersdeals.in/r/${d._id}?src=wa`;
    const targetProdId = d.matchedProductId || d.productId || d._id;
    const webLink = `https://www.shoppersdeals.in/product/${targetProdId}`;

    const text = `*🔥 ${d.title || 'Special Deal'} 🔥*

💰 *Deal Price:* ${price} ${original} ${discount}
🛒 *Store:* ${merchant} | Verified Authentic
👉 *Buy Now:* ${link}

📊 *Price History & Alerts:* ${webLink}

_Shared via ShoppersDeals_`;

    setMessageText(text);
  };

  const handleSendBroadcast = async () => {
    if (!targetChatId.trim()) {
      alert('Please enter a target recipient (Channel JID, Group JID, or phone number).');
      return;
    }
    if (mode === 'image' && !imageUrl.trim()) {
      alert('Image URL is required for Photo mode.');
      return;
    }
    if (mode === 'text' && !messageText.trim()) {
      alert('Message text is required.');
      return;
    }

    setSending(true);
    setSendResult(null);
    try {
      let res;
      if (mode === 'image') {
        res = await apiFetch(`/api/output-channels/${channelId}/waha/send-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: targetChatId.trim(), imageUrl: imageUrl.trim(), caption: messageText })
        });
      } else {
        res = await apiFetch(`/api/output-channels/${channelId}/waha/send-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: targetChatId.trim(), text: messageText })
        });
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Broadcast failed');
      setSendResult({ ok: true, message: data.message || 'Successfully broadcasted!' });
    } catch (err) {
      setSendResult({ ok: false, message: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      {!isWorking && (
        <div className="card glass" style={{ padding: '1.2rem', marginBottom: 14, background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.3rem' }}>🔒</span>
            <div>
              <div style={{ fontWeight: 600, color: '#d97706' }}>WhatsApp Account Pairing Required</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Please scan the QR code above with your WhatsApp app before broadcasting deals.
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem' }}>ShoppersDeals Broadcast Studio</h3>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Pick an authentic price-drop deal or craft a custom announcement to dispatch to your WhatsApp Channel or Group.
        </div>
      </div>

      {/* Live Verified Deals Picker */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🔥 Pick a Live Verified Deal</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>(1-Click formats photo, discount & affiliate link)</span>
        </div>

        {dealsLoading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading live deals…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {deals.map(d => (
              <div
                key={d._id}
                onClick={() => selectDeal(d)}
                className="card glass"
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  cursor: 'pointer',
                  border: selectedDeal?._id === d._id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedDeal?._id === d._id ? 'rgba(37,99,235,0.05)' : 'rgba(0,0,0,0.02)'
                }}
              >
                {d.imageUrl && (
                  <img src={d.imageUrl} alt={d.title} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, background: '#fff' }} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
                    ₹{d.dealPrice?.toLocaleString('en-IN')}
                    {d.discountPercentage && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--danger)' }}>{d.discountPercentage}% OFF</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Studio Workspace: Form + Live WhatsApp Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'flex-start' }}>
        {/* Left: Broadcast Form */}
        <div className="card glass" style={{ padding: '1.4rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Target Recipient</label>
          <input
            type="text"
            className="filter-input"
            placeholder="e.g. 1203...@newsletter or 1203...@g.us or 919999999999"
            value={targetChatId}
            onChange={e => setTargetChatId(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', marginBottom: 12 }}
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: mode === 'image' ? 'var(--accent)' : 'rgba(0,0,0,0.05)',
                color: mode === 'image' ? '#fff' : 'inherit',
                border: '1px solid var(--border)'
              }}
              onClick={() => setMode('image')}
            >
              🖼️ Photo + Caption (Recommended)
            </button>
            <button
              type="button"
              className="btn"
              style={{
                flex: 1,
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: mode === 'text' ? 'var(--accent)' : 'rgba(0,0,0,0.05)',
                color: mode === 'text' ? '#fff' : 'inherit',
                border: '1px solid var(--border)'
              }}
              onClick={() => setMode('text')}
            >
              📝 Plain Text Only
            </button>
          </div>

          {mode === 'image' && (
            <>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Image URL</label>
              <input
                type="text"
                className="filter-input"
                placeholder="https://m.media-amazon.com/images/..."
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', marginBottom: 12 }}
              />
            </>
          )}

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Message Text / Caption</label>
          <textarea
            className="filter-input"
            rows={8}
            placeholder="Type your WhatsApp formatted message (*bold*, ~strikethrough~, emoji, buy link)..."
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', marginBottom: 14, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem' }}
          />

          {sendResult && (
            <div style={{
              background: sendResult.ok ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
              color: sendResult.ok ? '#059669' : 'var(--danger)',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: '0.85rem',
              marginBottom: 14
            }}>
              {sendResult.ok ? '✅ ' : '⚠️ '}{sendResult.message}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px 24px', fontSize: '0.9rem', fontWeight: 700 }}
            onClick={handleSendBroadcast}
            disabled={sending || !targetChatId.trim() || !isWorking}
          >
            {sending ? '🚀 Dispatching Broadcast…' : '🚀 Dispatch Broadcast'}
          </button>
        </div>

        {/* Right: Live WhatsApp Phone Preview */}
        <div className="card glass" style={{ padding: '1.4rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10, color: 'var(--text-main)' }}>
            📱 WhatsApp Message Preview
          </div>

          {/* WhatsApp Chat Bubble Mockup */}
          <div style={{ background: '#0b141a', borderRadius: 12, padding: '1rem', minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '16px 16px' }}>
            <div style={{
              alignSelf: 'flex-end',
              maxWidth: '85%',
              background: '#005c4b',
              color: '#e9edef',
              borderRadius: '10px 0 10px 10px',
              padding: '8px 12px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              fontSize: '0.82rem',
              lineHeight: 1.5,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap'
            }}>
              {mode === 'image' && imageUrl && (
                <img
                  src={imageUrl}
                  alt="Deal Preview"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, marginBottom: 8, background: '#fff' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              {messageText || <span style={{ opacity: 0.6, fontStyle: 'italic' }}>Message preview will appear here...</span>}
              <div style={{ textAlign: 'right', fontSize: '0.65rem', opacity: 0.7, marginTop: 4 }}>
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   TAB 4: 💬 Live Chats & Conversations
   ========================================================================= */
function ChatsTab({ channelId, isWorking, apiFetch, onComposeTo }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const loadChats = useCallback(async () => {
    if (!isWorking) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/chats?limit=30`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load chats');
      setChats(data.chats || []);
      if (!activeChat && data.chats?.length > 0) {
        openChat(data.chats[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, channelId, isWorking]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const openChat = async (c) => {
    setActiveChat(c);
    setMessagesLoading(true);
    try {
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/chats/${encodeURIComponent(c.id)}/messages?limit=25`);
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages((data.messages || []).reverse());
      }
    } catch (err) {
      console.warn('Error loading messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!activeChat || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChat.id, text: replyText.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Send failed');
      setReplyText('');
      await openChat(activeChat);
    } catch (err) {
      alert('Error sending reply: ' + err.message);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div>
      {!isWorking && (
        <div className="card glass" style={{ padding: '1.2rem', marginBottom: 14, background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.3rem' }}>🔒</span>
            <div>
              <div style={{ fontWeight: 600, color: '#d97706' }}>WhatsApp Account Pairing Required</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Please scan the QR code above with your WhatsApp app to view live chats and send 1-on-1 replies.
              </div>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 14, minHeight: 460 }}>
        {/* Left: Chat List */}
        <div className="card glass" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Recent Conversations</span>
            <button className="btn" style={{ padding: '3px 8px', fontSize: '0.75rem' }} onClick={loadChats} disabled={loading}>
              ↻
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading conversations…</div>
            ) : chats.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No chats found.</div>
            ) : (
              chats.map(c => {
                const isSelected = activeChat?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => openChat(c)}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(37,99,235,0.08)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isSelected ? 'var(--accent)' : 'inherit' }}>
                        {c.name}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {formatTimestamp(c.lastMessage?.timestamp)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.lastMessage?.fromMe && 'You: '}{c.lastMessage?.body || <em>no messages</em>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Message Viewer & Quick Reply */}
        <div className="card glass" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeChat ? (
            <>
              {/* Header */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{activeChat.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{activeChat.id}</div>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                  onClick={() => onComposeTo(activeChat.id)}
                >
                  🚀 Open in Broadcaster
                </button>
              </div>

              {/* Messages Body */}
              <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(0,0,0,0.01)' }}>
                {messagesLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No messages in this chat.</div>
                ) : (
                  messages.map(m => (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: m.fromMe ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        padding: '8px 12px',
                        borderRadius: m.fromMe ? '10px 0 10px 10px' : '0 10px 10px 10px',
                        background: m.fromMe ? 'rgba(37,99,235,0.1)' : 'rgba(0,0,0,0.05)',
                        color: m.fromMe ? 'var(--accent)' : 'inherit',
                        fontSize: '0.82rem',
                        lineHeight: 1.4
                      }}
                    >
                      <div>{m.body}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>
                        {formatTimestamp(m.timestamp)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Reply Bar */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Type a quick reply..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendReply(); }}
                  style={{ flex: 1, padding: '8px 12px' }}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontSize: '0.85rem' }}
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyText.trim()}
                >
                  {sendingReply ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a conversation to view message history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   🖥️ Live Chromium Screen & Debug Inspector
   ========================================================================= */
function ScreenshotTab({ channelId, apiFetch }) {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capturedAt, setCapturedAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const consecutiveFailures = useRef(0);

  const capture = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/screenshot`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to capture screenshot');
      }
      setImage(`data:${data.mimetype};base64,${data.data}`);
      setCapturedAt(new Date());
      setError('');
      consecutiveFailures.current = 0;
    } catch (err) {
      consecutiveFailures.current += 1;
      setError(err.message);
      if (consecutiveFailures.current >= 3) {
        setAutoRefresh(false);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, channelId]);

  useEffect(() => {
    capture();
  }, [capture]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      capture();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, capture]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-primary" style={{ padding: '6px 18px', fontSize: '0.85rem' }} onClick={capture} disabled={loading}>
            {loading ? 'Capturing…' : '🔄 Refresh Screenshot'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            Auto-refresh (every 3s)
          </label>
        </div>

        {capturedAt && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Captured at {capturedAt.toLocaleTimeString()}</span>}
      </div>

      {error && (
        <div style={{ background: 'rgba(217,119,6,0.08)', color: '#d97706', border: '1px solid rgba(217,119,6,0.2)', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ {error}</span>
          <button className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={capture}>Retry</button>
        </div>
      )}

      {image ? (
        <div className="card glass" style={{ padding: 10, textAlign: 'center', background: '#0b141a' }}>
          <img src={image} alt="WhatsApp Web Live Screenshot" style={{ width: '100%', maxWidth: 900, borderRadius: 8, display: 'inline-block', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          {loading ? 'Capturing live screen…' : 'No screenshot available yet. Click Refresh Screenshot to capture.'}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   Live Screen Modal Popup
   ========================================================================= */
function LiveScreenModal({ channelId, apiFetch, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card glass" style={{ width: '100%', maxWidth: 860, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '1.2rem', background: 'var(--card-bg, #fff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>📷 WhatsApp Web Live Screen</h3>
          <button className="btn" style={{ padding: '4px 10px', fontSize: '0.85rem' }} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ScreenshotTab channelId={channelId} apiFetch={apiFetch} />
        </div>
      </div>
    </div>
  );
}
