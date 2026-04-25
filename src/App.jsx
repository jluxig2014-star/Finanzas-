import { useState, useCallback, useMemo, useEffect } from "react";

const Q = (n) => `Q${Number(n).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qk = (n) => n >= 1000 ? `Q${(n/1000).toFixed(1)}k` : Q(n);
const today = () => new Date().toISOString().split("T")[0];
const weekLabel = () => new Date().toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "2-digit" });

const C = {
  bg:       "#f4f6f8",
  white:    "#ffffff",
  border:   "#e0e6ed",
  blue:     "#1a6fc4",
  blueLt:   "#e8f1fb",
  blueAcct: "#2563eb",
  green:    "#16a34a",
  greenLt:  "#dcfce7",
  red:      "#dc2626",
  redLt:    "#fee2e2",
  orange:   "#d97706",
  orangeLt: "#fef3c7",
  slate:    "#334155",
  slateM:   "#64748b",
  slateL:   "#94a3b8",
  text:     "#1e293b",
};

const DEFAULTS = {
  cuentaMonetaria: 734.35,
  cuentaAhorro: 7043.43,
  planDorado: 2999.97,
  planDoradoTasa: 2.88,
  planDoradoTasaReal: 2.59,
  carroValor: 56000,
  casaValor: 200000,
  deudaCasa: 82050,
  deudaCasaOriginal: 82050,
  salario: 9200,
  rentaIngreso: 1300,
  abonoCasa: 1000,
  ahorroMensual: 1000,
  aporteDorado: 150,
  seguroVida: 12,
  tcLimite: 19200,
  tcGastado: 0,
};

const LABELS = {
  cuentaMonetaria: "Cuenta Monetaria",
  cuentaAhorro: "Cuenta de Ahorro",
  planDorado: "Plan Dorado (capital actual)",
  planDoradoTasa: "Tasa Plan Dorado — antes de impuestos (%)",
  planDoradoTasaReal: "Tasa Plan Dorado — después de impuestos (%)",
  carroValor: "Valor del Carro",
  casaValor: "Valor de la Casa",
  deudaCasa: "Deuda Restante Casa",
  deudaCasaOriginal: "Deuda Original Casa (referencia progreso)",
  salario: "Salario Mensual",
  rentaIngreso: "Ingreso por Renta",
  abonoCasa: "Abono mensual casa",
  ahorroMensual: "Ahorro depositado este mes",
  aporteDorado: "Aporte mensual Plan Dorado",
  seguroVida: "Descuento seguro de vida",
  tcLimite: "Tarjeta de Crédito — Límite",
  tcGastado: "Tarjeta de Crédito — Gastado este mes",
};

const GROUPS = {
  "Caja": ["cuentaMonetaria","cuentaAhorro","planDorado","planDoradoTasa","planDoradoTasaReal"],
  "Tarjeta de Crédito": ["tcLimite","tcGastado"],
  "Activos": ["carroValor","casaValor","deudaCasa","deudaCasaOriginal"],
  "Ingresos": ["salario","rentaIngreso"],
  "Egresos fijos": ["abonoCasa","ahorroMensual","aporteDorado","seguroVida"],
};

const storage = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function getAlertas(data, cajaNeta, tcUsoPct, diasSinRegistro) {
  const a = [];
  if (tcUsoPct >= 70) a.push({ type: "red", msg: `Tarjeta al ${tcUsoPct.toFixed(0)}% de uso — considera pausar gastos.` });
  else if (tcUsoPct >= 50) a.push({ type: "orange", msg: `Tarjeta al ${tcUsoPct.toFixed(0)}% del límite.` });
  if (cajaNeta < data.tcGastado) a.push({ type: "red", msg: "Caja neta es menor que el gasto en tarjeta." });
  if (diasSinRegistro >= 8) a.push({ type: "orange", msg: `${diasSinRegistro} días sin actualizar datos.` });
  return a;
}

// Hook para detectar ancho de pantalla
function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return w;
}

export default function App() {
  const width = useWidth();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  const [data, setData] = useState(() => { const s = storage.get("finanzas_data"); return s ? { ...DEFAULTS, ...s } : DEFAULTS; });
  const [history, setHistory] = useState(() => storage.get("finanzas_history") || []);
  const [tab, setTab] = useState("resumen");
  const [editing, setEditing] = useState(false);
  const [editBuf, setEditBuf] = useState({});
  const [saved, setSaved] = useState(false);
  const [histTab, setHistTab] = useState("cuentaAhorro");

  const saveData = useCallback((nd) => { setData(nd); storage.set("finanzas_data", nd); }, []);
  const saveToHistory = useCallback((nd, hist) => {
    const entry = { date: today(), label: weekLabel(), ...nd };
    const nh = [...hist.filter(h => h.date !== today()), entry].slice(-24);
    setHistory(nh); storage.set("finanzas_history", nh);
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }, []);

  const startEdit = () => { setEditBuf({ ...data }); setEditing(true); };
  const cancelEdit = () => setEditing(false);
  const applyEdit = () => {
    const p = {};
    for (const k in editBuf) p[k] = parseFloat(editBuf[k]) || 0;
    saveData(p); saveToHistory(p, history); setEditing(false);
  };

  const totalCajaBruta = data.cuentaMonetaria + data.cuentaAhorro + data.planDorado;
  const tcUsoPct = data.tcLimite > 0 ? (data.tcGastado / data.tcLimite) * 100 : 0;
  const tcDisponible = data.tcLimite - data.tcGastado;
  const cajaNeta = totalCajaBruta - data.tcGastado;
  const equidadCasa = data.casaValor - data.deudaCasa;
  const patrimonioNeto = totalCajaBruta + data.carroValor + equidadCasa - data.tcGastado;
  const roiCasa = data.casaValor > 0 ? ((data.rentaIngreso * 12) / data.casaValor) * 100 : 0;
  const flujoNeto = data.rentaIngreso - data.abonoCasa;
  const totalIngresos = data.salario + data.rentaIngreso;
  const totalEgresos = data.ahorroMensual + data.aporteDorado + data.abonoCasa;
  const disponible = totalIngresos - totalEgresos;
  const mesesDeuda = data.abonoCasa > 0 ? Math.ceil(data.deudaCasa / data.abonoCasa) : 999;
  const deudaPagadaPct = data.deudaCasaOriginal > 0 ? ((data.deudaCasaOriginal - data.deudaCasa) / data.deudaCasaOriginal) * 100 : 0;

  const diasSinRegistro = useMemo(() => {
    if (!history.length) return 99;
    return Math.floor((new Date() - new Date(history[history.length - 1].date)) / 86400000);
  }, [history]);

  const alertas = getAlertas(data, cajaNeta, tcUsoPct, diasSinRegistro);

  const historialMensual = useMemo(() => {
    const map = {};
    history.forEach(h => { const mes = h.date?.slice(0, 7); if (!map[mes]) map[mes] = []; map[mes].push(h); });
    return Object.entries(map).map(([mes, entries]) => {
      const last = entries[entries.length - 1];
      return { mes, pat: last.cuentaMonetaria + last.cuentaAhorro + last.planDorado + last.carroValor + (last.casaValor - last.deudaCasa) - (last.tcGastado || 0) };
    });
  }, [history]);

  const tabs = [["resumen","Resumen"],["liquidez","Liquidez"],["activos","Activos"],["flujo","Flujo"],["historial","Historial"]];
  const tcColor = tcUsoPct > 70 ? C.red : tcUsoPct > 40 ? C.orange : C.green;

  // Grid helpers
  const col2 = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 };
  const col3 = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr", gap: 14 };
  const col4 = { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: isMobile ? 8 : 12 };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif", color: C.text }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow-x: hidden; }
        input[type=number]:focus { border-color: ${C.blueAcct} !important; outline: none; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* TOPBAR */}
      <div style={{ background: C.white, borderBottom: `2px solid ${C.blueAcct}`, padding: isMobile ? "12px 16px" : "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14 }}>
          <div style={{ width: isMobile ? 30 : 36, height: isMobile ? 30 : 36, borderRadius: 8, background: C.blueAcct, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 15 : 18, flexShrink: 0 }}>📊</div>
          <div>
            <div style={{ fontSize: isMobile ? 13 : 16, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>Panel de Finanzas</div>
            <div style={{ fontSize: isMobile ? 10 : 11, color: C.slateM }}>Control Semanal — {weekLabel()}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saved && !isMobile && <div style={{ fontSize: 11, color: C.green, background: C.greenLt, borderRadius: 6, padding: "5px 12px", border: `1px solid ${C.green}33`, fontWeight: 600 }}>✓ Guardado</div>}
          <button onClick={startEdit} style={{ background: C.blueAcct, border: "none", borderRadius: 8, padding: isMobile ? "8px 12px" : "9px 18px", color: "#fff", fontFamily: "inherit", fontWeight: 600, fontSize: isMobile ? 12 : 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            {isMobile ? "✏ Editar" : "✏ Actualizar datos"}
          </button>
        </div>
      </div>

      {/* MODAL */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: isMobile ? 0 : 20 }}>
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: isMobile ? "16px 16px 0 0" : 12, padding: "24px 20px", width: "100%", maxWidth: isMobile ? "100%" : 500, maxHeight: isMobile ? "90vh" : "88vh", overflowY: "auto", boxShadow: "0 -4px 30px rgba(0,0,0,0.15)" }}>
            <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 4 }}>Actualizar mis finanzas</div>
            <div style={{ fontSize: 12, color: C.slateM, marginBottom: 22 }}>Registro semanal — {weekLabel()}</div>
            {Object.entries(GROUPS).map(([group, keys]) => (
              <div key={group} style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.blueAcct, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 12, borderBottom: `2px solid ${C.blueLt}`, paddingBottom: 6 }}>{group}</div>
                {keys.map(k => (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: C.slate, display: "block", marginBottom: 4, fontWeight: 500 }}>{LABELS[k]}</label>
                    <input type="number" inputMode="decimal" value={editBuf[k] ?? ""} onChange={e => setEditBuf(p => ({ ...p, [k]: e.target.value }))}
                      style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px", color: C.text, fontSize: 15, fontFamily: "inherit", outline: "none" }} />
                  </div>
                ))}
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 8, paddingBottom: isMobile ? 16 : 0 }}>
              <button onClick={cancelEdit} style={{ flex: 1, padding: "12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.slateM, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, fontSize: 14 }}>Cancelar</button>
              <button onClick={applyEdit} style={{ flex: 2, padding: "12px", borderRadius: 8, border: "none", background: C.blueAcct, color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>💾 Guardar registro</button>
            </div>
          </div>
        </div>
      )}

      {/* KPI STRIP */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: isMobile ? "12px 16px" : "16px 28px" }}>
        <div style={col4}>
          <KpiStrip label="Patrimonio Neto" value={Qk(patrimonioNeto)} color={C.blueAcct} tag="⭐ Total" isMobile={isMobile} />
          <KpiStrip label="Caja Neta" value={Qk(cajaNeta)} sub={`Bruta: ${Qk(totalCajaBruta)}`} color={C.slate} tag="💵 Efectivo" isMobile={isMobile} />
          <KpiStrip label="Disponible / mes" value={isMobile ? Qk(disponible) : Q(disponible)} color={C.green} tag="📈 Libre" isMobile={isMobile} />
          <KpiStrip label="TC Disponible" value={isMobile ? Qk(tcDisponible) : Q(tcDisponible)} sub={`${tcUsoPct.toFixed(0)}% en uso`} color={tcColor} tag="💳 Crédito" isMobile={isMobile} />
        </div>
      </div>

      {/* ALERTAS */}
      {alertas.length > 0 && (
        <div style={{ padding: isMobile ? "10px 16px 0" : "10px 28px 0", display: "grid", gap: 6 }}>
          {alertas.map((a, i) => (
            <div key={i} style={{ background: a.type === "red" ? C.redLt : C.orangeLt, border: `1px solid ${a.type === "red" ? C.red : C.orange}44`, borderLeft: `4px solid ${a.type === "red" ? C.red : C.orange}`, borderRadius: 8, padding: "10px 14px", fontSize: isMobile ? 12 : 13, color: a.type === "red" ? C.red : C.orange, fontWeight: 500 }}>
              {a.type === "red" ? "⚠ " : "ℹ "}{a.msg}
            </div>
          ))}
        </div>
      )}

      {/* TABS */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: isMobile ? "0 16px" : "0 28px", overflowX: "auto", display: "flex" }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: isMobile ? "12px 14px" : "12px 20px", whiteSpace: "nowrap", border: "none", borderBottom: `3px solid ${tab === id ? C.blueAcct : "transparent"}`, background: "transparent", color: tab === id ? C.blueAcct : C.slateM, fontSize: isMobile ? 13 : 14, fontFamily: "inherit", fontWeight: tab === id ? 700 : 500, cursor: "pointer", transition: "all 0.15s" }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: isMobile ? "14px 16px 80px" : "20px 28px 40px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── RESUMEN ── */}
        {tab === "resumen" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={col2}>
              <Card title="Liquidez Actual" icon="💵" accent={C.blueAcct}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.slateM, marginBottom: 2 }}>Caja Neta</div>
                    <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: C.text }}>{Qk(cajaNeta)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: C.slateM, marginBottom: 2 }}>Caja Bruta</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.slateM }}>{Qk(totalCajaBruta)}</div>
                  </div>
                </div>
                <Row label="Cuenta Monetaria" value={Q(data.cuentaMonetaria)} />
                <Row label="Cuenta Ahorro" value={Q(data.cuentaAhorro)} />
                <Row label="Plan Dorado" value={Q(data.planDorado)} />
                <Div />
                <Row label="TC Gastado" value={Q(data.tcGastado)} color={C.red} />
                <Row label="Caja Neta" value={Q(cajaNeta)} color={C.blueAcct} bold />
              </Card>

              <Card title="Tarjeta de Crédito" icon="💳" accent={tcColor}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <CircleProgress pct={tcUsoPct} color={tcColor} size={isMobile ? 68 : 76} label="uso" />
                  <div style={{ flex: 1 }}>
                    <Row label="Límite" value={Q(data.tcLimite)} />
                    <Row label="Gastado" value={Q(data.tcGastado)} color={tcUsoPct > 70 ? C.red : C.orange} />
                    <Row label="Disponible" value={Q(tcDisponible)} color={C.green} bold />
                  </div>
                </div>
                <PBar value={data.tcGastado} total={data.tcLimite} color={tcColor} label={`${tcUsoPct.toFixed(1)}% utilizado`} />
              </Card>
            </div>

            <div style={col2}>
              <Card title="Progreso Deuda Casa" icon="🏠" accent={C.green}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <CircleProgress pct={deudaPagadaPct} color={C.green} size={isMobile ? 68 : 76} label="pagado" />
                  <div style={{ flex: 1 }}>
                    <Row label="Pagado" value={Q(data.deudaCasaOriginal - data.deudaCasa)} color={C.green} />
                    <Row label="Restante" value={Q(data.deudaCasa)} color={C.red} />
                    <Row label="Meses restantes" value={`~${mesesDeuda}`} />
                  </div>
                </div>
                <PBar value={data.deudaCasaOriginal - data.deudaCasa} total={data.deudaCasaOriginal} color={C.green} label={`${deudaPagadaPct.toFixed(1)}% pagado`} />
              </Card>

              <Card title="Indicadores Clave" icon="📐" accent={C.slate}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <MiniKpi label="ROI Casa (anual)" value={`${roiCasa.toFixed(2)}%`} color={C.green} />
                  <MiniKpi label="Flujo Neto Renta" value={Q(flujoNeto)} color={flujoNeto >= 0 ? C.green : C.red} />
                  <MiniKpi label="Tasa PD (bruta)" value={`${data.planDoradoTasa}%`} color={C.orange} />
                  <MiniKpi label="Tasa PD (real)" value={`${data.planDoradoTasaReal}%`} color={C.blueAcct} />
                </div>
              </Card>
            </div>

            <Card title="Distribución de Caja" icon="📊" accent={C.blueAcct}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: isMobile ? 8 : 12, marginBottom: 14 }}>
                <MiniKpi label="Monetaria" value={isMobile ? Qk(data.cuentaMonetaria) : Q(data.cuentaMonetaria)} color={C.blueAcct} pct={`${((data.cuentaMonetaria/totalCajaBruta)*100).toFixed(0)}%`} />
                <MiniKpi label="Ahorro" value={isMobile ? Qk(data.cuentaAhorro) : Q(data.cuentaAhorro)} color={C.green} pct={`${((data.cuentaAhorro/totalCajaBruta)*100).toFixed(0)}%`} />
                <MiniKpi label="Plan Dorado" value={isMobile ? Qk(data.planDorado) : Q(data.planDorado)} color={C.orange} pct={`${((data.planDorado/totalCajaBruta)*100).toFixed(0)}%`} />
              </div>
              <div style={{ height: 12, borderRadius: 6, overflow: "hidden", display: "flex", gap: 2 }}>
                {[[data.cuentaMonetaria, C.blueAcct],[data.cuentaAhorro, C.green],[data.planDorado, C.orange]].map(([v,col],i) => (
                  <div key={i} style={{ flex: v, background: col, opacity: 0.85, borderRadius: i===0?"6px 0 0 6px":i===2?"0 6px 6px 0":"0" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: isMobile ? 12 : 20, marginTop: 10, flexWrap: "wrap" }}>
                {[["Monetaria", C.blueAcct],["Ahorro", C.green],["Plan Dorado", C.orange]].map(([l,c]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: c, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: C.slateM }}>{l}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── LIQUIDEZ ── */}
        {tab === "liquidez" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={col3}>
              <Card title="Cuenta Monetaria" icon="💵" accent={C.blueAcct}>
                <NumBig value={Q(data.cuentaMonetaria)} color={C.blueAcct} label="Liquidez inmediata" />
              </Card>
              <Card title="Cuenta de Ahorro" icon="🏦" accent={C.green}>
                <NumBig value={Q(data.cuentaAhorro)} color={C.green} label="Saldo acumulado" />
                <Div />
                <Row label="Depósito este mes" value={Q(data.ahorroMensual)} color={C.green} />
              </Card>
              <Card title="Plan Dorado" icon="⭐" accent={C.orange}>
                <NumBig value={Q(data.planDorado)} color={C.orange} label="Capital invertido" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                  <div style={{ background: C.orangeLt, border: `1px solid ${C.orange}33`, borderRadius: 8, padding: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: C.orange, fontWeight: 600, marginBottom: 2 }}>Antes imp.</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.orange }}>{data.planDoradoTasa}%</div>
                  </div>
                  <div style={{ background: C.blueLt, border: `1px solid ${C.blueAcct}33`, borderRadius: 8, padding: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: C.blueAcct, fontWeight: 600, marginBottom: 2 }}>Tasa real</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.blueAcct }}>{data.planDoradoTasaReal}%</div>
                  </div>
                </div>
                <Div />
                <Row label="Aporte neto/mes" value={Q(data.aporteDorado - data.seguroVida)} color={C.green} />
                <Row label="Seguro de vida" value={Q(data.seguroVida)} color={C.red} />
              </Card>
            </div>
            <Card title="Tarjeta de Crédito" icon="💳" accent={tcColor}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "auto 1fr", gap: 20, alignItems: "center" }}>
                {!isMobile && <CircleProgress pct={tcUsoPct} color={tcColor} size={90} label="uso TC" />}
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: isMobile ? 8 : 10, marginBottom: 14 }}>
                    <MiniKpi label="Límite" value={isMobile ? Qk(data.tcLimite) : Q(data.tcLimite)} color={C.slate} />
                    <MiniKpi label="Gastado" value={isMobile ? Qk(data.tcGastado) : Q(data.tcGastado)} color={tcUsoPct > 70 ? C.red : C.orange} />
                    <MiniKpi label="Disponible" value={isMobile ? Qk(tcDisponible) : Q(tcDisponible)} color={C.green} />
                  </div>
                  <PBar value={data.tcGastado} total={data.tcLimite} color={tcColor} label={`${tcUsoPct.toFixed(1)}% utilizado`} />
                </div>
              </div>
              <Div />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <Row label="Caja bruta" value={Qk(totalCajaBruta)} />
                <Row label="TC Gastado" value={Q(data.tcGastado)} color={C.red} />
                <Row label="Caja neta" value={Qk(cajaNeta)} color={C.blueAcct} bold />
              </div>
            </Card>
          </div>
        )}

        {/* ── ACTIVOS ── */}
        {tab === "activos" && (
          <div style={{ display: "grid", gap: 14 }}>
            <Card title="Vehículo" icon="🚗" accent={C.green}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <NumBig value={Q(data.carroValor)} color={C.slate} />
                <div style={{ background: C.greenLt, border: `1px solid ${C.green}44`, borderRadius: 20, padding: "6px 18px", fontSize: 12, color: C.green, fontWeight: 700 }}>✓ Deuda pagada</div>
              </div>
            </Card>
            <Card title="Casa / Bien Raíz" icon="🏠" accent={C.blueAcct}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 14 }}>
                <div>
                  <NumBig value={Q(data.casaValor)} color={C.slate} label="Valor total" />
                  <div style={{ background: C.greenLt, border: `1px solid ${C.green}33`, borderRadius: 10, padding: "14px", marginTop: 14 }}>
                    <div style={{ fontSize: 11, color: C.slateM, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>ROI Anual</div>
                    <div style={{ fontSize: isMobile ? 30 : 36, fontWeight: 800, color: C.green, lineHeight: 1.1 }}>{roiCasa.toFixed(2)}%</div>
                    <div style={{ fontSize: 11, color: C.slateM, marginTop: 4 }}>Q{(data.rentaIngreso * 12).toLocaleString()} / año ÷ Q{data.casaValor.toLocaleString()}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.slateM, fontWeight: 600, marginBottom: 10 }}>Progreso de pago</div>
                  <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "center", marginBottom: 14 }}>
                    <CircleProgress pct={deudaPagadaPct} color={C.blueAcct} size={isMobile ? 80 : 90} label="pagado" />
                  </div>
                  <Row label="Pagado" value={Q(data.deudaCasaOriginal - data.deudaCasa)} color={C.green} />
                  <Row label="Restante" value={Q(data.deudaCasa)} color={C.red} />
                  <Row label="Meses restantes" value={`~${mesesDeuda}`} />
                </div>
              </div>
              <Div />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 0 : 10 }}>
                <Row label="Equidad acumulada" value={Q(equidadCasa)} color={C.green} bold />
                <Row label="Renta mensual" value={Q(data.rentaIngreso)} color={C.green} />
                <Row label="Abono mensual" value={Q(data.abonoCasa)} color={C.red} />
                <Row label="Flujo neto renta" value={Q(flujoNeto)} color={flujoNeto >= 0 ? C.green : C.red} />
              </div>
              <div style={{ marginTop: 12 }}>
                <PBar value={data.deudaCasaOriginal - data.deudaCasa} total={data.deudaCasaOriginal} color={C.blueAcct} label={`${deudaPagadaPct.toFixed(1)}% pagado — Q${data.abonoCasa.toLocaleString()}/mes`} />
              </div>
            </Card>
          </div>
        )}

        {/* ── FLUJO ── */}
        {tab === "flujo" && (
          <div style={col2}>
            <Card title="Ingresos Mensuales" icon="📥" accent={C.green}>
              <NumBig value={Q(totalIngresos)} color={C.green} label="Total ingresos / mes" />
              <Div />
              <BarLabeled label="Salario" value={data.salario} total={totalIngresos} color={C.green} />
              <BarLabeled label="Renta casa" value={data.rentaIngreso} total={totalIngresos} color={C.blueAcct} />
            </Card>
            <Card title="Egresos Mensuales" icon="📤" accent={C.red}>
              <NumBig value={Q(totalEgresos)} color={C.red} label="Total comprometido / mes" />
              <Div />
              <BarLabeled label="Ahorro" value={data.ahorroMensual} total={totalIngresos} color={C.green} />
              <BarLabeled label="Plan Dorado (neto)" value={data.aporteDorado - data.seguroVida} total={totalIngresos} color={C.orange} />
              <BarLabeled label="Seguro de vida" value={data.seguroVida} total={totalIngresos} color={C.red} />
              <BarLabeled label="Abono casa" value={data.abonoCasa} total={totalIngresos} color={C.blueAcct} />
              <Div />
              <Row label="Disponible libre" value={Q(disponible)} color={C.green} bold />
              <Row label="Tasa de ahorro" value={`${(((data.ahorroMensual + data.aporteDorado) / data.salario) * 100).toFixed(1)}%`} color={C.blueAcct} bold />
            </Card>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab === "historial" && (
          <div>
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: C.slateM }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>📋</div>
                <div style={{ fontWeight: 700, color: C.slate, marginBottom: 8, fontSize: 15 }}>Sin registros aún.</div>
                <div style={{ fontSize: 13 }}>Presiona <strong style={{ color: C.blueAcct }}>Actualizar datos</strong> para guardar el primer registro.</div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[["cuentaAhorro","Ahorro"],["cuentaMonetaria","Monetaria"],["planDorado","Plan Dorado"],["deudaCasa","Deuda Casa"],["tcGastado","TC Gastado"],["patrimonioCalc","Patrimonio"]].map(([k, label]) => (
                    <button key={k} onClick={() => setHistTab(k)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: isMobile ? 11 : 12, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${histTab === k ? C.blueAcct : C.border}`, background: histTab === k ? C.blueLt : C.white, color: histTab === k ? C.blueAcct : C.slateM, fontWeight: histTab === k ? 700 : 400 }}>{label}</button>
                  ))}
                </div>

                <Card title={`Evolución — ${histTab === "patrimonioCalc" ? "Patrimonio Neto" : LABELS[histTab] || histTab}`} icon="📈" accent={C.blueAcct}>
                  <MiniChart data={history.map(h => ({ label: h.label, value: histTab === "patrimonioCalc" ? (h.cuentaMonetaria + h.cuentaAhorro + h.planDorado + h.carroValor + (h.casaValor - h.deudaCasa) - (h.tcGastado || 0)) : (h[histTab] || 0) }))} color={C.blueAcct} />
                </Card>

                {historialMensual.length > 1 && (
                  <Card title="Evolución Mensual — Patrimonio" icon="📅" accent={C.green}>
                    <MiniChart data={historialMensual.map(m => ({ label: m.mes?.slice(5), value: m.pat }))} color={C.green} />
                  </Card>
                )}

                <Card title="Registros Semanales" icon="📋" accent={C.slate}>
                  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 11 : 13, minWidth: 500 }}>
                      <thead>
                        <tr style={{ background: C.bg }}>
                          {["Semana","Ahorro","Plan Dorado","TC Gastado","Deuda Casa","Patrimonio"].map(h => (
                            <th key={h} style={{ textAlign: "right", padding: isMobile ? "8px 8px" : "10px 12px", fontWeight: 600, color: C.slate, whiteSpace: "nowrap", fontSize: isMobile ? 11 : 12, borderBottom: `2px solid ${C.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...history].reverse().map((h, i) => {
                          const pat = h.cuentaMonetaria + h.cuentaAhorro + h.planDorado + h.carroValor + (h.casaValor - h.deudaCasa) - (h.tcGastado || 0);
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : C.bg }}>
                              <td style={{ padding: isMobile ? "8px 8px" : "10px 12px", color: C.slate, whiteSpace: "nowrap", fontWeight: 600 }}>{h.label}</td>
                              <td style={{ textAlign: "right", padding: isMobile ? "8px 8px" : "10px 12px", color: C.green, whiteSpace: "nowrap" }}>{Q(h.cuentaAhorro)}</td>
                              <td style={{ textAlign: "right", padding: isMobile ? "8px 8px" : "10px 12px", color: C.orange, whiteSpace: "nowrap" }}>{Q(h.planDorado)}</td>
                              <td style={{ textAlign: "right", padding: isMobile ? "8px 8px" : "10px 12px", color: C.red, whiteSpace: "nowrap" }}>{Q(h.tcGastado || 0)}</td>
                              <td style={{ textAlign: "right", padding: isMobile ? "8px 8px" : "10px 12px", color: C.red, whiteSpace: "nowrap" }}>{Q(h.deudaCasa)}</td>
                              <td style={{ textAlign: "right", padding: isMobile ? "8px 8px" : "10px 12px", color: C.blueAcct, whiteSpace: "nowrap", fontWeight: 700 }}>{Q(pat)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM NAV MÓVIL */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.white, borderTop: `1px solid ${C.border}`, display: "flex", boxShadow: "0 -2px 10px rgba(0,0,0,0.08)", zIndex: 40 }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 4px 8px", border: "none", background: "transparent", color: tab === id ? C.blueAcct : C.slateL, fontSize: 10, fontFamily: "inherit", fontWeight: tab === id ? 700 : 400, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, borderTop: `2px solid ${tab === id ? C.blueAcct : "transparent"}` }}>
              <span style={{ fontSize: 16 }}>{id === "resumen" ? "📊" : id === "liquidez" ? "💵" : id === "activos" ? "🏠" : id === "flujo" ? "📤" : "🕐"}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componentes ───────────────────────────────────────────────────────
function KpiStrip({ label, value, sub, color, tag, isMobile }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: isMobile ? "10px 12px" : "14px 16px", borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: isMobile ? 9 : 10, color: C.slateL, fontWeight: 500, marginBottom: isMobile ? 4 : 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{tag}</div>
      <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color, marginBottom: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: isMobile ? 10 : 11, color: C.slateM }}>{sub}</div>}
      <div style={{ fontSize: isMobile ? 10 : 11, color: C.slateM, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Card({ title, icon, accent = C.blueAcct, children }) {
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.slate }}>{title}</span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 3, height: 16, borderRadius: 2, background: accent }} />
      </div>
      {children}
    </div>
  );
}

function NumBig({ value, color, label }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || C.text, letterSpacing: "-0.5px" }}>{value}</div>
      {label && <div style={{ fontSize: 11, color: C.slateM, marginTop: 2 }}>{label}</div>}
    </div>
  );
}

function MiniKpi({ label, value, color, pct }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 10px" }}>
      <div style={{ fontSize: 10, color: C.slateL, marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
      {pct && <div style={{ fontSize: 10, color: C.slateM, marginTop: 2 }}>{pct} del total</div>}
    </div>
  );
}

function Row({ label, value, color, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: C.slateM }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color || C.text }}>{value}</span>
    </div>
  );
}

function Div() { return <div style={{ height: 1, background: C.border, margin: "10px 0" }} />; }

function PBar({ value, total, color, label }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      {label && <div style={{ fontSize: 11, color: C.slateM, marginBottom: 5 }}>{label}</div>}
      <div style={{ height: 8, background: C.bg, borderRadius: 4, border: `1px solid ${C.border}` }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function BarLabeled({ label, value, total, color }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: C.slateM }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{Q(value)}</span>
      </div>
      <div style={{ height: 6, background: C.bg, borderRadius: 3, border: `1px solid ${C.border}` }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function CircleProgress({ pct, color, size = 80, label = "%" }) {
  const r = 30, cx = 40, cy = 40, circ = 2 * Math.PI * r;
  const fill = Math.min(100, Math.max(0, pct));
  const dash = (fill / 100) * circ;
  return (
    <div style={{ display: "inline-block", textAlign: "center", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg} strokeWidth="8" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth="8" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ / 4}
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
        <text x={cx} y={cy - 3} textAnchor="middle" fill={color} fontSize="13" fontWeight="800" fontFamily="Inter,sans-serif">{fill.toFixed(0)}%</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fill={C.slateL} fontSize="7" fontFamily="Inter,sans-serif">{label}</text>
      </svg>
    </div>
  );
}

function MiniChart({ data, color = C.blueAcct }) {
  if (!data.length) return null;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1, H = 80;
  const pts = data.map((d, i) => { const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100; const y = H - ((d.value - min) / range) * (H - 14) - 7; return `${x},${y}`; }).join(" ");
  const firstX = data.length === 1 ? 50 : 0, lastX = data.length === 1 ? 50 : 100;
  const area = `M ${firstX} ${H} ${data.map((d,i) => { const x=data.length===1?50:(i/(data.length-1))*100; const y=H-((d.value-min)/range)*(H-14)-7; return `L ${x} ${y}`; }).join(" ")} L ${lastX} ${H} Z`;
  const gid = `g${color.replace(/[^a-z0-9]/gi,'')}`;
  return (
    <div>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 100, display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => { const x=data.length===1?50:(i/(data.length-1))*100; const y=H-((d.value-min)/range)*(H-14)-7; return <circle key={i} cx={x} cy={y} r="2.5" fill={C.white} stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />; })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {data.map((d, i) => <div key={i} style={{ fontSize: 9, color: C.slateL, textAlign: "center", flex: 1 }}>{d.label}</div>)}
      </div>
      <Div />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: C.slateM }}>Mín: <span style={{ color: C.red, fontWeight: 600 }}>{Q(Math.min(...vals))}</span></span>
        <span style={{ fontSize: 11, color: C.slateM }}>Máx: <span style={{ color: C.green, fontWeight: 600 }}>{Q(Math.max(...vals))}</span></span>
        <span style={{ fontSize: 11, color: C.slateM }}>Último: <span style={{ color, fontWeight: 600 }}>{Q(vals[vals.length - 1])}</span></span>
      </div>
    </div>
  );
}