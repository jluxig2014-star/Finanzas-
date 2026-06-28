import { useState, useCallback, useMemo, useEffect } from "react";

const Q  = (n) => `Q${Number(n).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qk = (n) => n >= 1000 ? `Q${(n/1000).toFixed(1)}k` : Q(n);
const USD= (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().split("T")[0];
const weekLabel = () => new Date().toLocaleDateString("es-GT", { day:"2-digit", month:"short", year:"2-digit" });

const C = {
  bg:"#f4f6f8", white:"#ffffff", border:"#e0e6ed",
  blueLt:"#e8f1fb", blueAcct:"#2563eb",
  green:"#16a34a", greenLt:"#dcfce7",
  red:"#dc2626",   redLt:"#fee2e2",
  orange:"#d97706",orangeLt:"#fef3c7",
  slate:"#334155",  slateM:"#64748b", slateL:"#94a3b8", text:"#1e293b",
};

const DEFAULTS = {
  cuentaMonetaria:734.35, cuentaAhorro:7043.43,
  planDorado:2999.97, planDoradoTasa:2.88, planDoradoTasaReal:2.59,
  // Carro
  carroValorCompra:56000, carroValorActual:56000,
  // Casa
  casaValorCompra:200000, casaValorActual:200000,
  deudaCasa:82050, deudaCasaOriginal:82050,
  // Ingresos/egresos
  salario:9200, rentaIngreso:1300, abonoCasa:1000,
  ahorroMensual:1000, aporteDorado:150, seguroVida:12,
  // TC
  tcLimite:19200, tcGastado:0,
  // Cripto
  tipoCambio:7.72,
  ethInvertidoUSD:130, ethValorActualUSD:130,
  solInvertidoUSD:0,   solValorActualUSD:0,
};

const LABELS = {
  cuentaMonetaria:"Cuenta Monetaria", cuentaAhorro:"Cuenta de Ahorro",
  planDorado:"Plan Dorado (capital actual)",
  planDoradoTasa:"Tasa Plan Dorado — antes de impuestos (%)",
  planDoradoTasaReal:"Tasa Plan Dorado — después de impuestos (%)",
  carroValorCompra:"Carro — Precio de compra (Q)",
  carroValorActual:"Carro — Valor actual (Q)",
  casaValorCompra:"Casa — Precio de compra (Q)",
  casaValorActual:"Casa — Valor actual de mercado (Q)",
  deudaCasa:"Deuda Restante Casa", deudaCasaOriginal:"Deuda Original Casa",
  salario:"Salario Mensual", rentaIngreso:"Ingreso por Renta",
  abonoCasa:"Abono mensual casa", ahorroMensual:"Ahorro depositado este mes",
  aporteDorado:"Aporte mensual Plan Dorado", seguroVida:"Descuento seguro de vida",
  tcLimite:"Tarjeta de Crédito — Límite", tcGastado:"Tarjeta de Crédito — Gastado este mes",
  tipoCambio:"Tipo de cambio USD → GTQ",
  ethInvertidoUSD:"Ethereum — Capital invertido (USD)", ethValorActualUSD:"Ethereum — Valor actual (USD)",
  solInvertidoUSD:"Solana — Capital invertido (USD)",  solValorActualUSD:"Solana — Valor actual (USD)",
};

const GROUPS = {
  "Caja":["cuentaMonetaria","cuentaAhorro","planDorado","planDoradoTasa","planDoradoTasaReal"],
  "Tarjeta de Crédito":["tcLimite","tcGastado"],
  "Activos — Carro":["carroValorCompra","carroValorActual"],
  "Activos — Casa":["casaValorCompra","casaValorActual","deudaCasa","deudaCasaOriginal"],
  "Ingresos":["salario","rentaIngreso"],
  "Egresos fijos":["abonoCasa","ahorroMensual","aporteDorado","seguroVida"],
  "💰 Cripto":["tipoCambio","ethInvertidoUSD","ethValorActualUSD","solInvertidoUSD","solValorActualUSD"],
};

const storage = {
  get:(k)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch{ return null; } },
  set:(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} },
};

function getAlertas(data, cajaNeta, tcUsoPct, diasSinRegistro) {
  const a=[];
  if(tcUsoPct>=70) a.push({type:"red", msg:`Tarjeta al ${tcUsoPct.toFixed(0)}% de uso — considera pausar gastos.`});
  else if(tcUsoPct>=50) a.push({type:"orange", msg:`Tarjeta al ${tcUsoPct.toFixed(0)}% del límite.`});
  if(cajaNeta<data.tcGastado) a.push({type:"red", msg:"Caja neta es menor que el gasto en tarjeta."});
  if(diasSinRegistro>=8) a.push({type:"orange", msg:`${diasSinRegistro} días sin actualizar datos.`});
  return a;
}

function useWidth() {
  const [w,setW]=useState(window.innerWidth);
  useEffect(()=>{ const fn=()=>setW(window.innerWidth); window.addEventListener("resize",fn); return ()=>window.removeEventListener("resize",fn); },[]);
  return w;
}

export default function App() {
  const width=useWidth();
  const isMobile=width<640;
  const isTablet=width>=640&&width<1024;

  const [data,setData]=useState(()=>{ const s=storage.get("finanzas_data"); return s?{...DEFAULTS,...s}:DEFAULTS; });
  const [history,setHistory]=useState(()=>storage.get("finanzas_history")||[]);
  const [tab,setTab]=useState("resumen");
  const [editing,setEditing]=useState(false);
  const [editBuf,setEditBuf]=useState({});
  const [saved,setSaved]=useState(false);
  const [histTab,setHistTab]=useState("cuentaAhorro");

  const saveData=useCallback((nd)=>{ setData(nd); storage.set("finanzas_data",nd); },[]);
  const saveToHistory=useCallback((nd,hist)=>{
    const entry={date:today(),label:weekLabel(),...nd};
    const nh=[...hist.filter(h=>h.date!==today()),entry].slice(-24);
    setHistory(nh); storage.set("finanzas_history",nh);
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  },[]);

  const startEdit=()=>{ setEditBuf({...data}); setEditing(true); };
  const cancelEdit=()=>setEditing(false);
  const applyEdit=()=>{
    const p={};
    for(const k in editBuf) p[k]=parseFloat(editBuf[k])||0;
    saveData(p); saveToHistory(p,history); setEditing(false);
  };

  // ── Cálculos ──────────────────────────────────────────────────────
  const totalCajaBruta = data.cuentaMonetaria+data.cuentaAhorro+data.planDorado;
  const tcUsoPct       = data.tcLimite>0?(data.tcGastado/data.tcLimite)*100:0;
  const tcDisponible   = data.tcLimite-data.tcGastado;
  const cajaNeta       = totalCajaBruta-data.tcGastado;

  // Carro
  const carroDepreciacion    = data.carroValorCompra-data.carroValorActual;
  const carroDepreciacionPct = data.carroValorCompra>0?(carroDepreciacion/data.carroValorCompra)*100:0;

  // Casa
  const casaPlusvalia    = data.casaValorActual-data.casaValorCompra;
  const casaPlusvalidPct = data.casaValorCompra>0?(casaPlusvalia/data.casaValorCompra)*100:0;
  const equidadCasa      = data.casaValorActual-data.deudaCasa;
  const roiCasa          = data.casaValorActual>0?((data.rentaIngreso*12)/data.casaValorActual)*100:0;
  const flujoNeto        = data.rentaIngreso-data.abonoCasa;
  const deudaPagadaPct   = data.deudaCasaOriginal>0?((data.deudaCasaOriginal-data.deudaCasa)/data.deudaCasaOriginal)*100:0;
  const mesesDeuda       = data.abonoCasa>0?Math.ceil(data.deudaCasa/data.abonoCasa):999;

  // Cripto ETH
  const ethGananciaUSD  = data.ethValorActualUSD-data.ethInvertidoUSD;
  const ethGananciaPct  = data.ethInvertidoUSD>0?(ethGananciaUSD/data.ethInvertidoUSD)*100:0;
  const ethValorGTQ     = data.ethValorActualUSD*data.tipoCambio;
  const ethInvertidoGTQ = data.ethInvertidoUSD*data.tipoCambio;
  const ethGananciaGTQ  = ethGananciaUSD*data.tipoCambio;

  // Cripto SOL
  const solGananciaUSD  = data.solValorActualUSD-data.solInvertidoUSD;
  const solGananciaPct  = data.solInvertidoUSD>0?(solGananciaUSD/data.solInvertidoUSD)*100:0;
  const solValorGTQ     = data.solValorActualUSD*data.tipoCambio;
  const solInvertidoGTQ = data.solInvertidoUSD*data.tipoCambio;
  const solGananciaGTQ  = solGananciaUSD*data.tipoCambio;
  const totalCriptoGTQ  = ethValorGTQ+solValorGTQ;

  // Flujo
  const totalIngresos = data.salario+data.rentaIngreso;
  const totalEgresos  = data.ahorroMensual+data.aporteDorado+data.abonoCasa;
  const disponible    = totalIngresos-totalEgresos;

  // Patrimonio
  const patrimonioNeto = totalCajaBruta+data.carroValorActual+equidadCasa-data.tcGastado+totalCriptoGTQ;

  const diasSinRegistro=useMemo(()=>{
    if(!history.length) return 99;
    return Math.floor((new Date()-new Date(history[history.length-1].date))/86400000);
  },[history]);

  const alertas=getAlertas(data,cajaNeta,tcUsoPct,diasSinRegistro);

  const historialMensual=useMemo(()=>{
    const map={};
    history.forEach(h=>{ const mes=h.date?.slice(0,7); if(!map[mes]) map[mes]=[]; map[mes].push(h); });
    return Object.entries(map).map(([mes,entries])=>{
      const last=entries[entries.length-1];
      return { mes, pat: last.cuentaMonetaria+last.cuentaAhorro+last.planDorado+(last.carroValorActual||last.carroValor||0)+(last.casaValorActual||last.casaValor||0)-last.deudaCasa-(last.tcGastado||0)+((last.ethValorActualUSD||0)+(last.solValorActualUSD||0))*(last.tipoCambio||7.72) };
    });
  },[history]);

  const tabs=[["resumen","Resumen"],["patrimonio","Patrimonio"],["liquidez","Liquidez"],["activos","Activos"],["cripto","Cripto"],["flujo","Flujo"],["historial","Historial"]];
  const tcColor=tcUsoPct>70?C.red:tcUsoPct>40?C.orange:C.green;
  const col2={display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14};
  const col3={display:"grid",gridTemplateColumns:isMobile?"1fr":isTablet?"1fr 1fr":"1fr 1fr 1fr",gap:14};

  // ── ETH diamond SVG ──────────────────────────────────────────────
  const EthIcon=({size=50})=>(
    <svg width={size} height={size*1.17} viewBox="0 0 60 70">
      <defs>
        <linearGradient id="ethG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#63b3ed"/><stop offset="50%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#3b82f6"/>
        </linearGradient>
        <filter id="eg"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <polygon points="30,2 58,28 30,38 2,28" fill="url(#ethG)" filter="url(#eg)" opacity="0.95"/>
      <polygon points="30,38 58,28 30,68" fill="#3b82f6" filter="url(#eg)" opacity="0.8"/>
      <polygon points="30,38 2,28 30,68" fill="#1e40af" filter="url(#eg)" opacity="0.9"/>
      <polygon points="30,2 30,38 2,28" fill="#60a5fa" opacity="0.6"/>
    </svg>
  );

  // ── SOL logo SVG ─────────────────────────────────────────────────
  const SolIcon=({size=50})=>(
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <linearGradient id="solG" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#9945ff"/><stop offset="100%" stopColor="#14f195"/>
        </linearGradient>
        <filter id="sg"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect x="10" y="20" width="75" height="12" rx="4" fill="url(#solG)" filter="url(#sg)"/>
      <rect x="10" y="44" width="75" height="12" rx="4" fill="url(#solG)" filter="url(#sg)"/>
      <rect x="10" y="68" width="75" height="12" rx="4" fill="url(#solG)" filter="url(#sg)"/>
      <polygon points="10,20 22,20 10,32" fill="url(#solG)" opacity="0.7"/>
      <polygon points="85,56 73,56 85,44" fill="url(#solG)" opacity="0.7"/>
      <polygon points="10,68 22,68 10,80" fill="url(#solG)" opacity="0.7"/>
    </svg>
  );

  // ── Cripto card para Resumen ─────────────────────────────────────
  const CriptoResumenCard=({coin, icon, ganPct, ganUSD, ganGTQ, valorUSD, invertidoUSD, valorGTQ, invertidoGTQ, bgFrom, bgTo, ringColor, barColor})=>(
    <div style={{background:`linear-gradient(135deg,${bgFrom} 0%,${bgTo} 100%)`,border:`1px solid ${ringColor}44`,borderRadius:12,padding:"18px",position:"relative",overflow:"hidden",boxShadow:`0 4px 20px ${ringColor}22`,flex:1}}>
      {/* Rings */}
      {[120,80,44].map((s,i)=>(
        <div key={i} style={{position:"absolute",top:"50%",left:isMobile?60:70,transform:"translate(-50%,-50%)",width:s,height:s,borderRadius:"50%",border:`1px solid ${ringColor}${i===2?"44":"22"}`,pointerEvents:"none"}}/>
      ))}
      {/* Icon */}
      <div style={{position:"absolute",top:"50%",left:isMobile?60:70,transform:"translate(-50%,-50%)",pointerEvents:"none"}}>
        {icon}
      </div>
      {/* Content */}
      <div style={{marginLeft:isMobile?108:124}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <span style={{fontSize:11,fontWeight:700,color:`${ringColor}cc`,letterSpacing:"2px",textTransform:"uppercase"}}>{coin}</span>
          <div style={{flex:1,height:1,background:`${ringColor}22`}}/>
          <span style={{fontSize:9,color:`${ringColor}66`,letterSpacing:"1px"}}>CRIPTO</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          <div>
            <div style={{fontSize:9,color:"rgba(150,200,255,0.5)",marginBottom:2}}>Valor actual</div>
            <div style={{fontSize:isMobile?14:17,fontWeight:800,color:ringColor}}>{USD(valorUSD)}</div>
            <div style={{fontSize:10,color:"rgba(150,200,255,0.55)",marginTop:1}}>{Q(valorGTQ)}</div>
          </div>
          <div>
            <div style={{fontSize:9,color:"rgba(150,200,255,0.5)",marginBottom:2}}>Invertido</div>
            <div style={{fontSize:isMobile?13:15,fontWeight:700,color:"rgba(180,220,255,0.8)"}}>{USD(invertidoUSD)}</div>
            <div style={{fontSize:10,color:"rgba(150,200,255,0.45)",marginTop:1}}>{Q(invertidoGTQ)}</div>
          </div>
          <div>
            <div style={{fontSize:9,color:"rgba(150,200,255,0.5)",marginBottom:2}}>{ganPct>=0?"Ganancia":"Pérdida"}</div>
            <div style={{fontSize:isMobile?14:16,fontWeight:800,color:ganPct>=0?"#4ade80":"#f87171"}}>{ganPct>=0?"+":""}{ganPct.toFixed(1)}%</div>
            <div style={{fontSize:10,color:ganPct>=0?"#4ade80":"#f87171",marginTop:1}}>{ganPct>=0?"+":""}{USD(ganUSD)}</div>
          </div>
        </div>
        <div style={{marginTop:10,height:3,background:"rgba(99,179,237,0.1)",borderRadius:2}}>
          <div style={{width:`${Math.min(100,Math.max(4,(valorUSD/(invertidoUSD*1.5||1))*100))}%`,height:"100%",background:barColor,borderRadius:2,boxShadow:`0 0 5px ${barColor}88`,transition:"width 0.5s"}}/>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter','Segoe UI',sans-serif",color:C.text}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}body{overflow-x:hidden;}::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:${C.bg};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>

      {/* TOPBAR */}
      <div style={{background:C.white,borderBottom:`2px solid ${C.blueAcct}`,padding:isMobile?"12px 16px":"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:isMobile?10:14}}>
          <div style={{width:isMobile?30:36,height:isMobile?30:36,borderRadius:8,background:C.blueAcct,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?15:18,flexShrink:0}}>📊</div>
          <div>
            <div style={{fontSize:isMobile?13:16,fontWeight:800,color:C.text,lineHeight:1.2}}>Panel de Finanzas</div>
            <div style={{fontSize:isMobile?10:11,color:C.slateM}}>Control Semanal — {weekLabel()}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {saved&&!isMobile&&<div style={{fontSize:11,color:C.green,background:C.greenLt,borderRadius:6,padding:"5px 12px",fontWeight:600}}>✓ Guardado</div>}
          <button onClick={startEdit} style={{background:C.blueAcct,border:"none",borderRadius:8,padding:isMobile?"8px 12px":"9px 18px",color:"#fff",fontFamily:"inherit",fontWeight:600,fontSize:isMobile?12:13,cursor:"pointer",whiteSpace:"nowrap"}}>
            {isMobile?"✏ Editar":"✏ Actualizar datos"}
          </button>
        </div>
      </div>

      {/* MODAL */}
      {editing&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:isMobile?0:20}}>
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:isMobile?"16px 16px 0 0":12,padding:"24px 20px",width:"100%",maxWidth:isMobile?"100%":500,maxHeight:isMobile?"90vh":"88vh",overflowY:"auto",boxShadow:"0 -4px 30px rgba(0,0,0,0.15)"}}>
            <div style={{width:36,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}}/>
            <div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:4}}>Actualizar mis finanzas</div>
            <div style={{fontSize:12,color:C.slateM,marginBottom:22}}>Registro semanal — {weekLabel()}</div>
            {Object.entries(GROUPS).map(([group,keys])=>(
              <div key={group} style={{marginBottom:22}}>
                <div style={{fontSize:11,fontWeight:700,color:C.blueAcct,letterSpacing:"0.5px",textTransform:"uppercase",marginBottom:12,borderBottom:`2px solid ${C.blueLt}`,paddingBottom:6}}>{group}</div>
                {keys.map(k=>(
                  <div key={k} style={{marginBottom:12}}>
                    <label style={{fontSize:12,color:C.slate,display:"block",marginBottom:4,fontWeight:500}}>{LABELS[k]}</label>
                    <input type="number" inputMode="decimal" value={editBuf[k]??""} onChange={e=>setEditBuf(p=>({...p,[k]:e.target.value}))}
                      style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.text,fontSize:15,fontFamily:"inherit",outline:"none"}}/>
                  </div>
                ))}
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:8,paddingBottom:isMobile?16:0}}>
              <button onClick={cancelEdit} style={{flex:1,padding:"12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.slateM,cursor:"pointer",fontFamily:"inherit",fontWeight:500,fontSize:14}}>Cancelar</button>
              <button onClick={applyEdit} style={{flex:2,padding:"12px",borderRadius:8,border:"none",background:C.blueAcct,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:14}}>💾 Guardar registro</button>
            </div>
          </div>
        </div>
      )}

      {/* KPI STRIP */}
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:isMobile?"12px 16px":"16px 28px"}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:isMobile?8:12}}>
          <KpiStrip label="Patrimonio Neto" value={Qk(patrimonioNeto)} color={C.blueAcct} tag="⭐ Total" isMobile={isMobile}/>
          <KpiStrip label="Caja Neta" value={Qk(cajaNeta)} sub={`Bruta: ${Qk(totalCajaBruta)}`} color={C.slate} tag="💵 Efectivo" isMobile={isMobile}/>
          <KpiStrip label="Disponible / mes" value={isMobile?Qk(disponible):Q(disponible)} color={C.green} tag="📈 Libre" isMobile={isMobile}/>
          <KpiStrip label="TC Disponible" value={isMobile?Qk(tcDisponible):Q(tcDisponible)} sub={`${tcUsoPct.toFixed(0)}% en uso`} color={tcColor} tag="💳 Crédito" isMobile={isMobile}/>
        </div>
      </div>

      {/* ALERTAS */}
      {alertas.length>0&&(
        <div style={{padding:isMobile?"10px 16px 0":"10px 28px 0",display:"grid",gap:6}}>
          {alertas.map((a,i)=>(
            <div key={i} style={{background:a.type==="red"?C.redLt:C.orangeLt,border:`1px solid ${a.type==="red"?C.red:C.orange}44`,borderLeft:`4px solid ${a.type==="red"?C.red:C.orange}`,borderRadius:8,padding:"10px 14px",fontSize:isMobile?12:13,color:a.type==="red"?C.red:C.orange,fontWeight:500}}>
              {a.type==="red"?"⚠ ":"ℹ "}{a.msg}
            </div>
          ))}
        </div>
      )}

      {/* TABS */}
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,overflowX:"auto",display:"flex",WebkitOverflowScrolling:"touch"}}>
        <div style={{display:"flex",padding:isMobile?"0 8px":"0 28px",minWidth:"max-content"}}>
          {tabs.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:isMobile?"11px 12px":"12px 18px",whiteSpace:"nowrap",border:"none",borderBottom:`3px solid ${tab===id?C.blueAcct:"transparent"}`,background:"transparent",color:tab===id?C.blueAcct:C.slateM,fontSize:isMobile?12:14,fontFamily:"inherit",fontWeight:tab===id?700:500,cursor:"pointer",transition:"all 0.15s",flexShrink:0}}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{padding:isMobile?"14px 16px 90px":"20px 28px 40px",maxWidth:1200,margin:"0 auto"}}>

        {/* ── RESUMEN ── */}
        {tab==="resumen"&&(
          <div style={{display:"grid",gap:14}}>
            <div style={col2}>
              <Card title="Liquidez Actual" icon="💵" accent={C.blueAcct}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:11,color:C.slateM,marginBottom:2}}>Caja Neta</div>
                    <div style={{fontSize:isMobile?22:28,fontWeight:800,color:C.text}}>{Qk(cajaNeta)}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,color:C.slateM,marginBottom:2}}>Caja Bruta</div>
                    <div style={{fontSize:15,fontWeight:600,color:C.slateM}}>{Qk(totalCajaBruta)}</div>
                  </div>
                </div>
                <Row label="Cuenta Monetaria" value={Q(data.cuentaMonetaria)}/>
                <Row label="Cuenta Ahorro" value={Q(data.cuentaAhorro)}/>
                <Row label="Plan Dorado" value={Q(data.planDorado)}/>
                <Div/>
                <Row label="TC Gastado" value={Q(data.tcGastado)} color={C.red}/>
                <Row label="Caja Neta" value={Q(cajaNeta)} color={C.blueAcct} bold/>
              </Card>
              <Card title="Tarjeta de Crédito" icon="💳" accent={tcColor}>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                  <CircleProgress pct={tcUsoPct} color={tcColor} size={isMobile?64:76} label="uso"/>
                  <div style={{flex:1}}>
                    <Row label="Límite" value={Q(data.tcLimite)}/>
                    <Row label="Gastado" value={Q(data.tcGastado)} color={tcUsoPct>70?C.red:C.orange}/>
                    <Row label="Disponible" value={Q(tcDisponible)} color={C.green} bold/>
                  </div>
                </div>
                <PBar value={data.tcGastado} total={data.tcLimite} color={tcColor} label={`${tcUsoPct.toFixed(1)}% utilizado`}/>
              </Card>
            </div>

            <div style={col2}>
              <Card title="Progreso Deuda Casa" icon="🏠" accent={C.green}>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                  <CircleProgress pct={deudaPagadaPct} color={C.green} size={isMobile?64:76} label="pagado"/>
                  <div style={{flex:1}}>
                    <Row label="Pagado" value={Q(data.deudaCasaOriginal-data.deudaCasa)} color={C.green}/>
                    <Row label="Restante" value={Q(data.deudaCasa)} color={C.red}/>
                    <Row label="Meses restantes" value={`~${mesesDeuda}`}/>
                  </div>
                </div>
                <PBar value={data.deudaCasaOriginal-data.deudaCasa} total={data.deudaCasaOriginal} color={C.green} label={`${deudaPagadaPct.toFixed(1)}% pagado`}/>
              </Card>
              <Card title="Indicadores Clave" icon="📐" accent={C.slate}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <MiniKpi label="ROI Casa (anual)" value={`${roiCasa.toFixed(2)}%`} color={C.green}/>
                  <MiniKpi label="Flujo Neto Renta" value={Q(flujoNeto)} color={flujoNeto>=0?C.green:C.red}/>
                  <MiniKpi label="Tasa PD (bruta)" value={`${data.planDoradoTasa}%`} color={C.orange}/>
                  <MiniKpi label="Tasa PD (real)" value={`${data.planDoradoTasaReal}%`} color={C.blueAcct}/>
                </div>
              </Card>
            </div>

            {/* CRIPTO CARDS en Resumen */}
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
              <CriptoResumenCard coin="⟠ Ethereum" icon={<EthIcon size={isMobile?40:50}/>}
                ganPct={ethGananciaPct} ganUSD={ethGananciaUSD} ganGTQ={ethGananciaGTQ}
                valorUSD={data.ethValorActualUSD} invertidoUSD={data.ethInvertidoUSD}
                valorGTQ={ethValorGTQ} invertidoGTQ={ethInvertidoGTQ}
                bgFrom="#0a0a1a" bgTo="#0d1b3e" ringColor="#63b3ed"
                barColor={ethGananciaPct>=0?"linear-gradient(90deg,#3b82f6,#4ade80)":"linear-gradient(90deg,#3b82f6,#f87171)"}
              />
              <CriptoResumenCard coin="◎ Solana" icon={<SolIcon size={isMobile?40:50}/>}
                ganPct={solGananciaPct} ganUSD={solGananciaUSD} ganGTQ={solGananciaGTQ}
                valorUSD={data.solValorActualUSD} invertidoUSD={data.solInvertidoUSD}
                valorGTQ={solValorGTQ} invertidoGTQ={solInvertidoGTQ}
                bgFrom="#0a0a18" bgTo="#150d2e" ringColor="#9945ff"
                barColor={solGananciaPct>=0?"linear-gradient(90deg,#9945ff,#14f195)":"linear-gradient(90deg,#9945ff,#f87171)"}
              />
            </div>

            <Card title="Distribución de Caja" icon="📊" accent={C.blueAcct}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:isMobile?8:12,marginBottom:14}}>
                <MiniKpi label="Monetaria" value={isMobile?Qk(data.cuentaMonetaria):Q(data.cuentaMonetaria)} color={C.blueAcct} pct={`${((data.cuentaMonetaria/totalCajaBruta)*100).toFixed(0)}%`}/>
                <MiniKpi label="Ahorro" value={isMobile?Qk(data.cuentaAhorro):Q(data.cuentaAhorro)} color={C.green} pct={`${((data.cuentaAhorro/totalCajaBruta)*100).toFixed(0)}%`}/>
                <MiniKpi label="Plan Dorado" value={isMobile?Qk(data.planDorado):Q(data.planDorado)} color={C.orange} pct={`${((data.planDorado/totalCajaBruta)*100).toFixed(0)}%`}/>
              </div>
              <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",gap:2}}>
                {[[data.cuentaMonetaria,C.blueAcct],[data.cuentaAhorro,C.green],[data.planDorado,C.orange]].map(([v,col],i)=>(
                  <div key={i} style={{flex:v,background:col,opacity:0.85,borderRadius:i===0?"6px 0 0 6px":i===2?"0 6px 6px 0":"0"}}/>
                ))}
              </div>
              <div style={{display:"flex",gap:isMobile?12:20,marginTop:10,flexWrap:"wrap"}}>
                {[["Monetaria",C.blueAcct],["Ahorro",C.green],["Plan Dorado",C.orange]].map(([l,c])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:10,height:10,borderRadius:2,background:c,flexShrink:0}}/>
                    <span style={{fontSize:11,color:C.slateM}}>{l}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}


        {/* ── PATRIMONIO NETO ── */}
        {tab==="patrimonio"&&(
          <div style={{display:"grid",gap:14}}>

            {/* Gran total */}
            <div style={{background:"linear-gradient(135deg,#1e3a5f 0%,#1a4a8a 100%)",borderRadius:12,padding:"22px 24px",boxShadow:"0 4px 20px rgba(37,99,235,0.2)"}}>
              <div style={{fontSize:11,color:"rgba(200,220,255,0.6)",letterSpacing:"2px",textTransform:"uppercase",marginBottom:6}}>Patrimonio Neto Total</div>
              <div style={{fontSize:isMobile?32:44,fontWeight:800,color:"#ffffff",letterSpacing:"-1px",lineHeight:1}}>{Q(patrimonioNeto)}</div>
              <div style={{fontSize:12,color:"rgba(200,220,255,0.5)",marginTop:8}}>Suma de todos tus activos menos deudas</div>
            </div>

            {/* Barra proporcional visual */}
            <Card title="Composición del Patrimonio" icon="📊" accent={C.blueAcct}>
              {(()=>{
                const liquidezTotal = cajaNeta;
                const activosTotal  = data.carroValorActual + equidadCasa;
                const criptoTotal   = totalCriptoGTQ;
                const total         = liquidezTotal + activosTotal + criptoTotal;
                const pcts = [
                  [liquidezTotal, C.blueAcct, "Liquidez"],
                  [activosTotal,  C.green,    "Activos"],
                  [criptoTotal,   "#7c3aed",  "Cripto"],
                ];
                return(
                  <>
                    <div style={{height:16,borderRadius:8,overflow:"hidden",display:"flex",gap:2,marginBottom:14}}>
                      {pcts.map(([v,col,label],i)=>(
                        <div key={i} style={{flex:Math.max(v,0),background:col,opacity:0.85,minWidth:v>0?4:0,borderRadius:i===0?"8px 0 0 8px":i===pcts.length-1?"0 8px 8px 0":"0"}}/>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                      {pcts.map(([v,col,label])=>(
                        <div key={label} style={{textAlign:"center"}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,marginBottom:4}}>
                            <div style={{width:10,height:10,borderRadius:2,background:col}}/>
                            <span style={{fontSize:11,color:C.slateM}}>{label}</span>
                          </div>
                          <div style={{fontSize:13,fontWeight:700,color:col}}>{total>0?((v/total)*100).toFixed(1):0}%</div>
                          <div style={{fontSize:11,color:C.slateM}}>{Qk(v)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </Card>

            {/* LIQUIDEZ */}
            <Card title="💵 Liquidez" icon="" accent={C.blueAcct}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <div style={{fontSize:11,color:C.slateM,marginBottom:2}}>Total Liquidez</div>
                  <div style={{fontSize:isMobile?22:28,fontWeight:800,color:C.blueAcct}}>{Q(cajaNeta)}</div>
                </div>
                <div style={{background:C.blueLt,borderRadius:8,padding:"8px 14px",textAlign:"right"}}>
                  <div style={{fontSize:10,color:C.slateM}}>% del patrimonio</div>
                  <div style={{fontSize:18,fontWeight:800,color:C.blueAcct}}>{patrimonioNeto>0?((cajaNeta/patrimonioNeto)*100).toFixed(1):0}%</div>
                </div>
              </div>
              <div style={{display:"grid",gap:8}}>
                <DetalleRow icon="💵" label="Cuenta Monetaria" value={Q(data.cuentaMonetaria)} color={C.blueAcct} pct={totalCajaBruta>0?((data.cuentaMonetaria/totalCajaBruta)*100).toFixed(0):0}/>
                <DetalleRow icon="🏦" label="Cuenta de Ahorro" value={Q(data.cuentaAhorro)} color={C.blueAcct} pct={totalCajaBruta>0?((data.cuentaAhorro/totalCajaBruta)*100).toFixed(0):0}/>
                <DetalleRow icon="⭐" label="Plan Dorado" value={Q(data.planDorado)} color={C.orange} pct={totalCajaBruta>0?((data.planDorado/totalCajaBruta)*100).toFixed(0):0}/>
              </div>
              <div style={{marginTop:10,padding:"10px 12px",background:C.redLt,border:"1px solid "+C.red+"33",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.red}}>— TC Gastado (pendiente pago)</span>
                <span style={{fontSize:13,fontWeight:700,color:C.red}}>− {Q(data.tcGastado)}</span>
              </div>
            </Card>

            {/* ACTIVOS */}
            <Card title="🏠 Activos Físicos" icon="" accent={C.green}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <div style={{fontSize:11,color:C.slateM,marginBottom:2}}>Total Activos</div>
                  <div style={{fontSize:isMobile?22:28,fontWeight:800,color:C.green}}>{Q(data.carroValorActual+equidadCasa)}</div>
                </div>
                <div style={{background:C.greenLt,borderRadius:8,padding:"8px 14px",textAlign:"right"}}>
                  <div style={{fontSize:10,color:C.slateM}}>% del patrimonio</div>
                  <div style={{fontSize:18,fontWeight:800,color:C.green}}>{patrimonioNeto>0?(((data.carroValorActual+equidadCasa)/patrimonioNeto)*100).toFixed(1):0}%</div>
                </div>
              </div>
              <div style={{display:"grid",gap:8}}>
                <DetalleRow icon="🚗" label="Vehículo (valor actual)" value={Q(data.carroValorActual)} color={C.green} sub={"Compra: "+Q(data.carroValorCompra)+" | Depreciación: "+carroDepreciacionPct.toFixed(1)+"%"}/>
                <DetalleRow icon="🏠" label="Casa (valor mercado)" value={Q(data.casaValorActual)} color={C.green} sub={"Compra: "+Q(data.casaValorCompra)+" | Plusvalía: "+(casaPlusvalidPct>=0?"+":"")+casaPlusvalidPct.toFixed(1)+"%"}/>
              </div>
              <div style={{marginTop:10,padding:"10px 12px",background:C.redLt,border:"1px solid "+C.red+"33",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.red}}>— Deuda Casa (restante)</span>
                <span style={{fontSize:13,fontWeight:700,color:C.red}}>− {Q(data.deudaCasa)}</span>
              </div>
              <div style={{marginTop:8,padding:"10px 12px",background:C.greenLt,border:"1px solid "+C.green+"33",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:C.green,fontWeight:600}}>Equidad neta en casa</span>
                <span style={{fontSize:13,fontWeight:700,color:C.green}}>{Q(equidadCasa)}</span>
              </div>
            </Card>

            {/* CRIPTO */}
            <div style={{background:"linear-gradient(135deg,#0a0a18 0%,#0d1330 100%)",border:"1px solid rgba(124,58,237,0.3)",borderRadius:12,padding:"16px 18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>⟠</span>
                  <span style={{fontSize:13,fontWeight:700,color:"rgba(200,220,255,0.8)"}}>Criptomonedas</span>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"rgba(180,180,255,0.4)"}}>% del patrimonio</div>
                  <div style={{fontSize:18,fontWeight:800,color:"#a78bfa"}}>{patrimonioNeto>0?((totalCriptoGTQ/patrimonioNeto)*100).toFixed(1):0}%</div>
                </div>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:11,color:"rgba(150,200,255,0.5)",marginBottom:2}}>Total Cripto en GTQ</div>
                <div style={{fontSize:isMobile?22:28,fontWeight:800,color:"#a78bfa"}}>{Q(totalCriptoGTQ)}</div>
              </div>
              <div style={{display:"grid",gap:8,marginTop:12}}>
                {/* ETH row */}
                <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(99,179,237,0.2)",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:12}}>⟠</span>
                      <span style={{fontSize:12,fontWeight:600,color:"#63b3ed"}}>Ethereum</span>
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:"#63b3ed"}}>{Q(ethValorGTQ)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:10,color:"rgba(150,200,255,0.5)"}}>Invertido: {USD(data.ethInvertidoUSD)} | Actual: {USD(data.ethValorActualUSD)}</span>
                    <span style={{fontSize:10,fontWeight:600,color:ethGananciaPct>=0?"#4ade80":"#f87171"}}>{ethGananciaPct>=0?"+":""}{ethGananciaPct.toFixed(1)}%</span>
                  </div>
                </div>
                {/* SOL row */}
                <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(153,69,255,0.2)",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:12}}>◎</span>
                      <span style={{fontSize:12,fontWeight:600,color:"#9945ff"}}>Solana</span>
                    </div>
                    <span style={{fontSize:13,fontWeight:700,color:"#9945ff"}}>{Q(solValorGTQ)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:10,color:"rgba(180,150,255,0.5)"}}>Invertido: {USD(data.solInvertidoUSD)} | Actual: {USD(data.solValorActualUSD)}</span>
                    <span style={{fontSize:10,fontWeight:600,color:solGananciaPct>=0?"#4ade80":"#f87171"}}>{solGananciaPct>=0?"+":""}{solGananciaPct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ── LIQUIDEZ ── */}
        {tab==="liquidez"&&(
          <div style={{display:"grid",gap:14}}>
            <div style={col3}>
              <Card title="Cuenta Monetaria" icon="💵" accent={C.blueAcct}>
                <NumBig value={Q(data.cuentaMonetaria)} color={C.blueAcct} label="Liquidez inmediata"/>
              </Card>
              <Card title="Cuenta de Ahorro" icon="🏦" accent={C.green}>
                <NumBig value={Q(data.cuentaAhorro)} color={C.green} label="Saldo acumulado"/>
                <Div/><Row label="Depósito este mes" value={Q(data.ahorroMensual)} color={C.green}/>
              </Card>
              <Card title="Plan Dorado" icon="⭐" accent={C.orange}>
                <NumBig value={Q(data.planDorado)} color={C.orange} label="Capital invertido"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
                  <div style={{background:C.orangeLt,border:`1px solid ${C.orange}33`,borderRadius:8,padding:"10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.orange,fontWeight:600,marginBottom:2}}>Antes imp.</div>
                    <div style={{fontSize:20,fontWeight:800,color:C.orange}}>{data.planDoradoTasa}%</div>
                  </div>
                  <div style={{background:C.blueLt,border:`1px solid ${C.blueAcct}33`,borderRadius:8,padding:"10px",textAlign:"center"}}>
                    <div style={{fontSize:10,color:C.blueAcct,fontWeight:600,marginBottom:2}}>Tasa real</div>
                    <div style={{fontSize:20,fontWeight:800,color:C.blueAcct}}>{data.planDoradoTasaReal}%</div>
                  </div>
                </div>
                <Div/>
                <Row label="Aporte neto/mes" value={Q(data.aporteDorado-data.seguroVida)} color={C.green}/>
                <Row label="Seguro de vida" value={Q(data.seguroVida)} color={C.red}/>
              </Card>
            </div>
            <Card title="Tarjeta de Crédito" icon="💳" accent={tcColor}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"auto 1fr",gap:20,alignItems:"center"}}>
                {!isMobile&&<CircleProgress pct={tcUsoPct} color={tcColor} size={90} label="uso TC"/>}
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:isMobile?8:10,marginBottom:14}}>
                    <MiniKpi label="Límite" value={isMobile?Qk(data.tcLimite):Q(data.tcLimite)} color={C.slate}/>
                    <MiniKpi label="Gastado" value={isMobile?Qk(data.tcGastado):Q(data.tcGastado)} color={tcUsoPct>70?C.red:C.orange}/>
                    <MiniKpi label="Disponible" value={isMobile?Qk(tcDisponible):Q(tcDisponible)} color={C.green}/>
                  </div>
                  <PBar value={data.tcGastado} total={data.tcLimite} color={tcColor} label={`${tcUsoPct.toFixed(1)}% utilizado`}/>
                </div>
              </div>
              <Div/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <Row label="Caja bruta" value={Qk(totalCajaBruta)}/>
                <Row label="TC Gastado" value={Q(data.tcGastado)} color={C.red}/>
                <Row label="Caja neta" value={Qk(cajaNeta)} color={C.blueAcct} bold/>
              </div>
            </Card>
          </div>
        )}

        {/* ── ACTIVOS ── */}
        {tab==="activos"&&(
          <div style={{display:"grid",gap:14}}>
            {/* CARRO */}
            <Card title="Vehículo" icon="🚗" accent={carroDepreciacion>0?C.orange:C.green}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:14}}>
                <div>
                  <NumBig value={Q(data.carroValorActual)} color={C.slate} label="Valor actual"/>
                  <div style={{background:C.orangeLt,border:`1px solid ${C.orange}33`,borderRadius:10,padding:"12px",marginTop:12}}>
                    <div style={{fontSize:11,color:C.slateM,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px"}}>Depreciación</div>
                    <div style={{fontSize:isMobile?26:32,fontWeight:800,color:C.orange,lineHeight:1.1}}>{carroDepreciacionPct.toFixed(1)}%</div>
                    <div style={{fontSize:11,color:C.slateM,marginTop:4}}>Pérdida: {Q(carroDepreciacion)}</div>
                  </div>
                </div>
                <div>
                  <div style={{background:C.greenLt,border:`1px solid ${C.green}44`,borderRadius:20,padding:"6px 18px",fontSize:12,color:C.green,fontWeight:700,display:"inline-block",marginBottom:12}}>✓ Deuda pagada</div>
                  <Row label="Precio de compra" value={Q(data.carroValorCompra)}/>
                  <Row label="Valor actual" value={Q(data.carroValorActual)} color={C.slate}/>
                  <Row label="Depreciación Q" value={Q(carroDepreciacion)} color={C.orange}/>
                  <Row label="Depreciación %" value={`${carroDepreciacionPct.toFixed(1)}%`} color={C.orange}/>
                </div>
              </div>
              <PBar value={carroDepreciacion} total={data.carroValorCompra} color={C.orange} label={`${carroDepreciacionPct.toFixed(1)}% depreciado`}/>
            </Card>

            {/* CASA */}
            <Card title="Casa / Bien Raíz" icon="🏠" accent={C.blueAcct}>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,marginBottom:14}}>
                <div>
                  <NumBig value={Q(data.casaValorActual)} color={C.slate} label="Valor actual de mercado"/>
                  {/* Plusvalía */}
                  <div style={{background:casaPlusvalia>=0?C.greenLt:C.redLt,border:`1px solid ${casaPlusvalia>=0?C.green:C.red}33`,borderRadius:10,padding:"12px",marginTop:12}}>
                    <div style={{fontSize:11,color:C.slateM,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px"}}>Plusvalía</div>
                    <div style={{fontSize:isMobile?26:32,fontWeight:800,color:casaPlusvalia>=0?C.green:C.red,lineHeight:1.1}}>{casaPlusvalia>=0?"+":""}{casaPlusvalidPct.toFixed(1)}%</div>
                    <div style={{fontSize:11,color:C.slateM,marginTop:4}}>{casaPlusvalia>=0?"Ganancia":"Pérdida"}: {Q(Math.abs(casaPlusvalia))}</div>
                  </div>
                  {/* ROI */}
                  <div style={{background:C.greenLt,border:`1px solid ${C.green}33`,borderRadius:10,padding:"12px",marginTop:10}}>
                    <div style={{fontSize:11,color:C.slateM,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px"}}>ROI Anual (renta)</div>
                    <div style={{fontSize:isMobile?26:32,fontWeight:800,color:C.green,lineHeight:1.1}}>{roiCasa.toFixed(2)}%</div>
                    <div style={{fontSize:11,color:C.slateM,marginTop:4}}>Q{(data.rentaIngreso*12).toLocaleString()} / año</div>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:12,color:C.slateM,fontWeight:600,marginBottom:10}}>Progreso de pago</div>
                  <div style={{display:"flex",justifyContent:isMobile?"flex-start":"center",marginBottom:14}}>
                    <CircleProgress pct={deudaPagadaPct} color={C.blueAcct} size={isMobile?80:90} label="pagado"/>
                  </div>
                  <Row label="Precio de compra" value={Q(data.casaValorCompra)}/>
                  <Row label="Valor actual" value={Q(data.casaValorActual)} color={casaPlusvalia>=0?C.green:C.red}/>
                  <Row label="Plusvalía" value={`${casaPlusvalia>=0?"+":""}${Q(casaPlusvalia)}`} color={casaPlusvalia>=0?C.green:C.red}/>
                  <Div/>
                  <Row label="Deuda restante" value={Q(data.deudaCasa)} color={C.red}/>
                  <Row label="Equidad" value={Q(equidadCasa)} color={C.green} bold/>
                  <Row label="Renta mensual" value={Q(data.rentaIngreso)} color={C.green}/>
                  <Row label="Flujo neto" value={Q(flujoNeto)} color={flujoNeto>=0?C.green:C.red}/>
                </div>
              </div>
              <PBar value={data.deudaCasaOriginal-data.deudaCasa} total={data.deudaCasaOriginal} color={C.blueAcct} label={`${deudaPagadaPct.toFixed(1)}% pagado — Q${data.abonoCasa.toLocaleString()}/mes`}/>
            </Card>
          </div>
        )}

        {/* ── CRIPTO ── */}
        {tab==="cripto"&&(
          <div style={{display:"grid",gap:14}}>
            {/* ETH */}
            <div style={{background:"linear-gradient(135deg,#0a0a1a 0%,#0d1b3e 50%,#0a1628 100%)",border:"1px solid rgba(99,179,237,0.3)",borderRadius:12,padding:"20px",boxShadow:"0 4px 24px rgba(66,153,225,0.15)"}}>
              <div style={{fontSize:12,fontWeight:700,color:"rgba(99,179,237,0.8)",letterSpacing:"2px",marginBottom:16}}>⟠ ETHEREUM</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:16}}>
                {[["Invertido",USD(data.ethInvertidoUSD),Q(ethInvertidoGTQ),"rgba(150,200,255,0.8)"],
                  ["Valor Actual",USD(data.ethValorActualUSD),Q(ethValorGTQ),"#63b3ed"],
                  [ethGananciaPct>=0?"Ganancia":"Pérdida",(ethGananciaPct>=0?"+":"")+USD(ethGananciaUSD),(ethGananciaPct>=0?"+":"")+Q(ethGananciaGTQ),ethGananciaPct>=0?"#4ade80":"#f87171"],
                  ["Rendimiento",(ethGananciaPct>=0?"+":"")+ethGananciaPct.toFixed(1)+"%","vs capital",ethGananciaPct>=0?"#4ade80":"#f87171"],
                ].map(([label,main,sub,color])=>(
                  <div key={label} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(99,179,237,0.15)",borderRadius:8,padding:"12px"}}>
                    <div style={{fontSize:10,color:"rgba(150,200,255,0.5)",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:isMobile?15:18,fontWeight:800,color}}>{main}</div>
                    <div style={{fontSize:11,color:"rgba(150,200,255,0.5)",marginTop:2}}>{sub}</div>
                  </div>
                ))}
              </div>
              <div style={{height:6,background:"rgba(99,179,237,0.1)",borderRadius:3}}>
                <div style={{width:`${Math.min(100,Math.max(4,(data.ethValorActualUSD/(data.ethInvertidoUSD*1.5||1))*100))}%`,height:"100%",background:ethGananciaPct>=0?"linear-gradient(90deg,#3b82f6,#4ade80)":"linear-gradient(90deg,#3b82f6,#f87171)",borderRadius:3,transition:"width 0.5s"}}/>
              </div>
              <div style={{fontSize:10,color:"rgba(150,200,255,0.35)",marginTop:6,textAlign:"right"}}>TC: Q{data.tipoCambio} por $1</div>
            </div>

            {/* SOL */}
            <div style={{background:"linear-gradient(135deg,#0a0a18 0%,#150d2e 50%,#0f1220 100%)",border:"1px solid rgba(153,69,255,0.35)",borderRadius:12,padding:"20px",boxShadow:"0 4px 24px rgba(153,69,255,0.15)"}}>
              <div style={{fontSize:12,fontWeight:700,color:"rgba(153,69,255,0.9)",letterSpacing:"2px",marginBottom:16}}>◎ SOLANA</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:16}}>
                {[["Invertido",USD(data.solInvertidoUSD),Q(solInvertidoGTQ),"rgba(180,150,255,0.8)"],
                  ["Valor Actual",USD(data.solValorActualUSD),Q(solValorGTQ),"#9945ff"],
                  [solGananciaPct>=0?"Ganancia":"Pérdida",(solGananciaPct>=0?"+":"")+USD(solGananciaUSD),(solGananciaPct>=0?"+":"")+Q(solGananciaGTQ),solGananciaPct>=0?"#14f195":"#f87171"],
                  ["Rendimiento",(solGananciaPct>=0?"+":"")+solGananciaPct.toFixed(1)+"%","vs capital",solGananciaPct>=0?"#14f195":"#f87171"],
                ].map(([label,main,sub,color])=>(
                  <div key={label} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(153,69,255,0.2)",borderRadius:8,padding:"12px"}}>
                    <div style={{fontSize:10,color:"rgba(180,150,255,0.5)",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:isMobile?15:18,fontWeight:800,color}}>{main}</div>
                    <div style={{fontSize:11,color:"rgba(180,150,255,0.5)",marginTop:2}}>{sub}</div>
                  </div>
                ))}
              </div>
              <div style={{height:6,background:"rgba(153,69,255,0.1)",borderRadius:3}}>
                <div style={{width:`${Math.min(100,Math.max(4,(data.solValorActualUSD/(data.solInvertidoUSD*1.5||1))*100))}%`,height:"100%",background:solGananciaPct>=0?"linear-gradient(90deg,#9945ff,#14f195)":"linear-gradient(90deg,#9945ff,#f87171)",borderRadius:3,transition:"width 0.5s"}}/>
              </div>
              <div style={{fontSize:10,color:"rgba(180,150,255,0.3)",marginTop:6,textAlign:"right"}}>TC: Q{data.tipoCambio} por $1</div>
            </div>

            {/* Resumen cripto */}
            <Card title="Resumen Cripto" icon="💰" accent={C.blueAcct}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                <MiniKpi label="Total invertido" value={USD(data.ethInvertidoUSD+data.solInvertidoUSD)} color={C.slate}/>
                <MiniKpi label="Total valor actual" value={USD(data.ethValorActualUSD+data.solValorActualUSD)} color={C.blueAcct}/>
                <MiniKpi label="Total en GTQ" value={Qk(totalCriptoGTQ)} color={C.green}/>
              </div>
            </Card>

            <div style={{background:C.blueLt,border:`1px solid ${C.blueAcct}33`,borderRadius:10,padding:"14px 16px",fontSize:12,color:C.blueAcct,lineHeight:1.7}}>
              <strong>ℹ Cómo actualizar:</strong> Cada semana en <strong>Editar datos → Cripto</strong>, ingresa el valor actual de ETH y SOL en USD. El tipo de cambio también lo puedes actualizar ahí.
            </div>
          </div>
        )}

        {/* ── FLUJO ── */}
        {tab==="flujo"&&(
          <div style={col2}>
            <Card title="Ingresos Mensuales" icon="📥" accent={C.green}>
              <NumBig value={Q(totalIngresos)} color={C.green} label="Total ingresos / mes"/>
              <Div/>
              <BarLabeled label="Salario" value={data.salario} total={totalIngresos} color={C.green}/>
              <BarLabeled label="Renta casa" value={data.rentaIngreso} total={totalIngresos} color={C.blueAcct}/>
            </Card>
            <Card title="Egresos Mensuales" icon="📤" accent={C.red}>
              <NumBig value={Q(totalEgresos)} color={C.red} label="Total comprometido / mes"/>
              <Div/>
              <BarLabeled label="Ahorro" value={data.ahorroMensual} total={totalIngresos} color={C.green}/>
              <BarLabeled label="Plan Dorado (neto)" value={data.aporteDorado-data.seguroVida} total={totalIngresos} color={C.orange}/>
              <BarLabeled label="Seguro de vida" value={data.seguroVida} total={totalIngresos} color={C.red}/>
              <BarLabeled label="Abono casa" value={data.abonoCasa} total={totalIngresos} color={C.blueAcct}/>
              <Div/>
              <Row label="Disponible libre" value={Q(disponible)} color={C.green} bold/>
              <Row label="Tasa de ahorro" value={`${(((data.ahorroMensual+data.aporteDorado)/data.salario)*100).toFixed(1)}%`} color={C.blueAcct} bold/>
            </Card>
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab==="historial"&&(
          <div style={{display:"grid",gap:14}}>
            {history.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px",color:C.slateM}}>
                <div style={{fontSize:40,marginBottom:14}}>📋</div>
                <div style={{fontWeight:700,color:C.slate,marginBottom:8,fontSize:15}}>Sin registros aún.</div>
                <div style={{fontSize:13}}>Presiona <strong style={{color:C.blueAcct}}>Actualizar datos</strong> para guardar el primer registro.</div>
              </div>
            ):(
              <>
                {/* Selector métricas */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[["cuentaAhorro","Ahorro"],["cuentaMonetaria","Monetaria"],["planDorado","Plan Dorado"],["deudaCasa","Deuda Casa"],["tcGastado","TC"],["patrimonioCalc","Patrimonio"]].map(([k,label])=>(
                    <button key={k} onClick={()=>setHistTab(k)} style={{padding:"6px 12px",borderRadius:20,fontSize:isMobile?11:12,cursor:"pointer",fontFamily:"inherit",border:`1px solid ${histTab===k?C.blueAcct:C.border}`,background:histTab===k?C.blueLt:C.white,color:histTab===k?C.blueAcct:C.slateM,fontWeight:histTab===k?700:400}}>{label}</button>
                  ))}
                </div>

                <Card title={`Evolución — ${histTab==="patrimonioCalc"?"Patrimonio Neto":LABELS[histTab]||histTab}`} icon="📈" accent={C.blueAcct}>
                  <MiniChart data={history.map(h=>({label:h.label,value:histTab==="patrimonioCalc"?(h.cuentaMonetaria+h.cuentaAhorro+h.planDorado+(h.carroValorActual||h.carroValor||0)+(h.casaValorActual||h.casaValor||0)-h.deudaCasa-(h.tcGastado||0)+((h.ethValorActualUSD||0)+(h.solValorActualUSD||0))*(h.tipoCambio||7.72)):(h[histTab]||0)}))} color={C.blueAcct}/>
                </Card>

                {historialMensual.length>1&&(
                  <Card title="Evolución Mensual — Patrimonio" icon="📅" accent={C.green}>
                    <MiniChart data={historialMensual.map(m=>({label:m.mes?.slice(5),value:m.pat}))} color={C.green}/>
                  </Card>
                )}

                <Card title="Registros Semanales" icon="📋" accent={C.slate}>
                  {isMobile ? (
                    <div style={{display:"grid",gap:10}}>
                      {[...history].reverse().map((h,i)=>{
                        const pat=h.cuentaMonetaria+h.cuentaAhorro+h.planDorado+(h.carroValorActual||h.carroValor||0)+(h.casaValorActual||h.casaValor||0)-h.deudaCasa-(h.tcGastado||0)+((h.ethValorActualUSD||0)+(h.solValorActualUSD||0))*(h.tipoCambio||7.72);
                        return(
                          <div key={i} style={{background:C.bg,border:"1px solid "+C.border,borderRadius:8,padding:"12px",borderLeft:"3px solid "+C.blueAcct}}>
                            <div style={{fontSize:12,fontWeight:700,color:C.slate,marginBottom:10}}>{h.label}</div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                              <div><div style={{fontSize:9,color:C.slateL}}>Ahorro</div><div style={{fontSize:12,fontWeight:600,color:C.green}}>{Q(h.cuentaAhorro)}</div></div>
                              <div><div style={{fontSize:9,color:C.slateL}}>Plan Dorado</div><div style={{fontSize:12,fontWeight:600,color:C.orange}}>{Q(h.planDorado)}</div></div>
                              <div><div style={{fontSize:9,color:C.slateL}}>TC Gastado</div><div style={{fontSize:12,fontWeight:600,color:C.red}}>{Q(h.tcGastado||0)}</div></div>
                              <div><div style={{fontSize:9,color:C.slateL}}>Deuda Casa</div><div style={{fontSize:12,fontWeight:600,color:C.red}}>{Q(h.deudaCasa)}</div></div>
                            </div>
                            <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span style={{fontSize:11,color:C.slateM}}>Patrimonio</span>
                              <span style={{fontSize:14,fontWeight:800,color:C.blueAcct}}>{Qk(pat)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <table style={{borderCollapse:"collapse",fontSize:13,width:"100%"}}>
                      <thead>
                        <tr style={{background:C.bg}}>
                          {["Semana","Ahorro","Plan Dorado","TC","Deuda Casa","Patrimonio"].map(h=>(
                            <th key={h} style={{textAlign:"right",padding:"10px 12px",fontWeight:600,color:C.slate,whiteSpace:"nowrap",fontSize:12,borderBottom:"2px solid "+C.border}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...history].reverse().map((h,i)=>{
                          const pat=h.cuentaMonetaria+h.cuentaAhorro+h.planDorado+(h.carroValorActual||h.carroValor||0)+(h.casaValorActual||h.casaValor||0)-h.deudaCasa-(h.tcGastado||0)+((h.ethValorActualUSD||0)+(h.solValorActualUSD||0))*(h.tipoCambio||7.72);
                          return(
                            <tr key={i} style={{borderBottom:"1px solid "+C.border,background:i%2===0?C.white:C.bg}}>
                              <td style={{padding:"10px 12px",color:C.slate,whiteSpace:"nowrap",fontWeight:600}}>{h.label}</td>
                              <td style={{textAlign:"right",padding:"10px 12px",color:C.green,whiteSpace:"nowrap"}}>{Q(h.cuentaAhorro)}</td>
                              <td style={{textAlign:"right",padding:"10px 12px",color:C.orange,whiteSpace:"nowrap"}}>{Q(h.planDorado)}</td>
                              <td style={{textAlign:"right",padding:"10px 12px",color:C.red,whiteSpace:"nowrap"}}>{Q(h.tcGastado||0)}</td>
                              <td style={{textAlign:"right",padding:"10px 12px",color:C.red,whiteSpace:"nowrap"}}>{Q(h.deudaCasa)}</td>
                              <td style={{textAlign:"right",padding:"10px 12px",color:C.blueAcct,whiteSpace:"nowrap",fontWeight:700}}>{Qk(pat)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </Card>
              </>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM NAV MÓVIL */}
      {isMobile&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.white,borderTop:`1px solid ${C.border}`,display:"flex",boxShadow:"0 -2px 10px rgba(0,0,0,0.08)",zIndex:40}}>
          {tabs.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px 2px 6px",border:"none",background:"transparent",color:tab===id?C.blueAcct:C.slateL,fontSize:9,fontFamily:"inherit",fontWeight:tab===id?700:400,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderTop:`2px solid ${tab===id?C.blueAcct:"transparent"}`}}>
              <span style={{fontSize:15}}>{id==="resumen"?"📊":id==="patrimonio"?"💎":id==="liquidez"?"💵":id==="activos"?"🏠":id==="cripto"?"⟠":id==="flujo"?"📤":"🕐"}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componentes ───────────────────────────────────────────────────────
function KpiStrip({label,value,sub,color,tag,isMobile}){
  return(
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:isMobile?"10px 12px":"14px 16px",borderLeft:`4px solid ${color}`}}>
      <div style={{fontSize:isMobile?9:10,color:C.slateL,fontWeight:500,marginBottom:isMobile?3:5,textTransform:"uppercase",letterSpacing:"0.5px"}}>{tag}</div>
      <div style={{fontSize:isMobile?15:20,fontWeight:800,color,marginBottom:2}}>{value}</div>
      {sub&&<div style={{fontSize:isMobile?9:11,color:C.slateM}}>{sub}</div>}
      <div style={{fontSize:isMobile?9:11,color:C.slateM,marginTop:1}}>{label}</div>
    </div>
  );
}
function Card({title,icon,accent=C.blueAcct,children}){
  return(
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${C.border}`}}>
        <span style={{fontSize:14}}>{icon}</span>
        <span style={{fontSize:13,fontWeight:700,color:C.slate}}>{title}</span>
        <div style={{flex:1}}/>
        <div style={{width:3,height:16,borderRadius:2,background:accent}}/>
      </div>
      {children}
    </div>
  );
}
function NumBig({value,color,label}){
  return(<div><div style={{fontSize:24,fontWeight:800,color:color||C.text,letterSpacing:"-0.5px"}}>{value}</div>{label&&<div style={{fontSize:11,color:C.slateM,marginTop:2}}>{label}</div>}</div>);
}
function MiniKpi({label,value,color,pct}){
  return(
    <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px"}}>
      <div style={{fontSize:10,color:C.slateL,marginBottom:4,fontWeight:500}}>{label}</div>
      <div style={{fontSize:13,fontWeight:700,color}}>{value}</div>
      {pct&&<div style={{fontSize:10,color:C.slateM,marginTop:2}}>{pct} del total</div>}
    </div>
  );
}
function Row({label,value,color,bold}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"center"}}>
      <span style={{fontSize:12,color:C.slateM}}>{label}</span>
      <span style={{fontSize:13,fontWeight:bold?700:500,color:color||C.text}}>{value}</span>
    </div>
  );
}
function Div(){return <div style={{height:1,background:C.border,margin:"10px 0"}}/>;}
function PBar({value,total,color,label}){
  const pct=total>0?Math.min(100,(value/total)*100):0;
  return(
    <div>
      {label&&<div style={{fontSize:11,color:C.slateM,marginBottom:5}}>{label}</div>}
      <div style={{height:8,background:C.bg,borderRadius:4,border:`1px solid ${C.border}`}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:4,transition:"width 0.5s ease"}}/>
      </div>
    </div>
  );
}
function BarLabeled({label,value,total,color}){
  const pct=total>0?Math.min(100,(value/total)*100):0;
  return(
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:12,color:C.slateM}}>{label}</span>
        <span style={{fontSize:12,fontWeight:600,color}}>{Q(value)}</span>
      </div>
      <div style={{height:6,background:C.bg,borderRadius:3,border:`1px solid ${C.border}`}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:3}}/>
      </div>
    </div>
  );
}
function CircleProgress({pct,color,size=80,label="%"}){
  const r=30,cx=40,cy=40,circ=2*Math.PI*r;
  const fill=Math.min(100,Math.max(0,pct));
  const dash=(fill/100)*circ;
  return(
    <div style={{display:"inline-block",textAlign:"center",flexShrink:0}}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bg} strokeWidth="8"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth="8"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ/4} style={{transition:"stroke-dasharray 0.6s ease"}}/>
        <text x={cx} y={cy-3} textAnchor="middle" fill={color} fontSize="13" fontWeight="800" fontFamily="Inter,sans-serif">{fill.toFixed(0)}%</text>
        <text x={cx} y={cy+11} textAnchor="middle" fill={C.slateL} fontSize="7" fontFamily="Inter,sans-serif">{label}</text>
      </svg>
    </div>
  );
}
function MiniChart({data,color=C.blueAcct}){
  if(!data.length) return null;
  const vals=data.map(d=>d.value);
  const min=Math.min(...vals),max=Math.max(...vals),range=max-min||1,H=80;
  const pts=data.map((d,i)=>{ const x=data.length===1?50:(i/(data.length-1))*100; const y=H-((d.value-min)/range)*(H-14)-7; return `${x},${y}`; }).join(" ");
  const fx=data.length===1?50:0,lx=data.length===1?50:100;
  const area=`M ${fx} ${H} ${data.map((d,i)=>{ const x=data.length===1?50:(i/(data.length-1))*100; const y=H-((d.value-min)/range)*(H-14)-7; return `L ${x} ${y}`; }).join(" ")} L ${lx} ${H} Z`;
  const gid=`g${color.replace(/[^a-z0-9]/gi,"")}`;
  return(
    <div>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{width:"100%",height:100,display:"block"}}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.15"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
        <path d={area} fill={`url(#${gid})`}/>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        {data.map((d,i)=>{ const x=data.length===1?50:(i/(data.length-1))*100; const y=H-((d.value-min)/range)*(H-14)-7; return <circle key={i} cx={x} cy={y} r="2.5" fill={C.white} stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>; })}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        {data.map((d,i)=><div key={i} style={{fontSize:9,color:C.slateL,textAlign:"center",flex:1}}>{d.label}</div>)}
      </div>
      <Div/>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:C.slateM}}>Mín: <span style={{color:C.red,fontWeight:600}}>{Q(Math.min(...vals))}</span></span>
        <span style={{fontSize:11,color:C.slateM}}>Máx: <span style={{color:C.green,fontWeight:600}}>{Q(Math.max(...vals))}</span></span>
        <span style={{fontSize:11,color:C.slateM}}>Último: <span style={{color,fontWeight:600}}>{Q(vals[vals.length-1])}</span></span>
      </div>
    </div>
  );
}

function DetalleRow({icon, label, value, color, pct, sub}) {
  return(
    <div style={{background:C.bg,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:sub?4:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:13}}>{icon}</span>
          <span style={{fontSize:12,fontWeight:600,color:C.slate}}>{label}</span>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:13,fontWeight:700,color}}>{value}</div>
          {pct&&<div style={{fontSize:10,color:C.slateL}}>{pct}% de caja</div>}
        </div>
      </div>
      {sub&&<div style={{fontSize:10,color:C.slateM,marginTop:2,paddingLeft:20}}>{sub}</div>}
    </div>
  );
}
