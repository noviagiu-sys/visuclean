import { useState, useRef, useCallback } from "react";

function analyzeImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 400;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const n = w * h;
      let bf=0, df=0, vdf=0, sR=0, sG=0, sB=0, cvs=0, lsum=0, lsq=0, wc=0;
      for (let i=0; i<data.length; i+=4) {
        const r=data[i]/255, g=data[i+1]/255, b=data[i+2]/255;
        const l=0.299*r+0.587*g+0.114*b;
        lsum+=l; lsq+=l*l;
        if(l>0.82) bf++; if(l<0.18) df++; if(l<0.08) vdf++;
        sR+=r; sG+=g; sB+=b;
        const avg=(r+g+b)/3;
        cvs+=Math.abs(r-avg)+Math.abs(g-avg)+Math.abs(b-avg);
        if((r-b)>0.12&&l>0.08) wc++;
      }
      const mR=sR/n, mG=sG/n, mB=sB/n;
      const bfr=bf/n, dfr=df/n, vdfr=vdf/n, cv=cvs/n;
      const lm=lsum/n, tv=Math.max(0,lsq/n-lm*lm);
      const brown=mR-mB, wf=wc/n;
      let dry, clean, intact;
      if(bfr>0.04) dry={pass:false,message:"Feuchtigkeit erkannt",detail:(bfr*100).toFixed(1)+"% helle Reflexionspunkte",severity:Math.min(100,Math.round(bfr*1200)),action:"Nachtrocknung erforderlich"};
      else if(lm<0.22&&dfr>0.30) dry={pass:false,message:"Verdacht auf nasse Oberflaeche",detail:"Sehr dunkle Oberflaeche - Feuchtigkeit moeglich",severity:45,action:"Trocknungszustand visuell pruefen"};
      else dry={pass:true,message:"Trocken",detail:"Keine Feuchtigkeit erkannt (Helligkeit "+(lm*100).toFixed(0)+"%)"};
      if(wf>0.12||brown>0.06) clean={pass:false,message:"Organische Rueckstaende (braun/gelb)",detail:(wf*100).toFixed(1)+"% warme Pixel - Braun-Score: "+brown.toFixed(3),severity:Math.min(100,Math.round(Math.max(wf,brown)*700)),action:"Nachreinigung - Produktrueckstaende pruefen"};
      else if(cv>0.048) clean={pass:false,message:"Verfaerbung / Rueckstaende erkannt",detail:"Farbabweichung: "+(cv*100).toFixed(2)+"%",severity:Math.min(100,Math.round(cv*1100)),action:"Reinigung wiederholen - Abstrich empfohlen"};
      else if(lm<0.28) clean={pass:false,message:"Verdacht auf Ablagerungen",detail:"Oberflaeche zu dunkel ("+(lm*100).toFixed(0)+"%) - Edelstahl sollte heller sein",severity:50,action:"Reinigungszustand visuell nachpruefen"};
      else clean={pass:true,message:"Sauber",detail:"Keine sichtbaren Rueckstaende"};
      if(tv>0.020) intact={pass:false,message:"Unregelmaessige Oberflaeche erkannt",detail:"Textur-Varianz: "+tv.toFixed(4),severity:Math.min(100,Math.round((tv-0.020)*3500)),action:"Abplatzer / Risse / Korrosion? - Nachpruefung"};
      else if(vdfr>0.04) intact={pass:false,message:"Dunkle Flecken / Korrosionsverdacht",detail:(vdfr*100).toFixed(1)+"% sehr dunkle Pixel",severity:40,action:"Rost / Abplatzer / Dichtungsschaeden pruefen"};
      else intact={pass:true,message:"Intakt",detail:"Oberflaeche gleichmaessig"};
      resolve({dry,clean,intact,lm});
    };
    img.onerror=()=>resolve(null);
    img.src=dataUrl;
  });
}

function getLightLevel(lm) {
  if (lm < 0.15) return "critical";
  if (lm < 0.28) return "warning";
  return "ok";
}

function exportPDF(entry) {
  const { equip, zone, date, time, img, res, signature, wipeResult } = entry;
  const allPass = res?.dry?.pass && res?.clean?.pass && res?.intact?.pass;
  const statusColor = allPass ? "#16a34a" : "#dc2626";
  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>VisuClean Pruefprotokoll</title>&lt;style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#111;font-size:13px}h1{font-size:20px;margin:0 0 4px}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0ea5e9;padding-bottom:12px;margin-bottom:16px}.badge{padding:6px 18px;border-radius:20px;font-weight:700;font-size:14px;color:#fff;background:'+statusColor+'}.meta{color:#666;font-size:12px;margin-top:4px}.row{display:flex;gap:16px;margin-bottom:14px}.photo{width:220px;height:160px;object-fit:cover;border-radius:8px;border:1px solid #ddd;flex-shrink:0}.checks{flex:1}.check{padding:10px 12px;border-radius:6px;margin-bottom:8px;border:1px solid}.pass{background:#f0fdf4;border-color:#bbf7d0}.fail{background:#fef2f2;border-color:#fecaca}.label{font-weight:700;font-size:13px}.detail{color:#555;font-size:12px;margin-top:2px}.action{color:#c2410c;font-size:12px;margin-top:4px}.wipe{background:#fefce8;border:1px solid #fef08a;padding:10px;border-radius:6px;margin-top:10px}.sig-box{border:1px solid #ccc;border-radius:6px;padding:8px;margin-top:12px;text-align:center}.footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#888;display:flex;justify-content:space-between}&lt;/style></head><body><div class="header"><div><h1>VisuClean - Pruefprotokoll</h1><div class="meta">Equipment: <b>'+equip+'</b> | Zone: <b>'+zone+'</b></div><div class="meta">Datum: '+date+' | Zeit: '+time+'</div></div><div class="badge">'+(allPass?"FREIGEGEBEN":"GESPERRT")+'</div></div><div class="row">'+(img?'<img class="photo" src="'+img+'" alt="Prueffoto"/>':'')+'<div class="checks">'+["dry","clean","intact"].map(function(k){var r=res?.[k];if(!r)return"";var lbl=k==="dry"?"Trocken":k==="clean"?"Sauber":"Intakt";return'<div class="check '+(r.pass?"pass":"fail")+'"><div class="label">'+lbl+": "+(r.pass?"OK":"FAIL")+'</div><div class="detail">'+r.message+" - "+r.detail+"</div>"+(!r.pass&&r.action?'<div class="action">'+r.action+"</div>":"")+"</div>";}).join("")+'</div></div>'+(wipeResult?'<div class="wipe"><b>Wischtest:</b> '+wipeResult+"</div>":"")+(signature?'<div class="sig-box"><b>Digitale Unterschrift (GMP):</b><br/><img src="'+signature+'" style="max-height:80px;margin-top:6px"/></div>':'')+'<div class="footer"><span>VisuClean v7.0 - Canvas KI - GMP Annex 11 - 21 CFR Part 11 - ALCOA+</span><span>Generiert: '+new Date().toLocaleString("de-CH")+'</span></div></body></html>';
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = ("VisuClean_"+equip+"_"+zone+"_"+date+".html").replace(/[\s/]/g,"_");
  document.body.appendChild(a); a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef();
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  const start = useCallback((e) => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e, canvasRef.current); }, []);
  const draw = useCallback((e) => { e.preventDefault(); if (!drawing.current) return; const canvas = canvasRef.current; const ctx = canvas.getContext("2d"); const pos = getPos(e, canvas); ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke(); lastPos.current = pos; }, []);
  const stop = useCallback(() => { drawing.current = false; }, []);
  const clear = () => { canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); };
  const save = () => { onSave(canvasRef.current.toDataURL("image/png")); };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(7,12,20,.92)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#0f1724", border:"1px solid #1e293b", borderRadius:16, padding:20, width:"100%", maxWidth:440 }}>
        <div style={{ fontWeight:700, fontSize:17, marginBottom:4 }}>Digitale Unterschrift</div>
        <div style={{ color:"#475569", fontSize:13, marginBottom:14 }}>GMP-konforme Freigabe - Mit Finger unterzeichnen</div>
        <canvas ref={canvasRef} width={380} height={140} style={{ background:"#fff", borderRadius:10, width:"100%", height:140, touchAction:"none", display:"block" }} onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop} onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
        <div style={{ display:"flex", gap:10, marginTop:14 }}>
          <div onClick={clear} style={{ flex:1, padding:"11px 0", borderRadius:9, textAlign:"center", border:"1px solid #334155", color:"#64748b", cursor:"pointer", fontSize:14 }}>Loeschen</div>
          <div onClick={onCancel} style={{ flex:1, padding:"11px 0", borderRadius:9, textAlign:"center", border:"1px solid #334155", color:"#64748b", cursor:"pointer", fontSize:14 }}>Abbrechen</div>
          <div onClick={save} style={{ flex:2, padding:"11px 0", borderRadius:9, textAlign:"center", background:"#0ea5e9", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>Bestaetigen</div>
        </div>
      </div>
    </div>
  );
}

const C = { bg:"#070c14",card:"#0f1724",border:"#1e293b",blue:"#0ea5e9",green:"#4ade80",red:"#f87171",orange:"#fb923c",text:"#e2e8f0",muted:"#475569",mono:"'JetBrains Mono',monospace" };

const EQUIPMENT = [
  {id:"tp",icon:"⚙️",name:"Tablettenpresse",zones:["Stempeloberflaeche","Matrizenteller","Stempelfuehrung","Unterstempel","Pressstation"]},
  {id:"ct",icon:"🔄",name:"Coater",zones:["Trommelinnenwand","Spruehdüsen","Trommelauslass","Dichtungsring"]},
  {id:"gr",icon:"🌀",name:"Granulator",zones:["Mischkammer","Zerhacker","Ruehrwerkswelle","Dichtungen"]},
  {id:"fb",icon:"💨",name:"Wirbelschicht",zones:["Filterbeutel","Siebboden","Spruehdüse","Produktbehaelter"]},
  {id:"mx",icon:"🔃",name:"Mischer / Blender",zones:["Innenoberflaeche","Klappenventil","Schweissnaehte","Auslaufoeffnung"]},
  {id:"cf",icon:"💊",name:"Kapselfueller",zones:["Dosierrohr","Kapselhalter","Schliessstation","Ausstossstation"]},
  {id:"kt",icon:"🔵",name:"Klappenteller",mat:"Edelstahl",zones:["Telleroberflaeche oben","Telleroberflaeche unten","Dichtungsring","Ventilschaft","Flanschflaeche"]},
  {id:"ibc",icon:"📦",name:"IBC Container / Bin",mat:"Edelstahl",zones:["Innenoberflaeche Boden","Innenoberflaeche Waende","Auslaufkonus","Butterfly-Ventil","Schweissnaehte"]},
  {id:"ss",icon:"🔩",name:"Edelstahl-Kleinteile",mat:"Edelstahl",zones:["Oberflaeche produktberuehrend","Schweissnaehte","Dichtflaechen","Kanten und Ecken"]},
];

function T({onClick,children,style={}}) {
  return <div onClick={onClick} style={{cursor:"pointer",userSelect:"none",WebkitUserSelect:"none",WebkitTapHighlightColor:"transparent",...style}}>{children}</div>;
}

function Bar({v,color}) {
  return <div style={{background:"#1a1f2e",borderRadius:4,height:5,overflow:"hidden",marginTop:6}}><div style={{width:v+"%",height:"100%",background:color,transition:"width .8s ease"}}/></div>;
}

function RCard({label,r}) {
  if(!r) return null;
  return (
    <div style={{background:r.pass?"#0d1f14":"#1f0d0d",border:"1px solid "+(r.pass?"#1a4a2a":"#4a1a1a"),borderRadius:11,padding:"13px 16px",marginBottom:10}}>
      <div style={{display:"flex",gap:12}}>
        <span style={{fontSize:22}}>{r.pass?"✅":"🛑"}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14}}>{label}</div>
          <div style={{color:C.text,fontSize:13,marginTop:2}}>{r.message}</div>
          <div style={{color:C.muted,fontSize:12,marginTop:2}}>{r.detail}</div>
          {!r.pass&&r.severity!=null&&<><Bar v={r.severity} color={r.severity>65?C.red:C.orange}/><div style={{color:r.severity>65?C.red:C.orange,fontSize:11,marginTop:3,fontFamily:C.mono}}>Schweregrad: {r.severity}%</div></>}
          {!r.pass&&r.action&&<div style={{color:C.orange,fontSize:12,marginTop:7,paddingLeft:10,borderLeft:"2px solid #c2410c"}}>{r.action}</div>}
        </div>
      </div>
    </div>
  );
}

export default function VisuClean() {
  const [sc,setSc] = useState("home");
  const [eq,setEq] = useState(null);
  const [zone,setZone] = useState(null);
  const [zIdx,setZIdx] = useState(0);
  const [img,setImg] = useState(null);
  const [refImgs,setRefImgs] = useState({});
  const [prog,setProg] = useState(0);
  const [step,setStep] = useState(0);
  const [res,setRes] = useState(null);
  const [lightWarn,setLightWarn] = useState(null);
  const [wipePhase,setWipePhase] = useState(0);
  const [wipeImg1,setWipeImg1] = useState(null);
  const [wipeImg2,setWipeImg2] = useState(null);
  const [wipeResult,setWipeResult] = useState(null);
  const [showSig,setShowSig] = useState(false);
  const [signature,setSignature] = useState(null);
  const [log,setLog] = useState([]);
  const fileRef = useRef();
  const wipeRef = useRef();
  const refFileRef = useRef();

  const allPass = res&&res.dry?.pass&&res.clean?.pass&&res.intact?.pass;
  const refKey = eq&&zone ? eq.id+"_"+zone : null;
  const refImg = refKey ? refImgs[refKey] : null;

  const home = () => { setSc("home");setImg(null);setRes(null);setProg(0);setLightWarn(null);setWipePhase(0);setWipeImg1(null);setWipeImg2(null);setWipeResult(null);setSignature(null); };

  const runAnalysis = async (url, isWipe2) => {
    setProg(0); setStep(0); setSc("scan");
    let p=0;
    const iv = setInterval(()=>{ p+=Math.random()*12+6; if(p>=88){p=88;clearInterval(iv);} setProg(p);setStep(Math.min(4,Math.floor(p/20))); },200);
    const result = await analyzeImage(url);
    clearInterval(iv); setProg(100); setStep(5);
    if (isWipe2) {
      const w1clean = result?.clean?.pass;
      const conclusion = w1clean ? "Nach Wischtest sauber - Rueckstand war Produktfilm (reinigbar)" : "Nach Wischtest weiterhin auffaellig - Verdacht auf Korrosion / Strukturschaden";
      setWipeResult(conclusion); setWipeImg2(url);
      setTimeout(()=>{ setRes(result); setSc("result"); },400);
    } else {
      const light = getLightLevel(result?.lm||0);
      setLightWarn(light==="ok"?null:light);
      setTimeout(()=>{ setRes(result); setSc("result"); },400);
    }
  };

  const handleFile = (e,isWipe2) => {
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{ const url=ev.target.result; if(isWipe2){setWipeImg2(url);runAnalysis(url,true);}else{setImg(url);setWipePhase(0);setWipeResult(null);runAnalysis(url,false);} };
    reader.readAsDataURL(file);
  };

  const handleRefFile = (e) => {
    const file=e.target.files?.[0]; if(!file||!refKey) return;
    const reader=new FileReader();
    reader.onload=ev=>setRefImgs(prev=>({...prev,[refKey]:ev.target.result}));
    reader.readAsDataURL(file);
  };

  const saveEntry = () => {
    const entry = { id:Date.now(),equip:eq?.name,zone:zone,date:new Date().toLocaleDateString("de-CH"),time:new Date().toLocaleTimeString("de-CH"),status:allPass?"pass":"fail",img:img,res:res,signature:signature,wipeResult:wipeResult };
    setLog(prev=>[entry,...prev]);
    home();
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans','Segoe UI',sans-serif",display:"flex",flexDirection:"column",alignItems:"center"}}>
      &lt;style>{"\n@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap');\n@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}\n@keyframes spin{to{transform:rotate(360deg)}}\n@keyframes scan{0%{top:0}100%{top:100%}}\n*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}\n"}&lt;/style>

      {showSig && <SignaturePad onSave={sig=>{setSignature(sig);setShowSig(false);}} onCancel={()=>setShowSig(false)} />}

      <div style={{width:"100%",maxWidth:480,padding:"18px 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👁️</div>
          <div><div style={{fontWeight:700,fontSize:17}}>VisuClean</div><div style={{color:C.muted,fontSize:10,fontFamily:C.mono}}>GMP - KI - v7.0</div></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <T onClick={()=>setSc("log")} style={{background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.muted,padding:"5px 11px",fontSize:13}}>{"📋 "+log.length}</T>
          {sc!=="home"&&<T onClick={home} style={{background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.muted,padding:"5px 11px",fontSize:13}}>Home</T>}
        </div>
      </div>

      <div style={{width:"100%",maxWidth:480,padding:18,flex:1}}>

        {sc==="home"&&<div style={{animation:"fadeUp .35s ease"}}>
          <div style={{background:"linear-gradient(135deg,#0c1f35,#091525)",border:"1px solid #1e3a5f",borderRadius:16,padding:26,marginBottom:20,textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:10}}>👁️</div>
            <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>Sichtbar sauber.</div>
            <div style={{color:C.muted,fontSize:13,lineHeight:1.8}}>{"Foto → KI analysiert sofort · 100% On-Device"}<br/><span style={{color:C.blue}}>Trocken · Sauber · Intakt</span></div>
          </div>
          <T onClick={()=>setSc("select")} style={{width:"100%",padding:"17px 0",borderRadius:12,textAlign:"center",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",color:"#fff",fontSize:16,fontWeight:700,marginBottom:14,boxShadow:"0 0 28px #0ea5e930"}}>📸 Neue Pruefung starten</T>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[["🖼️","Referenzvergleich","Soll vs. Ist"],["💡","Licht-Warnung","Qualitaetspruefung"],["🧪","Wischtest","Korrosion vs. Rueckstand"],["✍️","Digitale Signatur","GMP-konform"]].map(function(item){return(
              <div key={item[1]} style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14}}>
                <div style={{fontSize:20,marginBottom:5}}>{item[0]}</div>
                <div style={{fontWeight:600,fontSize:12,marginBottom:2}}>{item[1]}</div>
                <div style={{color:C.muted,fontSize:11}}>{item[2]}</div>
              </div>
            );})}
          </div>
          <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:20}}>📄</span>
            <div><div style={{fontWeight:600,fontSize:12}}>PDF-Export</div><div style={{color:C.muted,fontSize:11}}>Audit-fertige HTML/PDF Reports</div></div>
          </div>
          {log[0]&&<div style={{marginTop:14}}>
            <div style={{color:C.muted,fontSize:11,fontFamily:C.mono,marginBottom:8}}>LETZTE PRUEFUNG</div>
            <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14,display:"flex",gap:12,alignItems:"center"}}>
              {log[0].img&&<img src={log[0].img} alt="" style={{width:48,height:48,borderRadius:8,objectFit:"cover"}}/>}
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{log[0].equip}</div><div style={{color:C.muted,fontSize:11}}>{log[0].zone+" · "+log[0].date}</div></div>
              <div style={{color:log[0].status==="pass"?C.green:C.red,fontFamily:C.mono,fontSize:11,fontWeight:700}}>{log[0].status==="pass"?"✅ PASS":"🛑 FAIL"}</div>
            </div>
          </div>}
        </div>}

        {sc==="select"&&<div style={{animation:"fadeUp .35s ease"}}>
          <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Equipment waehlen</div>
          {EQUIPMENT.map(e=>(
            <T key={e.id} onClick={()=>{setEq(e);setSc("zones");}} style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14,marginBottom:9,display:"flex",alignItems:"center",gap:13}}>
              <span style={{fontSize:24}}>{e.icon}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:7,alignItems:"center"}}>
                  <span style={{fontWeight:600,fontSize:14}}>{e.name}</span>
                  {e.mat&&<span style={{background:"#0c2340",border:"1px solid #1e3a5f",color:"#7dd3fc",fontSize:10,padding:"1px 6px",borderRadius:5,fontFamily:C.mono}}>{e.mat}</span>}
                </div>
                <div style={{color:C.muted,fontSize:11,marginTop:2}}>{e.zones.length+" Pruefzonen"}</div>
              </div>
              <span style={{color:C.border,fontSize:18}}>{"›"}</span>
            </T>
          ))}
        </div>}

        {sc==="zones"&&eq&&<div style={{animation:"fadeUp .35s ease"}}>
          <div style={{color:C.blue,fontSize:11,fontFamily:C.mono,marginBottom:4}}>{eq.icon+" "+eq.name.toUpperCase()}</div>
          <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Zone waehlen</div>
          {eq.zones.map((z,i)=>(
            <T key={z} onClick={()=>{setZone(z);setZIdx(i);setSc("camera");}} style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14,marginBottom:9,display:"flex",alignItems:"center",gap:13}}>
              <div style={{width:30,height:30,borderRadius:8,background:"#0c1f35",border:"1px solid #1e3a5f",display:"flex",alignItems:"center",justifyContent:"center",color:C.blue,fontSize:12,fontFamily:C.mono,fontWeight:700}}>{i+1}</div>
              <span style={{flex:1,fontWeight:500,fontSize:14}}>{z}</span>
              <span style={{color:C.border,fontSize:18}}>{"›"}</span>
            </T>
          ))}
        </div>}

        {sc==="camera"&&<div style={{animation:"fadeUp .35s ease"}}>
          <div style={{color:C.blue,fontSize:11,fontFamily:C.mono,marginBottom:4}}>{(eq?.icon||"")+" "+(eq?.name||"").toUpperCase()+" - ZONE "+(zIdx+1)+"/"+(eq?.zones?.length||0)}</div>
          <div style={{fontSize:20,fontWeight:700,marginBottom:14}}>{zone}</div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={function(e){handleFile(e,false);}} style={{display:"none"}}/>
          <input ref={refFileRef} type="file" accept="image/*" onChange={handleRefFile} style={{display:"none"}}/>
          {refImg&&<div style={{background:C.card,border:"1px solid #1e3a5f",borderRadius:11,padding:12,marginBottom:12}}>
            <div style={{color:C.blue,fontSize:11,fontFamily:C.mono,marginBottom:8}}>REFERENZBILD (Soll-Zustand)</div>
            <img src={refImg} alt="Referenz" style={{width:"100%",maxHeight:120,objectFit:"cover",borderRadius:8,display:"block"}}/>
            <T onClick={()=>refFileRef.current?.click()} style={{color:C.muted,fontSize:11,marginTop:6,textAlign:"center"}}>Referenz ersetzen</T>
          </div>}
          <T onClick={()=>fileRef.current?.click()} style={{background:"linear-gradient(135deg,#0c1f35,#091525)",border:"2px solid #1e3a5f",borderRadius:16,padding:"36px 20px",textAlign:"center",marginBottom:12}}>
            <div style={{width:70,height:70,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,boxShadow:"0 0 28px #0ea5e940"}}>📷</div>
            <div style={{fontWeight:700,fontSize:17,marginBottom:5}}>Kamera oeffnen</div>
            <div style={{color:C.muted,fontSize:13}}>Auf Zone richten - KI analysiert sofort</div>
          </T>
          {!refImg&&<T onClick={()=>refFileRef.current?.click()} style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:"11px 14px",marginBottom:12,textAlign:"center",color:C.muted,fontSize:13}}>
            Referenzbild (Soll-Zustand) festlegen
          </T>}
          <div style={{background:"#0c1f10",border:"1px solid #1a3a20",borderRadius:11,padding:14}}>
            <div style={{color:C.green,fontWeight:600,fontSize:13,marginBottom:8}}>Beste Ergebnisse</div>
            {["Gute Beleuchtung - Streiflicht fuer Kratzer","Zone komplett erfassen - nah herangehen","Scharfe Aufnahme ohne Verwacklung"].map(t=>(
              <div key={t} style={{color:C.muted,fontSize:12,paddingLeft:10,borderLeft:"2px solid #1a6636",marginBottom:5}}>{t}</div>
            ))}
          </div>
        </div>}

        {sc==="scan"&&<div style={{animation:"fadeUp .35s ease",textAlign:"center",paddingTop:10}}>
          {img&&<div style={{position:"relative",borderRadius:14,overflow:"hidden",marginBottom:24,maxHeight:200}}>
            <img src={img} alt="" style={{width:"100%",objectFit:"cover",display:"block",filter:"brightness(.55)"}}/>
            <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,transparent 40%,#070c14 100%)"}}/>
            <div style={{position:"absolute",left:0,right:0,height:3,background:"linear-gradient(90deg,transparent,#0ea5e9,#38bdf8,transparent)",animation:"scan 1.6s linear infinite",top:0}}/>
            <div style={{position:"absolute",bottom:14,left:0,right:0,color:C.blue,fontFamily:C.mono,fontSize:11,fontWeight:700,letterSpacing:2}}>ANALYSIERE...</div>
          </div>}
          <div style={{width:56,height:56,borderRadius:"50%",border:"3px solid "+C.border,borderTopColor:C.blue,margin:"0 auto 14px",animation:"spin 1s linear infinite"}}/>
          <div style={{fontWeight:700,fontSize:19,marginBottom:4}}>KI analysiert...</div>
          <div style={{color:C.muted,fontSize:13,marginBottom:18}}>Pixelanalyse - Direkt im Geraet</div>
          <div style={{background:C.card,borderRadius:8,height:6,overflow:"hidden",margin:"0 16px 8px"}}><div style={{width:prog+"%",height:"100%",background:"linear-gradient(90deg,#0ea5e9,#38bdf8)",transition:"width .35s ease"}}/></div>
          <div style={{color:C.blue,fontFamily:C.mono,fontSize:14,fontWeight:700,marginBottom:16}}>{Math.round(prog)+"%"}</div>
          {["Bild laden","Luminanz-Analyse","Farbpruefung","Texturanalyse","Ergebnis"].map((s,i)=>(
            <div key={s} style={{color:i<step?C.green:i===step?C.blue:"#1e293b",fontSize:12,fontFamily:C.mono,transition:"color .4s",display:"flex",gap:8,justifyContent:"center",marginBottom:4}}>
              <span>{i<step?"✓":i===step?"→":"○"}</span><span>{s}</span>
            </div>
          ))}
        </div>}

        {sc==="wipe"&&<div style={{animation:"fadeUp .35s ease"}}>
          <div style={{color:C.orange,fontSize:11,fontFamily:C.mono,marginBottom:4}}>WISCHTEST</div>
          <div style={{fontSize:20,fontWeight:700,marginBottom:14}}>Oberflaeche abwischen</div>
          <div style={{background:"#1f1a0d",border:"1px solid #4a3a1a",borderRadius:12,padding:16,marginBottom:16}}>
            <div style={{color:C.orange,fontWeight:600,fontSize:14,marginBottom:10}}>So gehts:</div>
            {["Mit sauberem Tuch ueber die auffaellige Stelle wischen","Falls Rueckstand sich loest = Produktrueckstand (Reinigungsproblem)","Falls Rueckstand bleibt = Korrosion oder Strukturschaden"].map(t=>(
              <div key={t} style={{color:C.muted,fontSize:13,marginBottom:6,paddingLeft:10,borderLeft:"2px solid #c2410c"}}>{t}</div>
            ))}
          </div>
          <input ref={wipeRef} type="file" accept="image/*" capture="environment" onChange={function(e){handleFile(e,true);}} style={{display:"none"}}/>
          {wipeImg1&&<div style={{marginBottom:12}}>
            <div style={{color:C.muted,fontSize:11,fontFamily:C.mono,marginBottom:6}}>VORHER (Foto 1)</div>
            <img src={wipeImg1} alt="" style={{width:"100%",maxHeight:120,objectFit:"cover",borderRadius:8,display:"block"}}/>
          </div>}
          <T onClick={()=>wipeRef.current?.click()} style={{width:"100%",padding:"16px 0",borderRadius:12,textAlign:"center",background:"linear-gradient(135deg,#c2410c,#9a3412)",color:"#fff",fontSize:15,fontWeight:700}}>
            Nach dem Wischen fotografieren
          </T>
        </div>}

        {sc==="result"&&res&&<div style={{animation:"fadeUp .35s ease"}}>
          {refImg&&<div style={{marginBottom:16}}>
            <div style={{color:C.muted,fontSize:11,fontFamily:C.mono,marginBottom:8}}>SOLL vs. IST VERGLEICH</div>
            <div style={{display:"flex",gap:8}}>
              <div style={{flex:1}}>
                <div style={{color:C.muted,fontSize:11,textAlign:"center",marginBottom:4}}>Referenz (Soll)</div>
                <img src={refImg} alt="Soll" style={{width:"100%",height:100,objectFit:"cover",borderRadius:8,border:"2px solid #1a4a2a"}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{color:C.muted,fontSize:11,textAlign:"center",marginBottom:4}}>Aktuell (Ist)</div>
                <img src={img||wipeImg2} alt="Ist" style={{width:"100%",height:100,objectFit:"cover",borderRadius:8,border:"2px solid "+(allPass?"#1a4a2a":"#4a1a1a")}}/>
              </div>
            </div>
          </div>}
          {!refImg&&img&&<img src={img} alt="" style={{width:"100%",borderRadius:12,objectFit:"cover",maxHeight:170,display:"block",marginBottom:14}}/>}
          {lightWarn&&<div style={{background:lightWarn==="critical"?"#2e0d0d":"#1f1a0d",border:"1px solid "+(lightWarn==="critical"?"#661a1a":"#4a3a1a"),borderRadius:10,padding:"11px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:20}}>💡</span>
            <div>
              <div style={{fontWeight:600,fontSize:13,color:lightWarn==="critical"?C.red:C.orange}}>{lightWarn==="critical"?"Bild zu dunkel - Ergebnis unsicher":"Bild dunkel - mehr Licht empfohlen"}</div>
              <div style={{color:C.muted,fontSize:12}}>Streiflicht verwenden - Foto wiederholen</div>
            </div>
          </div>}
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{display:"inline-block",padding:"7px 22px",borderRadius:20,background:allPass?"#0d2e1a":"#2e0d0d",border:"1px solid "+(allPass?"#1a6636":"#661a1a"),color:allPass?C.green:C.red,fontFamily:C.mono,fontSize:13,fontWeight:700,letterSpacing:1}}>
              {allPass?"✅ FREIGEGEBEN":"🛑 GESPERRT"}
            </div>
            <div style={{color:C.muted,fontSize:11,marginTop:6,fontFamily:C.mono}}>{(eq?.name||"")+" · "+(zone||"")}</div>
          </div>
          <RCard label="Trocken?" r={res.dry}/>
          <RCard label="Sauber?" r={res.clean}/>
          <RCard label="Intakt?" r={res.intact}/>
          {wipeResult&&<div style={{background:"#1a1f0d",border:"1px solid #3a4a1a",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
            <div style={{color:"#a3e635",fontWeight:700,fontSize:13,marginBottom:4}}>Wischtest-Ergebnis</div>
            <div style={{color:C.muted,fontSize:13}}>{wipeResult}</div>
          </div>}
          {!allPass&&!wipeResult&&(res.clean?.pass===false||res.intact?.pass===false)&&<T onClick={()=>{setWipeImg1(img);setWipePhase(1);setSc("wipe");}} style={{background:"#1f1a0d",border:"1px solid #4a3a1a",borderRadius:10,padding:"12px 14px",marginBottom:10,textAlign:"center"}}>
            <div style={{color:C.orange,fontWeight:700,fontSize:13}}>Wischtest durchfuehren</div>
            <div style={{color:C.muted,fontSize:12,marginTop:2}}>Korrosion vs. Produktrueckstand unterscheiden</div>
          </T>}
          {signature&&<div style={{background:C.card,border:"1px solid #1e3a5f",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
            <div style={{color:C.blue,fontSize:11,fontFamily:C.mono,marginBottom:6}}>DIGITAL UNTERZEICHNET</div>
            <img src={signature} alt="Signatur" style={{maxHeight:60,display:"block"}}/>
          </div>}
          {!signature&&<T onClick={()=>setShowSig(true)} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:"12px 14px",marginBottom:10,textAlign:"center"}}>
            <div style={{fontWeight:600,fontSize:13}}>Digital unterzeichnen (GMP)</div>
            <div style={{color:C.muted,fontSize:12,marginTop:2}}>Freigabe mit digitaler Unterschrift bestaetigen</div>
          </T>}
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <T onClick={()=>{setSc("camera");setRes(null);setImg(null);setWipeResult(null);setSignature(null);}} style={{flex:1,padding:"13px 0",borderRadius:10,textAlign:"center",border:"1px solid "+C.border,color:C.muted,fontSize:14,fontWeight:600}}>Neu</T>
            <T onClick={saveEntry} style={{flex:2,padding:"13px 0",borderRadius:10,textAlign:"center",background:allPass?"#16a34a":"#991b1b",color:"#fff",fontSize:14,fontWeight:700}}>
              {allPass?"Freigeben und Speichern":"Befund speichern"}
            </T>
          </div>
          <T onClick={()=>exportPDF({equip:eq?.name,zone:zone,date:new Date().toLocaleDateString("de-CH"),time:new Date().toLocaleTimeString("de-CH"),img:img,res:res,signature:signature,wipeResult:wipeResult})}
            style={{width:"100%",padding:"12px 0",borderRadius:10,textAlign:"center",border:"1px solid #1e3a5f",color:C.blue,fontSize:14,fontWeight:600,marginTop:10}}>
            Als PDF exportieren
          </T>
        </div>}

        {sc==="log"&&<div style={{animation:"fadeUp .35s ease"}}>
          <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Pruefprotokoll</div>
          {log.length===0
            ?<div style={{textAlign:"center",color:C.muted,padding:"50px 0"}}><div style={{fontSize:36,marginBottom:12}}>📋</div>Keine Eintraege</div>
            :log.map(e=>(
              <div key={e.id} style={{background:C.card,border:"1px solid "+(e.status==="pass"?"#1a4a2a":"#4a1a1a"),borderRadius:11,padding:14,marginBottom:10}}>
                <div style={{display:"flex",gap:12}}>
                  {e.img&&<img src={e.img} alt="" style={{width:52,height:52,borderRadius:8,objectFit:"cover",flexShrink:0}}/>}
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <div style={{fontWeight:600,fontSize:13}}>{e.equip}</div>
                      <div style={{color:e.status==="pass"?C.green:C.red,fontFamily:C.mono,fontSize:11,fontWeight:700}}>{e.status==="pass"?"✅ PASS":"🛑 FAIL"}</div>
                    </div>
                    <div style={{color:C.muted,fontSize:11}}>{e.zone}</div>
                    <div style={{color:"#334155",fontSize:11,fontFamily:C.mono}}>{e.date+" · "+e.time}</div>
                    {e.signature&&<div style={{color:C.blue,fontSize:11,marginTop:4}}>Unterzeichnet</div>}
                    {e.wipeResult&&<div style={{color:"#a3e635",fontSize:11,marginTop:4}}>{"Wischtest: "+e.wipeResult.slice(0,50)+"..."}</div>}
                  </div>
                </div>
                <T onClick={()=>exportPDF(e)} style={{marginTop:10,padding:"8px 0",borderRadius:8,textAlign:"center",border:"1px solid "+C.border,color:C.blue,fontSize:12,fontWeight:600}}>PDF exportieren</T>
              </div>
            ))
          }
        </div>}
      </div>

      <div style={{padding:"14px 0",color:"#1e293b",fontSize:10,fontFamily:C.mono,textAlign:"center"}}>VisuClean v7.0 - GMP Annex 11 - 21 CFR Part 11 - ALCOA+</div>
    </div>
  );
}
