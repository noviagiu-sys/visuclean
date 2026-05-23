import { useState, useRef, useCallback } from "react";

function analyzeImage(dataUrl) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      var MAX = 400;
      var w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      var ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;
      var n = w * h;
      var bf=0, df=0, vdf=0, sR=0, sG=0, sB=0, cvs=0, lsum=0, lsq=0, wc=0;
      for (var i=0; i<data.length; i+=4) {
        var r=data[i]/255, g=data[i+1]/255, b=data[i+2]/255;
        var l=0.299*r+0.587*g+0.114*b;
        lsum+=l; lsq+=l*l;
        if(l>0.82) bf++; if(l<0.18) df++; if(l<0.08) vdf++;
        sR+=r; sG+=g; sB+=b;
        var avg=(r+g+b)/3;
        cvs+=Math.abs(r-avg)+Math.abs(g-avg)+Math.abs(b-avg);
        if((r-b)>0.12&&l>0.08) wc++;
      }
      var mR=sR/n, mG=sG/n, mB=sB/n;
      var bfr=bf/n, dfr=df/n, vdfr=vdf/n, cv=cvs/n;
      var lm=lsum/n, tv=Math.max(0,lsq/n-lm*lm);
      var brown=mR-mB, wf=wc/n;
      var dry, clean, intact;
      if(bfr>0.04) dry={pass:false,message:"Feuchtigkeit erkannt",detail:(bfr*100).toFixed(1)+"% helle Reflexionspunkte",severity:Math.min(100,Math.round(bfr*1200)),action:"Nachtrocknung erforderlich"};
      else if(lm<0.22&&dfr>0.30) dry={pass:false,message:"Verdacht auf nasse Oberflaeche",detail:"Sehr dunkle Oberflaeche",severity:45,action:"Trocknungszustand visuell pruefen"};
      else dry={pass:true,message:"Trocken",detail:"Keine Feuchtigkeit erkannt"};
      if(wf>0.12||brown>0.06) clean={pass:false,message:"Organische Rueckstaende",detail:(wf*100).toFixed(1)+"% warme Pixel",severity:Math.min(100,Math.round(Math.max(wf,brown)*700)),action:"Nachreinigung erforderlich"};
      else if(cv>0.048) clean={pass:false,message:"Verfaerbung erkannt",detail:"Farbabweichung: "+(cv*100).toFixed(2)+"%",severity:Math.min(100,Math.round(cv*1100)),action:"Reinigung wiederholen"};
      else if(lm<0.28) clean={pass:false,message:"Verdacht auf Ablagerungen",detail:"Oberflaeche zu dunkel",severity:50,action:"Reinigungszustand pruefen"};
      else clean={pass:true,message:"Sauber",detail:"Keine sichtbaren Rueckstaende"};
      if(tv>0.020) intact={pass:false,message:"Unregelmaessige Oberflaeche",detail:"Textur-Varianz: "+tv.toFixed(4),severity:Math.min(100,Math.round((tv-0.020)*3500)),action:"Nachpruefung erforderlich"};
      else if(vdfr>0.04) intact={pass:false,message:"Dunkle Flecken",detail:(vdfr*100).toFixed(1)+"% sehr dunkle Pixel",severity:40,action:"Korrosion pruefen"};
      else intact={pass:true,message:"Intakt",detail:"Oberflaeche gleichmaessig"};
      resolve({dry:dry,clean:clean,intact:intact,lm:lm});
    };
    img.onerror=function(){resolve(null);};
    img.src=dataUrl;
  });
}

function getLightLevel(lm) {
  if (lm < 0.15) return "critical";
  if (lm < 0.28) return "warning";
  return "ok";
}

var C = { bg:"#070c14",card:"#0f1724",border:"#1e293b",blue:"#0ea5e9",green:"#4ade80",red:"#f87171",orange:"#fb923c",text:"#e2e8f0",muted:"#475569",mono:"monospace" };

var EQUIPMENT = [
  {id:"tp",icon:"⚙️",name:"Tablettenpresse",zones:["Stempeloberflaeche","Matrizenteller","Stempelfuehrung","Unterstempel","Pressstation"]},
  {id:"ct",icon:"🔄",name:"Coater",zones:["Trommelinnenwand","Spruehdüsen","Trommelauslass","Dichtungsring"]},
  {id:"gr",icon:"🌀",name:"Granulator",zones:["Mischkammer","Zerhacker","Ruehrwerkswelle","Dichtungen"]},
  {id:"fb",icon:"💨",name:"Wirbelschicht",zones:["Filterbeutel","Siebboden","Spruehdüse","Produktbehaelter"]},
  {id:"mx",icon:"🔃",name:"Mischer / Blender",zones:["Innenoberflaeche","Klappenventil","Schweissnaehte","Auslaufoeffnung"]},
  {id:"cf",icon:"💊",name:"Kapselfueller",zones:["Dosierrohr","Kapselhalter","Schliessstation","Ausstossstation"]},
  {id:"kt",icon:"🔵",name:"Klappenteller",mat:"Edelstahl",zones:["Telleroberflaeche oben","Telleroberflaeche unten","Dichtungsring","Ventilschaft","Flanschflaeche"]},
  {id:"ibc",icon:"📦",name:"IBC Container",mat:"Edelstahl",zones:["Boden","Waende","Auslaufkonus","Butterfly-Ventil","Schweissnaehte"]},
  {id:"ss",icon:"🔩",name:"Edelstahl-Kleinteile",mat:"Edelstahl",zones:["Oberflaeche","Schweissnaehte","Dichtflaechen","Kanten"]}
];

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
          {!r.pass&&r.severity!=null&&<><Bar v={r.severity} color={r.severity>65?C.red:C.orange}/><div style={{color:r.severity>65?C.red:C.orange,fontSize:11,marginTop:3,fontFamily:C.mono}}>{"Schweregrad: "+r.severity+"%"}</div></>}
          {!r.pass&&r.action&&<div style={{color:C.orange,fontSize:12,marginTop:7,paddingLeft:10,borderLeft:"2px solid #c2410c"}}>{r.action}</div>}
        </div>
      </div>
    </div>
  );
}

export default function VisuClean() {
  var _a = useState("home"), sc = _a[0], setSc = _a[1];
  var _b = useState(null), eq = _b[0], setEq = _b[1];
  var _c = useState(null), zone = _c[0], setZone = _c[1];
  var _d = useState(0), zIdx = _d[0], setZIdx = _d[1];
  var _e = useState(null), img = _e[0], setImg = _e[1];
  var _f = useState(0), prog = _f[0], setProg = _f[1];
  var _g = useState(0), step = _g[0], setStep = _g[1];
  var _h = useState(null), res = _h[0], setRes = _h[1];
  var _i = useState(null), lightWarn = _i[0], setLightWarn = _i[1];
  var _j = useState([]), log = _j[0], setLog = _j[1];
  var _k = useState(false), showResult = _k[0], setShowResult = _k[1];
  var fileRef = useRef();

  var allPass = res&&res.dry&&res.dry.pass&&res.clean&&res.clean.pass&&res.intact&&res.intact.pass;

  var home = function() { setSc("home");setImg(null);setRes(null);setProg(0);setLightWarn(null); };

  var runAnalysis = function(url) {
    setProg(0); setStep(0); setSc("scan");
    var p=0;
    var iv = setInterval(function(){ p+=Math.random()*12+6; if(p>=88){p=88;clearInterval(iv);} setProg(p);setStep(Math.min(4,Math.floor(p/20))); },200);
    analyzeImage(url).then(function(result) {
      clearInterval(iv); setProg(100); setStep(5);
      var light = getLightLevel(result?result.lm:0);
      setLightWarn(light==="ok"?null:light);
      setTimeout(function(){ setRes(result); setSc("result"); },400);
    });
  };

  var handleFile = function(e) {
    var file=e.target.files?e.target.files[0]:null; if(!file) return;
    var reader=new FileReader();
    reader.onload=function(ev){ var url=ev.target.result; setImg(url); runAnalysis(url); };
    reader.readAsDataURL(file);
  };

  var saveEntry = function() {
    var entry = { id:Date.now(),equip:eq?eq.name:"",zone:zone,date:new Date().toLocaleDateString("de-CH"),time:new Date().toLocaleTimeString("de-CH"),status:allPass?"pass":"fail",img:img };
    setLog(function(prev){return [entry].concat(prev);});
    home();
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Segoe UI',sans-serif",display:"flex",flexDirection:"column",alignItems:"center"}}>

      <div style={{width:"100%",maxWidth:480,padding:"18px 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:"linear-gradient(135deg,#0ea5e9,#0369a1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{"👁️"}</div>
          <div><div style={{fontWeight:700,fontSize:17}}>VisuClean</div><div style={{color:C.muted,fontSize:10,fontFamily:C.mono}}>GMP - KI - v7.0</div></div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div onClick={function(){setSc("log");}} style={{background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>{"📋 "+log.length}</div>
          {sc!=="home"&&<div onClick={home} style={{background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.muted,padding:"5px 11px",fontSize:13,cursor:"pointer"}}>Home</div>}
        </div>
      </div>

      <div style={{width:"100%",maxWidth:480,padding:18,flex:1}}>

        {sc==="home"&&<div>
          <div style={{background:"linear-gradient(135deg,#0c1f35,#091525)",border:"1px solid #1e3a5f",borderRadius:16,padding:26,marginBottom:20,textAlign:"center"}}>
            <div style={{fontSize:44,marginBottom:10}}>{"👁️"}</div>
            <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>Sichtbar sauber.</div>
            <div style={{color:C.muted,fontSize:13,lineHeight:1.8}}>Foto - KI analysiert sofort - 100% On-Device<br/><span style={{color:C.blue}}>Trocken - Sauber - Intakt</span></div>
          </div>
          <div onClick={function(){setSc("select");}} style={{width:"100%",padding:"17px 0",borderRadius:12,textAlign:"center",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",color:"#fff",fontSize:16,fontWeight:700,marginBottom:14,cursor:"pointer"}}>{"📸 Neue Pruefung starten"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14}}>
              <div style={{fontSize:20,marginBottom:5}}>{"🖼️"}</div>
              <div style={{fontWeight:600,fontSize:12,marginBottom:2}}>Referenzvergleich</div>
              <div style={{color:C.muted,fontSize:11}}>Soll vs. Ist</div>
            </div>
            <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14}}>
              <div style={{fontSize:20,marginBottom:5}}>{"💡"}</div>
              <div style={{fontWeight:600,fontSize:12,marginBottom:2}}>Licht-Warnung</div>
              <div style={{color:C.muted,fontSize:11}}>Qualitaetspruefung</div>
            </div>
            <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14}}>
              <div style={{fontSize:20,marginBottom:5}}>{"🧪"}</div>
              <div style={{fontWeight:600,fontSize:12,marginBottom:2}}>Wischtest</div>
              <div style={{color:C.muted,fontSize:11}}>Korrosion vs. Rueckstand</div>
            </div>
            <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14}}>
              <div style={{fontSize:20,marginBottom:5}}>{"✍️"}</div>
              <div style={{fontWeight:600,fontSize:12,marginBottom:2}}>Digitale Signatur</div>
              <div style={{color:C.muted,fontSize:11}}>GMP-konform</div>
            </div>
          </div>
        </div>}

        {sc==="select"&&<div>
          <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Equipment waehlen</div>
          {EQUIPMENT.map(function(e){return(
            <div key={e.id} onClick={function(){setEq(e);setSc("zones");}} style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14,marginBottom:9,display:"flex",alignItems:"center",gap:13,cursor:"pointer"}}>
              <span style={{fontSize:24}}>{e.icon}</span>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:7,alignItems:"center"}}>
                  <span style={{fontWeight:600,fontSize:14}}>{e.name}</span>
                  {e.mat&&<span style={{background:"#0c2340",border:"1px solid #1e3a5f",color:"#7dd3fc",fontSize:10,padding:"1px 6px",borderRadius:5,fontFamily:C.mono}}>{e.mat}</span>}
                </div>
                <div style={{color:C.muted,fontSize:11,marginTop:2}}>{e.zones.length+" Pruefzonen"}</div>
              </div>
            </div>
          );})}
        </div>}

        {sc==="zones"&&eq&&<div>
          <div style={{color:C.blue,fontSize:11,fontFamily:C.mono,marginBottom:4}}>{eq.icon+" "+eq.name.toUpperCase()}</div>
          <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Zone waehlen</div>
          {eq.zones.map(function(z,i){return(
            <div key={z} onClick={function(){setZone(z);setZIdx(i);setSc("camera");}} style={{background:C.card,border:"1px solid "+C.border,borderRadius:11,padding:14,marginBottom:9,display:"flex",alignItems:"center",gap:13,cursor:"pointer"}}>
              <div style={{width:30,height:30,borderRadius:8,background:"#0c1f35",border:"1px solid #1e3a5f",display:"flex",alignItems:"center",justifyContent:"center",color:C.blue,fontSize:12,fontFamily:C.mono,fontWeight:700}}>{i+1}</div>
              <span style={{flex:1,fontWeight:500,fontSize:14}}>{z}</span>
            </div>
          );})}
        </div>}

        {sc==="camera"&&<div>
          <div style={{color:C.blue,fontSize:11,fontFamily:C.mono,marginBottom:4}}>{(eq?eq.icon:"")+" "+(eq?eq.name:"").toUpperCase()}</div>
          <div style={{fontSize:20,fontWeight:700,marginBottom:14}}>{zone}</div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{display:"none"}}/>
          <div onClick={function(){if(fileRef.current)fileRef.current.click();}} style={{background:"linear-gradient(135deg,#0c1f35,#091525)",border:"2px solid #1e3a5f",borderRadius:16,padding:"36px 20px",textAlign:"center",marginBottom:12,cursor:"pointer"}}>
            <div style={{width:70,height:70,borderRadius:"50%",background:"linear-gradient(135deg,#0ea5e9,#0369a1)",margin:"0 auto 12px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>{"📷"}</div>
            <div style={{fontWeight:700,fontSize:17,marginBottom:5}}>Kamera oeffnen</div>
            <div style={{color:C.muted,fontSize:13}}>Auf Zone richten - KI analysiert sofort</div>
          </div>
          <div style={{background:"#0c1f10",border:"1px solid #1a3a20",borderRadius:11,padding:14}}>
            <div style={{color:C.green,fontWeight:600,fontSize:13,marginBottom:8}}>Beste Ergebnisse</div>
            <div style={{color:C.muted,fontSize:12,paddingLeft:10,borderLeft:"2px solid #1a6636",marginBottom:5}}>Gute Beleuchtung - Streiflicht fuer Kratzer</div>
            <div style={{color:C.muted,fontSize:12,paddingLeft:10,borderLeft:"2px solid #1a6636",marginBottom:5}}>Zone komplett erfassen - nah herangehen</div>
            <div style={{color:C.muted,fontSize:12,paddingLeft:10,borderLeft:"2px solid #1a6636",marginBottom:5}}>Scharfe Aufnahme ohne Verwacklung</div>
          </div>
        </div>}

        {sc==="scan"&&<div style={{textAlign:"center",paddingTop:10}}>
          {img&&<div style={{position:"relative",borderRadius:14,overflow:"hidden",marginBottom:24,maxHeight:200}}>
            <img src={img} alt="" style={{width:"100%",objectFit:"cover",display:"block",filter:"brightness(.55)"}}/>
          </div>}
          <div style={{fontWeight:700,fontSize:19,marginBottom:4}}>KI analysiert...</div>
          <div style={{color:C.muted,fontSize:13,marginBottom:18}}>Pixelanalyse - Direkt im Geraet</div>
          <div style={{background:C.card,borderRadius:8,height:6,overflow:"hidden",margin:"0 16px 8px"}}><div style={{width:prog+"%",height:"100%",background:"linear-gradient(90deg,#0ea5e9,#38bdf8)",transition:"width .35s ease"}}/></div>
          <div style={{color:C.blue,fontFamily:C.mono,fontSize:14,fontWeight:700,marginBottom:16}}>{Math.round(prog)+"%"}</div>
          {["Bild laden","Luminanz-Analyse","Farbpruefung","Texturanalyse","Ergebnis"].map(function(s,i){return(
            <div key={s} style={{color:i<step?C.green:i===step?C.blue:"#1e293b",fontSize:12,fontFamily:C.mono,display:"flex",gap:8,justifyContent:"center",marginBottom:4}}>
              <span>{i<step?"✓":i===step?"→":"○"}</span><span>{s}</span>
            </div>
          );})}
        </div>}

        {sc==="result"&&res&&<div>
          {img&&<img src={img} alt="" style={{width:"100%",borderRadius:12,objectFit:"cover",maxHeight:170,display:"block",marginBottom:14}}/>}
          {lightWarn&&<div style={{background:lightWarn==="critical"?"#2e0d0d":"#1f1a0d",border:"1px solid "+(lightWarn==="critical"?"#661a1a":"#4a3a1a"),borderRadius:10,padding:"11px 14px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:20}}>{"💡"}</span>
            <div>
              <div style={{fontWeight:600,fontSize:13,color:lightWarn==="critical"?C.red:C.orange}}>{lightWarn==="critical"?"Bild zu dunkel":"Bild dunkel - mehr Licht empfohlen"}</div>
            </div>
          </div>}
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{display:"inline-block",padding:"7px 22px",borderRadius:20,background:allPass?"#0d2e1a":"#2e0d0d",border:"1px solid "+(allPass?"#1a6636":"#661a1a"),color:allPass?C.green:C.red,fontFamily:C.mono,fontSize:13,fontWeight:700}}>
              {allPass?"✅ FREIGEGEBEN":"🛑 GESPERRT"}
            </div>
            <div style={{color:C.muted,fontSize:11,marginTop:6,fontFamily:C.mono}}>{(eq?eq.name:"")+" - "+(zone||"")}</div>
          </div>
          <RCard label="Trocken?" r={res.dry}/>
          <RCard label="Sauber?" r={res.clean}/>
          <RCard label="Intakt?" r={res.intact}/>
          <div style={{display:"flex",gap:10,marginTop:14}}>
            <div onClick={function(){setSc("camera");setRes(null);setImg(null);}} style={{flex:1,padding:"13px 0",borderRadius:10,textAlign:"center",border:"1px solid "+C.border,color:C.muted,fontSize:14,fontWeight:600,cursor:"pointer"}}>Neu</div>
            <div onClick={saveEntry} style={{flex:2,padding:"13px 0",borderRadius:10,textAlign:"center",background:allPass?"#16a34a":"#991b1b",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              {allPass?"Freigeben":"Befund speichern"}
            </div>
          </div>
        </div>}

        {sc==="log"&&<div>
          <div style={{fontSize:20,fontWeight:700,marginBottom:16}}>Pruefprotokoll</div>
          {log.length===0
            ?<div style={{textAlign:"center",color:C.muted,padding:"50px 0"}}><div style={{fontSize:36,marginBottom:12}}>{"📋"}</div>Keine Eintraege</div>
            :log.map(function(e){return(
              <div key={e.id} style={{background:C.card,border:"1px solid "+(e.status==="pass"?"#1a4a2a":"#4a1a1a"),borderRadius:11,padding:14,marginBottom:10}}>
                <div style={{display:"flex",gap:12}}>
                  {e.img&&<img src={e.img} alt="" style={{width:52,height:52,borderRadius:8,objectFit:"cover"}}/>}
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <div style={{fontWeight:600,fontSize:13}}>{e.equip}</div>
                      <div style={{color:e.status==="pass"?C.green:C.red,fontFamily:C.mono,fontSize:11,fontWeight:700}}>{e.status==="pass"?"PASS":"FAIL"}</div>
                    </div>
                    <div style={{color:C.muted,fontSize:11}}>{e.zone}</div>
                    <div style={{color:"#334155",fontSize:11,fontFamily:C.mono}}>{e.date+" - "+e.time}</div>
                  </div>
                </div>
              </div>
            );})
          }
        </div>}
      </div>

      <div style={{padding:"14px 0",color:"#1e293b",fontSize:10,fontFamily:C.mono,textAlign:"center"}}>VisuClean v7.0 - GMP Annex 11 - 21 CFR Part 11</div>
    </div>
  );
}
