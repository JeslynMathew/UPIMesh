import React, { useState, useEffect, useCallback, useRef } from "react";
import { Smartphone, Radio, ServerCog, ShieldCheck, ShieldAlert, Copy, Send, RefreshCw, Trash2, Wifi, WifiOff, Info, X } from "lucide-react";

// ---- design tokens ----------------------------------------------------
const C = {
  bg: "#0B0F14",
  panel: "#121820",
  panel2: "#171E27",
  line: "#232C38",
  text: "#E7EDF3",
  sub: "#7E8CA0",
  faint: "#4C5A6C",
  green: "#3DDC97",
  amber: "#F5A623",
  red: "#E5484D",
  blue: "#4FA3F5",
};

const OUTCOME_STYLE = {
  SETTLED: { color: C.green, label: "SETTLED", Icon: ShieldCheck },
  DUPLICATE_DROPPED: { color: C.amber, label: "DUPLICATE DROPPED", Icon: Copy },
  INVALID: { color: C.red, label: "INVALID", Icon: ShieldAlert },
  REJECTED: { color: C.red, label: "REJECTED", Icon: ShieldAlert },
};

function Badge({ outcome }) {
  const s = OUTCOME_STYLE[outcome] ?? { color: C.sub, label: String(outcome ?? "UNKNOWN"), Icon: Info };
  const { Icon } = s;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: s.color, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>
      <Icon size={12} /> {s.label}
    </span>
  );
}

// ---- layout: positions derived from real device list -------------------
const BACKEND_POS = { x: 660, y: 200 };

function layoutDevices(devices) {
  const alice = devices.find((d) => d.deviceId === "phone-alice");
  const others = devices.filter((d) => !d.hasInternet && d.deviceId !== "phone-alice");
  const bridges = devices.filter((d) => d.hasInternet);
  const pos = {};
  if (alice) pos[alice.deviceId] = { x: 60, y: 200 };
  others.forEach((d, i) => {
    pos[d.deviceId] = { x: 300, y: 60 + (i * 280) / Math.max(1, others.length - 1 || 1) };
  });
  if (others.length === 1) pos[others[0].deviceId] = { x: 300, y: 200 };
  bridges.forEach((d, i) => {
    pos[d.deviceId] = { x: 490, y: bridges.length === 1 ? 200 : 100 + i * 200 };
  });
  return pos;
}

function pctOf(p) {
  return { left: `${(p.x / 720) * 100}%`, top: `${(p.y / 400) * 100}%` };
}

function DeviceNode({ device, pos, displayName }) {
  const online = device.hasInternet;
  return (
    <div style={{ position: "absolute", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 2, ...pctOf(pos) }}>
      <div style={{
        width: 50, height: 50, borderRadius: 14, background: C.panel2,
        border: `1.5px solid ${online ? C.green : C.line}`, display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: device.packetCount > 0 ? `0 0 0 4px ${online ? C.green : C.blue}22` : "none", position: "relative",
      }}>
        <Smartphone size={20} color={online ? C.green : C.sub} />
        {online ? <Wifi size={11} color={C.green} style={{ position: "absolute", top: -5, right: -5 }} /> : null}
        {device.packetCount > 0 && (
          <div style={{
            position: "absolute", bottom: -6, right: -6, background: C.blue, color: "#04101f",
            fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
          }}>
            {device.packetCount}
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", lineHeight: 1.2 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: C.text, fontWeight: 600 }}>{displayName || device.deviceId}</div>
        <div style={{ fontSize: 9, color: C.faint }}>{device.deviceId}{online ? " · has 4G" : " · offline"}</div>
      </div>
    </div>
  );
}

function BackendNode() {
  return (
    <div style={{ position: "absolute", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 2, ...pctOf(BACKEND_POS) }}>
      <div style={{ width: 54, height: 54, borderRadius: 10, background: C.panel2, border: `1.5px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ServerCog size={22} color={C.sub} />
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, color: C.text, fontWeight: 600 }}>backend</div>
    </div>
  );
}

function MeshLines({ posMap, devices }) {
  const alice = devices.find((d) => d.deviceId === "phone-alice");
  const others = devices.filter((d) => !d.hasInternet && d.deviceId !== "phone-alice");
  const bridges = devices.filter((d) => d.hasInternet);
  const segs = [];
  others.forEach((o) => { if (alice) segs.push([alice.deviceId, o.deviceId]); });
  others.forEach((o) => bridges.forEach((b) => segs.push([o.deviceId, b.deviceId])));
  bridges.forEach((b) => segs.push([b.deviceId, "__backend__"]));
  return (
    <svg viewBox="0 0 720 400" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }}>
      {segs.map(([a, b], i) => {
        const pa = a === "__backend__" ? BACKEND_POS : posMap[a];
        const pb = b === "__backend__" ? BACKEND_POS : posMap[b];
        if (!pa || !pb) return null;
        return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={C.line} strokeWidth={1.5} strokeDasharray="3 5" />;
      })}
    </svg>
  );
}

function FlyingDot({ anim }) {
  const from = anim.from;
  const to = BACKEND_POS;
  const pos = anim.arrived ? to : from;
  const color = anim.outcome ? (OUTCOME_STYLE[anim.outcome]?.color ?? C.sub) : C.blue;
  return (
    <div style={{
      position: "absolute", width: 11, height: 11, borderRadius: 999, background: color,
      boxShadow: `0 0 12px 2px ${color}88`, transform: "translate(-50%,-50%)",
      transition: "left .65s cubic-bezier(.4,0,.2,1), top .65s cubic-bezier(.4,0,.2,1), opacity .35s ease",
      opacity: anim.fading ? 0 : 1, zIndex: 3, ...pctOf(pos),
    }} />
  );
}

// ---- main component ----------------------------------------------------
export default function UpiMeshDashboard() {
  const [apiBase, setApiBase] = useState("http://localhost:8080");
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [meshState, setMeshState] = useState({ devices: [], idempotencyCacheSize: 0 });
  const [log, setLog] = useState([]);
  const [anims, setAnims] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connError, setConnError] = useState(null);

  const [senderVpa, setSenderVpa] = useState("alice@demo");
  const [receiverVpa, setReceiverVpa] = useState("bob@demo");
  const [amount, setAmount] = useState(500);
  const [pin, setPin] = useState("1234");

  const pushLog = useCallback((msg) => {
    setLog((prev) => [{ t: new Date().toLocaleTimeString(), msg }, ...prev].slice(0, 60));
  }, []);

  const api = useCallback(
    async (path, opts) => {
      try {
        const res = await fetch(`${apiBase}${path}`, {
          headers: { "Content-Type": "application/json" },
          ...opts,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setConnError(null);
        return await res.json();
      } catch (e) {
        setConnError(e.message || "request failed");
        throw e;
      }
    },
    [apiBase]
  );

  const refreshAll = useCallback(async () => {
    try {
      const [accs, txs, mesh] = await Promise.all([
        api("/api/accounts"),
        api("/api/transactions"),
        api("/api/mesh/state"),
      ]);
      setAccounts(accs);
      setTransactions(txs);
      setMeshState(mesh);
    } catch (e) {
      // connError already set by api()
    }
  }, [api]);

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 4000);
    return () => clearInterval(id);
  }, [refreshAll]);

  const sendPacket = async () => {
    setBusy(true);
    try {
      const r = await api("/api/demo/send", {
        method: "POST",
        body: JSON.stringify({
          senderVpa, receiverVpa, amount: Number(amount), pin, ttl: 5, startDevice: "phone-alice",
        }),
      });
      pushLog(`sent ₹${amount}: ${senderVpa} → ${receiverVpa} — packet ${r.packetId.slice(0, 8)} injected at ${r.injectedAt} (ttl ${r.ttl})`);
      await refreshAll();
    } catch (e) {
      pushLog(`send failed: ${e.message}`);
    }
    setBusy(false);
  };

  const gossip = async () => {
    setBusy(true);
    try {
      const r = await api("/api/mesh/gossip", { method: "POST" });
      pushLog(`gossip round: ${r.transfers} transfer(s) — ${JSON.stringify(r.deviceCounts)}`);
      await refreshAll();
    } catch (e) {
      pushLog(`gossip failed: ${e.message}`);
    }
    setBusy(false);
  };

  const flush = async () => {
    setBusy(true);
    // snapshot bridge device positions before we flush, to animate from the right spot
    const posMap = layoutDevices(meshState.devices);
    try {
      const r = await api("/api/mesh/flush", { method: "POST" });
      pushLog(`flush: ${r.uploadsAttempted} bridge upload(s) attempted`);
      const newAnims = r.results.map((res, i) => ({
        id: `${res.bridgeNode}-${res.packetId}-${Date.now()}-${i}`,
        from: posMap[res.bridgeNode] ?? BACKEND_POS,
        outcome: null,
        arrived: false,
        fading: false,
      }));
      setAnims(newAnims);
      // trigger the fly-in on next tick
      setTimeout(() => {
        setAnims((prev) => prev.map((a, i) => ({ ...a, arrived: true, outcome: r.results[i]?.outcome })));
      }, 40);
      r.results.forEach((res) => {
        pushLog(`  ${res.bridgeNode} · packet ${res.packetId} → ${res.outcome}${res.reason ? ` (${res.reason})` : ""}`);
      });
      setTimeout(() => setAnims((prev) => prev.map((a) => ({ ...a, fading: true }))), 750);
      setTimeout(() => setAnims([]), 1150);
      await refreshAll();
    } catch (e) {
      pushLog(`flush failed: ${e.message}`);
    }
    setBusy(false);
  };

  const resetMesh = async () => {
    setBusy(true);
    try {
      await api("/api/mesh/reset", { method: "POST" });
      pushLog("mesh + idempotency cache cleared");
      await refreshAll();
    } catch (e) {
      pushLog(`reset failed: ${e.message}`);
    }
    setBusy(false);
  };

  const posMap = layoutDevices(meshState.devices);
  const vpas = accounts.length ? accounts.map((a) => a.vpa) : ["alice@demo", "bob@demo", "carol@demo", "dave@demo"];

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1200px 600px at 15% -10%, #12202033, transparent), ${C.bg}`, color: C.text, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", padding: "26px 20px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        input, select { outline: none; }
        input:focus, select:focus { border-color: ${C.green} !important; }
        .mesh-btn { transition: all .15s ease; cursor: pointer; }
        .mesh-btn:hover { transform: translateY(-1px); filter: brightness(1.08); }
        .mesh-btn:disabled { opacity: .5; cursor: not-allowed; transform:none; }
      `}</style>

      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div>
            
            <h1 style={{ fontSize: 28, margin: 0, fontWeight: 600, letterSpacing: -0.5 }}>MeshUPI</h1>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            
            <button className="mesh-btn" onClick={() => setShowInfo(true)} style={btnStyle(C.sub)}><Info size={13} /> how it works</button>
          </div>
        </div>

        {connError && (
          <div style={{ background: "#3a1418", border: `1px solid ${C.red}55`, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 16, fontFamily: "'IBM Plex Mono', monospace" }}>
            can't reach {apiBase} — {connError}. Confirm the backend is running and CORS allows this origin.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 18 }}>
          {/* LEFT: mesh viz */}
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18 }}>
            <div style={{ position: "relative", width: "100%", aspectRatio: "720/400", background: C.bg, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}` }}>
              <MeshLines posMap={posMap} devices={meshState.devices} />
              {meshState.devices.map((d) => (
                <DeviceNode
                  key={d.deviceId}
                  device={d}
                  pos={posMap[d.deviceId]}
                  displayName={d.deviceId === "phone-alice" ? (accounts.find((a) => a.vpa === senderVpa)?.holderName ?? senderVpa) : null}
                />
              ))}
              <BackendNode />
              {anims.map((a) => <FlyingDot key={a.id} anim={a} />)}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button className="mesh-btn" disabled={busy} onClick={gossip} style={btnStyle(C.blue)}>
                <Radio size={13} /> Run gossip round
              </button>
              <button className="mesh-btn" disabled={busy} onClick={flush} style={btnStyle(C.amber)}>
                <Wifi size={13} /> Flush bridges to backend
              </button>
              <button className="mesh-btn" disabled={busy} onClick={resetMesh} style={btnStyle(C.red)}>
                <Trash2 size={13} /> Reset mesh + cache
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10 }}>
              idempotency cache: {meshState.idempotencyCacheSize} · tip: press "Flush" twice without resetting to see a real duplicate get dropped
            </div>
          </div>

          {/* RIGHT: console */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <Field label="From">
                  <select value={senderVpa} onChange={(e) => setSenderVpa(e.target.value)} style={selStyle}>
                    {vpas.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="To">
                  <select value={receiverVpa} onChange={(e) => setReceiverVpa(e.target.value)} style={selStyle}>
                    {vpas.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Amount (₹)">
                  <input type="number" value={amount} min={0} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="PIN">
                  <input type="password" inputMode="numeric" value={pin} maxLength={4} onChange={(e) => setPin(e.target.value)} style={inputStyle} />
                </Field>
              </div>
              <button className="mesh-btn" disabled={busy} onClick={sendPacket} style={{ marginTop: 14, width: "100%", background: C.green, color: "#062017", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Send size={15} /> Encrypt & inject into mesh
              </button>
            </div>

            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 10, letterSpacing: 0.5 }}>ACCOUNT BALANCES</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {accounts.map((a) => (
                  <div key={a.vpa} style={{ background: C.panel2, borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", border: `1px solid ${C.line}` }}>
                    <span style={{ fontSize: 12, color: a.vpa === senderVpa ? C.green : C.text }}>{a.holderName}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: C.sub }}>₹{Number(a.balance).toFixed(2)}</span>
                  </div>
                ))}
                {accounts.length === 0 && <div style={{ color: C.faint, fontSize: 12 }}>waiting for backend…</div>}
              </div>
            </div>
          </div>
        </div>

        {/* ledger */}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginTop: 18 }}>
          <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 10, letterSpacing: 0.5 }}>TRANSACTION LEDGER</div>
          {transactions.length === 0 ? (
            <div style={{ color: C.faint, fontSize: 13, padding: "20px 0", textAlign: "center" }}>No settled transactions yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ color: C.faint, textAlign: "left" }}>
                    {["ID", "From", "To", "Amount", "Status", "Bridge", "Hops", "Settled"].map((h) => (
                      <th key={h} style={{ fontWeight: 500, padding: "6px 10px", borderBottom: `1px solid ${C.line}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td style={tdStyle}>{t.id}</td>
                      <td style={tdStyle}>{t.senderVpa}</td>
                      <td style={tdStyle}>{t.receiverVpa}</td>
                      <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace" }}>₹{Number(t.amount).toFixed(2)}</td>
                      <td style={tdStyle}><Badge outcome={t.status} /></td>
                      <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", color: C.sub }}>{t.bridgeNodeId}</td>
                      <td style={tdStyle}>{t.hopCount}</td>
                      <td style={{ ...tdStyle, color: C.faint }}>{new Date(t.settledAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* activity log */}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginTop: 18 }}>
          <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 10, letterSpacing: 0.5 }}>ACTIVITY LOG</div>
          <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, maxHeight: 220, overflowY: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, color: C.sub }}>
            {log.length === 0 && <div style={{ color: C.faint }}>nothing yet</div>}
            {log.map((l, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <span style={{ color: C.faint }}>[{l.t}]</span> {l.msg}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showInfo && (
        <div onClick={() => setShowInfo(false)} style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 24, maxWidth: 540 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>The three-step flow</div>
              <X size={18} style={{ cursor: "pointer", color: C.sub }} onClick={() => setShowInfo(false)} />
            </div>
            <ol style={{ color: C.sub, fontSize: 13.5, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
              <li><strong style={{ color: C.text }}>Encrypt & inject</strong> — your phone (phone-alice) builds and RSA/AES-encrypts a real payment, then holds it.</li>
              <li><strong style={{ color: C.text }}>Run gossip round</strong> — every device shares what it holds with every other device, TTL drops by one hop each time.</li>
              <li><strong style={{ color: C.text }}>Flush bridges</strong> — any device with a signal (phone-bridge) uploads everything it's holding to the real backend, which decrypts, checks freshness, and settles.</li>
            </ol>
            <div style={{ color: C.sub, fontSize: 13, marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
              Uploaded packets aren't cleared from the device — so pressing <strong style={{ color: C.text }}>Flush</strong> a second time re-uploads the same packet, and you'll watch the real idempotency cache drop it as a duplicate.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = (color) => ({
  display: "flex", alignItems: "center", gap: 6, background: "transparent",
  border: `1px solid ${color}55`, color, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 500,
});
const selStyle = { width: "100%", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text, padding: "9px 10px", fontSize: 13.5 };
const inputStyle = { ...selStyle };
const tdStyle = { padding: "8px 10px", borderBottom: `1px solid ${C.line}` };

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}