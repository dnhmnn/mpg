/**
 * responda – Web App UI Concept
 * Stack: React + Recharts
 */

import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, CartesianGrid,
} from "recharts";

// ─── Global Styles ───────────────────────────────────────────────
if (!document.getElementById("responda-styles")) {
  const link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,300;1,400;1,500;1,600&family=Sora:wght@300;400;500;600&display=swap";
  document.head.appendChild(link);

  const style = document.createElement("style");
  style.id = "responda-styles";
  style.textContent = `*{box-sizing:border-box;margin:0;padding:0} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#D4CBC0;border-radius:10px} @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fadeUp .42s cubic-bezier(.22,1,.36,1) both} .d1{animation-delay:.05s}.d2{animation-delay:.1s}.d3{animation-delay:.15s}.d4{animation-delay:.2s}.d5{animation-delay:.25s} .nav-btn{transition:all .18s ease;cursor:pointer;border:none;background:none;width:100%;text-align:left} .nav-btn:hover{background:rgba(123,13,30,.08)!important;border-radius:10px} .card-h{transition:transform .22s ease,box-shadow .22s ease} .card-h:hover{transform:translateY(-3px);box-shadow:0 18px 52px rgba(123,13,30,.11)!important} .row-h{transition:background .14s ease;cursor:pointer} .row-h:hover{background:#FAF7F3!important} .btn{transition:all .18s ease;cursor:pointer;border:none} .btn:hover{opacity:.84;transform:translateY(-1px)} input,select,textarea{outline:none;font-family:inherit} input:focus,select:focus{border-color:#7B0D1E!important;box-shadow:0 0 0 3px rgba(123,13,30,.08)!important} .tog{cursor:pointer;transition:background .2s ease} .av{transition:transform .2s ease;cursor:pointer} .av:hover{transform:scale(1.08)} .chip{cursor:pointer;transition:all .15s ease} .chip:hover{opacity:.75}`;
  document.head.appendChild(style);
}

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  cr:"#7B0D1E", crDk:"#520910", crMd:"#9E1426",
  crPale:"#FEF1F4", crBdr:"#F0D0D6",
  gold:"#B8895A", goldPale:"#F5ECE0",
  bg:"#F2EFE9", surf:"#FFFFFF", surfAlt:"#FAF8F4",
  tx:"#1B1714", txM:"#7A726A", txL:"#B5AFA8",
  bdr:"#E6E0D8", bdrL:"#EEE9E1",
  ok:"#2A7A50", okBg:"#EEF8F3",
  warn:"#9E5A1E", warnBg:"#FDF3E6",
  info:"#1C44A0", infoBg:"#EEF2FC",
};
const F = { d:'"Cormorant Garamond",Georgia,serif', b:'"Sora",system-ui,sans-serif' };

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const areaData = [
  {m:"Jan",erledigt:28,neu:34},{m:"Feb",erledigt:40,neu:29},
  {m:"Mär",erledigt:32,neu:45},{m:"Apr",erledigt:55,neu:38},
  {m:"Mai",erledigt:48,neu:52},{m:"Jun",erledigt:61,neu:44},
  {m:"Jul",erledigt:73,neu:60},
];
const barData = [
  {team:"Design",score:87},{team:"Dev",score:94},
  {team:"Marketing",score:71},{team:"Support",score:83},{team:"Sales",score:78},
];
const PROJECTS = [
  {id:1,name:"Website Redesign",status:"Aktiv",progress:68,members:4,due:"28. Mai",tag:"Design",color:C.cr},
  {id:2,name:"Mobile App v2",status:"Review",progress:89,members:3,due:"15. Jun",tag:"Entwicklung",color:C.info},
  {id:3,name:"API Integration",status:"Aktiv",progress:34,members:2,due:"3. Jul",tag:"Backend",color:C.gold},
  {id:4,name:"Brand Guidelines",status:"Planung",progress:12,members:5,due:"20. Jul",tag:"Marketing",color:C.ok},
  {id:5,name:"CRM Migration",status:"Pausiert",progress:51,members:3,due:"1. Aug",tag:"Ops",color:C.txM},
  {id:6,name:"Analytics Board",status:"Aktiv",progress:77,members:2,due:"10. Jun",tag:"Daten",color:C.crMd},
];
const TASKS = [
  {id:1,title:"Wireframes für Homepage finalisieren",proj:"Website Redesign",prio:"Hoch",due:"Heute",done:false},
  {id:2,title:"API Dokumentation prüfen",proj:"API Integration",prio:"Mittel",due:"Morgen",done:false},
  {id:3,title:"Nutzertests auswerten",proj:"Mobile App v2",prio:"Hoch",due:"Übermorgen",done:false},
  {id:4,title:"Sprint-Retro vorbereiten",proj:"Intern",prio:"Niedrig",due:"Fr, 17. Mai",done:true},
  {id:5,title:"Design-Review Meeting",proj:"Brand Guidelines",prio:"Mittel",due:"Mo, 20. Mai",done:false},
  {id:6,title:"Datenbankschema aktualisieren",proj:"CRM Migration",prio:"Hoch",due:"Di, 21. Mai",done:false},
  {id:7,title:"Onboarding-Mail Vorlage schreiben",proj:"Marketing",prio:"Niedrig",due:"Mi, 22. Mai",done:true},
];
const TEAM = [
  {name:"Lena Müller",role:"Designerin",status:"online",ini:"LM",color:C.cr},
  {name:"Jonas Fischer",role:"Entwickler",status:"online",ini:"JF",color:C.info},
  {name:"Sara Koch",role:"Projektleiterin",status:"abwesend",ini:"SK",color:C.ok},
  {name:"Max Weber",role:"Backend-Entwickler",status:"online",ini:"MW",color:C.gold},
  {name:"Tina Braun",role:"Marketing",status:"offline",ini:"TB",color:C.txM},
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
const statusStyle = (s: string) => {
  const map: Record<string, {bg:string;color:string;dot:string}> = {
    Aktiv:   {bg:C.okBg,    color:C.ok,   dot:C.ok},
    Review:  {bg:C.infoBg,  color:C.info, dot:C.info},
    Planung: {bg:C.goldPale,color:C.gold, dot:C.gold},
    Pausiert:{bg:C.surfAlt, color:C.txM,  dot:C.txL},
  };
  return map[s] || map.Pausiert;
};
const prioStyle = (p: string) => {
  const map: Record<string, {color:string;bg:string}> = {
    Hoch:   {color:C.cr,   bg:C.crPale},
    Mittel: {color:C.warn, bg:C.warnBg},
    Niedrig:{color:C.txM,  bg:C.surfAlt},
  };
  return map[p] || map.Niedrig;
};

// ─── Primitives ────────────────────────────────────────────────────────────────
const Divider = () => <div style={{height:1,background:C.bdrL,margin:"0 24px"}}/>;

const Badge = ({label, bg, color}: {label:string;bg:string;color:string}) => (
  <span style={{display:"inline-block",padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:500,letterSpacing:.3,background:bg,color,fontFamily:F.b}}>{label}</span>
);

const Avatar = ({ini, color, size=32, ring=false}: {ini:string;color:string;size?:number;ring?:boolean}) => (
  <div className={ring?"av":""} style={{width:size,height:size,borderRadius:"50%",background:`${color}22`,border:`2px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.35,fontWeight:600,color,fontFamily:F.b,flexShrink:0}}>{ini}</div>
);

const ProgressBar = ({value, color=C.cr, height=5}: {value:number;color?:string;height?:number}) => (
  <div style={{height,borderRadius:99,background:C.bdrL,overflow:"hidden",width:"100%"}}>
    <div style={{width:`${value}%`,height:"100%",borderRadius:99,background:`linear-gradient(90deg,${color}99,${color})`,transition:"width .4s ease"}}/>
  </div>
);

// ─── Logo ────────────────────────────────────────────────────────────────────────────
const RespondaLogo = ({size=38}: {size?:number}) => (
  <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="100" r="98" fill={C.cr}/>
    <circle cx="100" cy="100" r="92" fill="none" stroke="white" strokeWidth="3.5" opacity=".25"/>
    <path d="M80 38 Q100 26 120 38" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none"/>
    <path d="M65 85 Q75 45 100 38 Q125 45 135 85" fill="white"/>
    <path d="M72 83 Q80 50 100 44 Q120 50 128 83 L122 83 Q112 54 100 50 Q88 54 78 83Z" fill={C.cr}/>
    <rect x="65" y="83" width="70" height="9" rx="4.5" fill="white"/>
    <path d="M75 92 Q72 140 100 152 Q128 140 125 92Z" fill="white"/>
    <ellipse cx="113" cy="110" rx="4" ry="3" fill={C.cr}/>
    <path d="M112 118 L116 128 L109 128" stroke={C.cr} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <ellipse cx="78" cy="115" rx="5" ry="7" fill="white" stroke={C.cr} strokeWidth="1.5"/>
    <ellipse cx="100" cy="168" rx="14" ry="10" fill="white"/>
    <ellipse cx="95" cy="165" rx="2.5" ry="2" fill={C.cr}/>
    <ellipse cx="105" cy="165" rx="2.5" ry="2" fill={C.cr}/>
  </svg>
);

// ─── Sidebar ─────────────────────────────────────────────────────────────────────
const NAV = [
  {id:"dashboard",label:"Dashboard",   icon:"⊞"},
  {id:"projekte", label:"Projekte",    icon:"◫"},
  {id:"aufgaben", label:"Aufgaben",    icon:"✓"},
  {id:"analytics",label:"Analytics",  icon:"◈"},
  {id:"team",     label:"Team",        icon:"◎"},
  {id:"settings", label:"Einstellungen",icon:"◉"},
];

const NavItem = ({n, active, onClick}: {n:typeof NAV[0];active:boolean;onClick:()=>void}) => (
  <button className="nav-btn" onClick={onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,fontFamily:F.b,fontSize:13,fontWeight:active?500:400,color:active?C.cr:C.txM,background:active?C.crPale:"transparent"}}>
    <span style={{fontSize:15,opacity:active?1:.7}}>{n.icon}</span>
    {n.label}
    {active && <div style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:C.cr}}/>}
  </button>
);

const Sidebar = ({view, setView}: {view:string;setView:(v:string)=>void}) => (
  <div style={{width:220,height:"100vh",background:C.surf,borderRight:`1px solid ${C.bdr}`,display:"flex",flexDirection:"column",flexShrink:0,boxShadow:"2px 0 24px rgba(0,0,0,.04)"}}>
    <div style={{padding:"28px 22px 20px",display:"flex",alignItems:"center",gap:12}}>
      <RespondaLogo size={40}/>
      <div>
        <div style={{fontFamily:F.d,fontStyle:"italic",fontSize:20,fontWeight:600,color:C.tx,letterSpacing:.3}}>responda</div>
        <div style={{fontSize:10,color:C.txL,fontFamily:F.b,letterSpacing:.8,textTransform:"uppercase"}}>Systems</div>
      </div>
    </div>
    <Divider/>
    <nav style={{flex:1,padding:"14px 12px",display:"flex",flexDirection:"column",gap:2}}>
      <div style={{fontSize:10,color:C.txL,fontFamily:F.b,letterSpacing:1.2,textTransform:"uppercase",padding:"8px 10px 6px",marginBottom:2}}>Navigation</div>
      {NAV.slice(0,4).map(n=><NavItem key={n.id} n={n} active={view===n.id} onClick={()=>setView(n.id)}/>)}
      <div style={{fontSize:10,color:C.txL,fontFamily:F.b,letterSpacing:1.2,textTransform:"uppercase",padding:"16px 10px 6px",marginBottom:2}}>Verwaltung</div>
      {NAV.slice(4).map(n=><NavItem key={n.id} n={n} active={view===n.id} onClick={()=>setView(n.id)}/>)}
    </nav>
    <Divider/>
    <div style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:10}}>
      <Avatar ini="AS" color={C.cr} size={34}/>
      <div style={{flex:1,overflow:"hidden"}}>
        <div style={{fontSize:13,fontWeight:500,color:C.tx,fontFamily:F.b,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Alex Schmidt</div>
        <div style={{fontSize:11,color:C.txL,fontFamily:F.b}}>Admin</div>
      </div>
      <div style={{width:8,height:8,borderRadius:"50%",background:C.ok,flexShrink:0}}/>
    </div>
  </div>
);

// ─── TopBar ─────────────────────────────────────────────────────────────────────────
const TITLES: Record<string,string> = {dashboard:"Dashboard",projekte:"Projekte",aufgaben:"Aufgaben",analytics:"Analytics",team:"Team",settings:"Einstellungen"};

const TopBar = ({view, search, setSearch}: {view:string;search:string;setSearch:(s:string)=>void}) => (
  <div style={{height:64,borderBottom:`1px solid ${C.bdr}`,background:C.surf,display:"flex",alignItems:"center",padding:"0 28px",gap:16,position:"sticky",top:0,zIndex:10}}>
    <div style={{flex:1}}>
      <h1 style={{fontFamily:F.d,fontStyle:"italic",fontSize:26,fontWeight:500,color:C.tx,letterSpacing:.2}}>{TITLES[view]}</h1>
    </div>
    <div style={{position:"relative"}}>
      <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.txL,fontSize:13}}>⎕</span>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen …" style={{paddingLeft:32,paddingRight:14,paddingTop:8,paddingBottom:8,border:`1.5px solid ${C.bdr}`,borderRadius:10,fontSize:13,fontFamily:F.b,color:C.tx,background:C.surfAlt,width:210}}/>
    </div>
    <div style={{width:38,height:38,borderRadius:10,border:`1.5px solid ${C.bdr}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",background:C.surfAlt,position:"relative"}} className="btn">
      <span style={{fontSize:15}}>🔔</span>
      <div style={{position:"absolute",top:8,right:8,width:7,height:7,borderRadius:"50%",background:C.cr,border:"1.5px solid white"}}/>
    </div>
    <div style={{width:1,height:28,background:C.bdr}}/>
    <div style={{fontSize:12,color:C.txM,fontFamily:F.b}}>Fr, 15. Mai 2026</div>
  </div>
);

// ─── Dashboard ─────────────────────────────────────────────────────────────────────
const DashboardView = () => {
  const stats = [
    {label:"Aktive Projekte",value:"6",delta:"+2 diesen Monat",up:true,icon:"◫",color:C.cr},
    {label:"Offene Aufgaben",value:"18",delta:"3 fällig heute",up:false,icon:"✓",color:C.warn},
    {label:"Team-Mitglieder",value:"12",delta:"1 neu diese Woche",up:true,icon:"◎",color:C.info},
    {label:"Ø Fortschritt",value:"58%",delta:"+4% vs. Vormonat",up:true,icon:"◈",color:C.ok},
  ];
  return (
    <div style={{padding:"28px 28px 40px",display:"flex",flexDirection:"column",gap:24}}>
      <div className="fu">
        <p style={{fontFamily:F.b,fontSize:13,color:C.txM}}>Freitag, 15. Mai 2026</p>
        <h2 style={{fontFamily:F.d,fontStyle:"italic",fontSize:32,fontWeight:500,color:C.tx,marginTop:2}}>Guten Morgen, Alex. ✶</h2>
      </div>
      <div className="fu d1" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        {stats.map((s,i)=>(
          <div key={i} className="card-h" style={{background:C.surf,borderRadius:14,padding:"20px 20px 16px",border:`1px solid ${C.bdr}`,boxShadow:"0 2px 12px rgba(0,0,0,.04)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <p style={{fontSize:11,color:C.txL,fontFamily:F.b,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>{s.label}</p>
                <p style={{fontFamily:F.d,fontStyle:"italic",fontSize:36,fontWeight:500,color:C.tx,lineHeight:1}}>{s.value}</p>
              </div>
              <div style={{width:38,height:38,borderRadius:10,background:`${s.color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:16,color:s.color}}>{s.icon}</span>
              </div>
            </div>
            <p style={{fontSize:11.5,color:s.up?C.ok:C.warn,fontFamily:F.b,marginTop:12}}><span>{s.up?"↑":"↓"}</span> {s.delta}</p>
          </div>
        ))}
      </div>
      <div className="fu d2" style={{display:"grid",gridTemplateColumns:"1.5fr 1fr",gap:16}}>
        <div style={{background:C.surf,borderRadius:14,padding:"22px 20px",border:`1px solid ${C.bdr}`,boxShadow:"0 2px 12px rgba(0,0,0,.04)"}}>
          <h3 style={{fontFamily:F.d,fontStyle:"italic",fontSize:18,fontWeight:500,color:C.tx}}>Aufgaben-Verlauf</h3>
          <p style={{fontSize:12,color:C.txL,fontFamily:F.b,marginTop:2,marginBottom:18}}>Neue vs. erledigte Aufgaben</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={areaData} margin={{top:5,right:5,left:-20,bottom:0}}>
              <defs>
                <linearGradient id="gradCr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.cr} stopOpacity={.2}/><stop offset="95%" stopColor={C.cr} stopOpacity={0}/></linearGradient>
                <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.gold} stopOpacity={.2}/><stop offset="95%" stopColor={C.gold} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.bdrL} vertical={false}/>
              <XAxis dataKey="m" tick={{fontSize:11,fontFamily:F.b,fill:C.txL}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fontFamily:F.b,fill:C.txL}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{fontFamily:F.b,fontSize:12,borderRadius:10,border:`1px solid ${C.bdr}`}}/>
              <Area type="monotone" dataKey="erledigt" stroke={C.cr} strokeWidth={2} fill="url(#gradCr)"/>
              <Area type="monotone" dataKey="neu" stroke={C.gold} strokeWidth={2} fill="url(#gradGold)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:C.surf,borderRadius:14,padding:"22px 0",border:`1px solid ${C.bdr}`,boxShadow:"0 2px 12px rgba(0,0,0,.04)"}}>
          <div style={{padding:"0 20px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <h3 style={{fontFamily:F.d,fontStyle:"italic",fontSize:18,fontWeight:500,color:C.tx}}>Heute fällig</h3>
            <span style={{fontSize:11,color:C.cr,fontFamily:F.b,cursor:"pointer"}}>Alle →</span>
          </div>
          {TASKS.filter(t=>!t.done).slice(0,4).map(t=>(
            <div key={t.id} className="row-h" style={{padding:"11px 20px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:18,height:18,borderRadius:5,border:`1.5px solid ${C.bdr}`,flexShrink:0}}/>
              <div style={{flex:1,overflow:"hidden"}}>
                <p style={{fontSize:12.5,fontFamily:F.b,color:C.tx,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.title}</p>
                <p style={{fontSize:11,color:C.txL,fontFamily:F.b,marginTop:1}}>{t.proj}</p>
              </div>
              <Badge label={t.prio} bg={prioStyle(t.prio).bg} color={prioStyle(t.prio).color}/>
            </div>
          ))}
        </div>
      </div>
      <div className="fu d3" style={{background:C.surf,borderRadius:14,border:`1px solid ${C.bdr}`,boxShadow:"0 2px 12px rgba(0,0,0,.04)"}}>
        <div style={{padding:"20px 24px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h3 style={{fontFamily:F.d,fontStyle:"italic",fontSize:18,fontWeight:500,color:C.tx}}>Aktive Projekte</h3>
          <button className="btn" style={{padding:"7px 16px",borderRadius:8,background:C.cr,color:"white",fontSize:12,fontFamily:F.b,fontWeight:500}}>+ Neu</button>
        </div>
        <Divider/>
        {PROJECTS.slice(0,4).map((p,i)=>(
          <div key={p.id}>
            <div className="row-h" style={{padding:"14px 24px",display:"flex",alignItems:"center",gap:16}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:13,fontWeight:500,fontFamily:F.b,color:C.tx}}>{p.name}</span>
                  <span style={{fontSize:12,color:C.txL,fontFamily:F.b}}>{p.due}</span>
                </div>
                <ProgressBar value={p.progress} color={p.color}/>
              </div>
              <Badge label={p.status} bg={statusStyle(p.status).bg} color={statusStyle(p.status).color}/>
            </div>
            {i<3&&<Divider/>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Projekte ──────────────────────────────────────────────────────────────────────
const ProjekteView = () => {
  const [filter, setFilter] = useState("Alle");
  const filters = ["Alle","Aktiv","Review","Planung","Pausiert"];
  const filtered = filter==="Alle" ? PROJECTS : PROJECTS.filter(p=>p.status===filter);
  return (
    <div style={{padding:"28px 28px 40px",display:"flex",flexDirection:"column",gap:20}}>
      <div className="fu" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <h2 style={{fontFamily:F.d,fontStyle:"italic",fontSize:28,fontWeight:500,color:C.tx}}>Alle Projekte</h2>
          <p style={{fontSize:12.5,color:C.txM,fontFamily:F.b,marginTop:3}}>{PROJECTS.length} Projekte gesamt</p>
        </div>
        <button className="btn" style={{padding:"9px 20px",borderRadius:10,background:C.cr,color:"white",fontSize:13,fontFamily:F.b,fontWeight:500}}>+ Projekt anlegen</button>
      </div>
      <div className="fu d1" style={{display:"flex",gap:8}}>
        {filters.map(f=>(
          <button key={f} className="chip btn" onClick={()=>setFilter(f)} style={{padding:"6px 16px",borderRadius:99,fontSize:12,fontFamily:F.b,fontWeight:500,border:`1.5px solid ${filter===f?C.cr:C.bdr}`,background:filter===f?C.crPale:C.surf,color:filter===f?C.cr:C.txM}}>{f}</button>
        ))}
      </div>
      <div className="fu d2" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        {filtered.map(p=>(
          <div key={p.id} className="card-h" style={{background:C.surf,borderRadius:14,padding:20,border:`1px solid ${C.bdr}`,boxShadow:"0 2px 12px rgba(0,0,0,.04)",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div style={{width:42,height:42,borderRadius:10,background:`${p.color}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:18,color:p.color}}>◫</span>
              </div>
              <Badge label={p.status} bg={statusStyle(p.status).bg} color={statusStyle(p.status).color}/>
            </div>
            <h3 style={{fontFamily:F.d,fontStyle:"italic",fontSize:18,fontWeight:500,color:C.tx,marginBottom:4}}>{p.name}</h3>
            <p style={{fontSize:11.5,color:C.txL,fontFamily:F.b,marginBottom:16}}>Fällig: {p.due}</p>
            <ProgressBar value={p.progress} color={p.color} height={4}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
              <span style={{fontSize:12,color:C.txM,fontFamily:F.b,fontWeight:500}}>{p.progress}% abgeschlossen</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Aufgaben ──────────────────────────────────────────────────────────────────────
const AufgabenView = () => {
  const [tasks, setTasks] = useState(TASKS);
  const [filter, setFilter] = useState("Alle");
  const toggle = (id: number) => setTasks(t=>t.map(x=>x.id===id?{...x,done:!x.done}:x));
  const filtered = filter==="Alle" ? tasks : filter==="Offen" ? tasks.filter(t=>!t.done) : tasks.filter(t=>t.done);
  return (
    <div style={{padding:"28px 28px 40px",display:"flex",flexDirection:"column",gap:20}}>
      <div className="fu" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <h2 style={{fontFamily:F.d,fontStyle:"italic",fontSize:28,fontWeight:500,color:C.tx}}>Aufgaben</h2>
          <p style={{fontSize:12.5,color:C.txM,fontFamily:F.b,marginTop:3}}>{tasks.filter(t=>!t.done).length} offen · {tasks.filter(t=>t.done).length} erledigt</p>
        </div>
        <button className="btn" style={{padding:"9px 20px",borderRadius:10,background:C.cr,color:"white",fontSize:13,fontFamily:F.b,fontWeight:500}}>+ Aufgabe</button>
      </div>
      <div className="fu d1" style={{display:"flex",gap:8}}>
        {["Alle","Offen","Erledigt"].map(f=>(
          <button key={f} className="chip btn" onClick={()=>setFilter(f)} style={{padding:"6px 16px",borderRadius:99,fontSize:12,fontFamily:F.b,fontWeight:500,border:`1.5px solid ${filter===f?C.cr:C.bdr}`,background:filter===f?C.crPale:C.surf,color:filter===f?C.cr:C.txM}}>{f}</button>
        ))}
      </div>
      <div className="fu d2" style={{background:C.surf,borderRadius:14,border:`1px solid ${C.bdr}`,boxShadow:"0 2px 12px rgba(0,0,0,.04)",overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 160px 90px 90px",padding:"10px 20px",background:C.surfAlt,borderBottom:`1px solid ${C.bdrL}`}}>
          {["Aufgabe","Projekt","Priorität","Fällig"].map(h=><span key={h} style={{fontSize:11,color:C.txL,fontFamily:F.b,letterSpacing:.8,textTransform:"uppercase"}}>{h}</span>)}
        </div>
        {filtered.map((t,i)=>(
          <div key={t.id}>
            <div className="row-h" onClick={()=>toggle(t.id)} style={{display:"grid",gridTemplateColumns:"1fr 160px 90px 90px",padding:"13px 20px",alignItems:"center",background:t.done?"#FAFAF8":C.surf}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:20,height:20,borderRadius:6,flexShrink:0,border:`1.5px solid ${t.done?C.ok:C.bdr}`,background:t.done?C.ok:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
                  {t.done&&<span style={{color:"white",fontSize:11,lineHeight:1}}>✓</span>}
                </div>
                <span style={{fontSize:13,fontFamily:F.b,fontWeight:500,color:t.done?C.txL:C.tx,textDecoration:t.done?"line-through":"none"}}>{t.title}</span>
              </div>
              <span style={{fontSize:12,color:C.txM,fontFamily:F.b}}>{t.proj}</span>
              <Badge label={t.prio} bg={prioStyle(t.prio).bg} color={prioStyle(t.prio).color}/>
              <span style={{fontSize:12,color:C.txM,fontFamily:F.b}}>{t.due}</span>
            </div>
            {i<filtered.length-1&&<Divider/>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Analytics ─────────────────────────────────────────────────────────────────────
const AnalyticsView = () => (
  <div style={{padding:"28px 28px 40px",display:"flex",flexDirection:"column",gap:20}}>
    <div className="fu">
      <h2 style={{fontFamily:F.d,fontStyle:"italic",fontSize:28,fontWeight:500,color:C.tx}}>Analytics</h2>
      <p style={{fontSize:12.5,color:C.txM,fontFamily:F.b,marginTop:3}}>Übersicht · Mai 2026</p>
    </div>
    <div className="fu d1" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
      {[{label:"Abschlussrate",value:"73%",sub:"↑ 8% vs. Vormonat",color:C.ok},{label:"Ø Projektdauer",value:"24 Tage",sub:"↓ 3 Tage vs. Vormonat",color:C.cr},{label:"Team-Auslastung",value:"81%",sub:"→ Stabil",color:C.info}].map((k,i)=>(
        <div key={i} className="card-h" style={{background:C.surf,borderRadius:14,padding:"20px 22px",border:`1px solid ${C.bdr}`,boxShadow:"0 2px 12px rgba(0,0,0,.04)"}}>
          <p style={{fontSize:11,color:C.txL,fontFamily:F.b,letterSpacing:.8,textTransform:"uppercase"}}>{k.label}</p>
          <p style={{fontFamily:F.d,fontStyle:"italic",fontSize:36,fontWeight:500,color:C.tx,margin:"6px 0 4px"}}>{k.value}</p>
          <p style={{fontSize:11.5,color:k.color,fontFamily:F.b}}>{k.sub}</p>
        </div>
      ))}
    </div>
    <div className="fu d2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div style={{background:C.surf,borderRadius:14,padding:"22px 20px",border:`1px solid ${C.bdr}`,boxShadow:"0 2px 12px rgba(0,0,0,.04)"}}>
        <h3 style={{fontFamily:F.d,fontStyle:"italic",fontSize:18,fontWeight:500,color:C.tx,marginBottom:4}}>Aufgaben-Trend</h3>
        <p style={{fontSize:12,color:C.txL,fontFamily:F.b,marginBottom:18}}>Abgeschlossen vs. Neu</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={areaData} margin={{top:5,right:5,left:-20,bottom:0}}>
            <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.cr} stopOpacity={.25}/><stop offset="95%" stopColor={C.cr} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.bdrL} vertical={false}/>
            <XAxis dataKey="m" tick={{fontSize:11,fontFamily:F.b,fill:C.txL}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fontFamily:F.b,fill:C.txL}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{fontFamily:F.b,fontSize:12,borderRadius:10,border:`1px solid ${C.bdr}`}}/>
            <Area type="monotone" dataKey="erledigt" stroke={C.cr} strokeWidth={2.5} fill="url(#g1)"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{background:C.surf,borderRadius:14,padding:"22px 20px",border:`1px solid ${C.bdr}`,boxShadow:"0 2px 12px rgba(0,0,0,.04)"}}>
        <h3 style={{fontFamily:F.d,fontStyle:"italic",fontSize:18,fontWeight:500,color:C.tx,marginBottom:4}}>Team-Performance</h3>
        <p style={{fontSize:12,color:C.txL,fontFamily:F.b,marginBottom:18}}>Score nach Abteilung</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{top:5,right:5,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.bdrL} vertical={false}/>
            <XAxis dataKey="team" tick={{fontSize:11,fontFamily:F.b,fill:C.txL}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fontFamily:F.b,fill:C.txL}} axisLine={false} tickLine={false} domain={[0,100]}/>
            <Tooltip contentStyle={{fontFamily:F.b,fontSize:12,borderRadius:10,border:`1px solid ${C.bdr}`}}/>
            <Bar dataKey="score" fill={C.cr} radius={[6,6,0,0]} opacity={.85}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

// ─── Team ────────────────────────────────────────────────────────────────────────────
const TeamView = () => (
  <div style={{padding:"28px 28px 40px",display:"flex",flexDirection:"column",gap:20}}>
    <div className="fu" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <h2 style={{fontFamily:F.d,fontStyle:"italic",fontSize:28,fontWeight:500,color:C.tx}}>Team</h2>
        <p style={{fontSize:12.5,color:C.txM,fontFamily:F.b,marginTop:3}}>{TEAM.length} Mitglieder</p>
      </div>
      <button className="btn" style={{padding:"9px 20px",borderRadius:10,background:C.cr,color:"white",fontSize:13,fontFamily:F.b,fontWeight:500}}>+ Einladen</button>
    </div>
    <div className="fu d1" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
      {TEAM.map((m,i)=>(
        <div key={i} className="card-h" style={{background:C.surf,borderRadius:14,padding:"22px 20px",border:`1px solid ${C.bdr}`,boxShadow:"0 2px 12px rgba(0,0,0,.04)"}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
            <Avatar ini={m.ini} color={m.color} size={46} ring/>
            <div>
              <p style={{fontSize:14,fontWeight:600,fontFamily:F.b,color:C.tx}}>{m.name}</p>
              <p style={{fontSize:12,color:C.txM,fontFamily:F.b,marginTop:2}}>{m.role}</p>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:m.status==="online"?C.ok:m.status==="abwesend"?C.gold:C.txL}}/>
              <span style={{fontSize:11.5,color:C.txM,fontFamily:F.b}}>{m.status}</span>
            </div>
            <button className="btn" style={{padding:"5px 12px",borderRadius:7,border:`1.5px solid ${C.bdr}`,background:C.surfAlt,fontSize:11,fontFamily:F.b,color:C.txM}}>Nachricht</button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Settings ─────────────────────────────────────────────────────────────────────
const SettingsView = () => {
  const [notif, setNotif] = useState(true);
  const [emails, setEmails] = useState(false);
  const [dark, setDark] = useState(false);
  const Toggle = ({on, set}: {on:boolean;set:React.Dispatch<React.SetStateAction<boolean>>}) => (
    <div className="tog" onClick={()=>set(v=>!v)} style={{width:42,height:24,borderRadius:99,background:on?C.cr:C.bdrL,padding:3,display:"flex",alignItems:"center",justifyContent:on?"flex-end":"flex-start"}}>
      <div style={{width:18,height:18,borderRadius:"50%",background:"white",boxShadow:"0 1px 4px rgba(0,0,0,.2)",transition:"all .2s"}}/>
    </div>
  );
  return (
    <div style={{padding:"28px 28px 40px",display:"flex",flexDirection:"column",gap:20,maxWidth:680}}>
      <div className="fu"><h2 style={{fontFamily:F.d,fontStyle:"italic",fontSize:28,fontWeight:500,color:C.tx}}>Einstellungen</h2></div>
      <div className="fu d1" style={{background:C.surf,borderRadius:14,border:`1px solid ${C.bdr}`,overflow:"hidden"}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${C.bdrL}`}}><h3 style={{fontFamily:F.d,fontStyle:"italic",fontSize:17,fontWeight:500,color:C.tx}}>Profil</h3></div>
        <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <Avatar ini="AS" color={C.cr} size={56} ring/>
            <div>
              <p style={{fontSize:15,fontWeight:600,fontFamily:F.b,color:C.tx}}>Alex Schmidt</p>
              <p style={{fontSize:12,color:C.txM,fontFamily:F.b}}>alex@responda.systems</p>
            </div>
          </div>
          {[{l:"Name",v:"Alex Schmidt"},{l:"E-Mail",v:"alex@responda.systems"},{l:"Rolle",v:"Administrator"}].map(f=>(
            <div key={f.l}>
              <label style={{fontSize:11.5,color:C.txM,fontFamily:F.b,display:"block",marginBottom:6}}>{f.l}</label>
              <input defaultValue={f.v} style={{width:"100%",padding:"9px 14px",borderRadius:9,fontSize:13,fontFamily:F.b,border:`1.5px solid ${C.bdr}`,color:C.tx,background:C.surfAlt}}/>
            </div>
          ))}
          <button className="btn" style={{padding:"9px 20px",borderRadius:9,background:C.cr,color:"white",fontSize:13,fontFamily:F.b,fontWeight:500,alignSelf:"flex-start"}}>Speichern</button>
        </div>
      </div>
      <div className="fu d2" style={{background:C.surf,borderRadius:14,border:`1px solid ${C.bdr}`,overflow:"hidden"}}>
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${C.bdrL}`}}><h3 style={{fontFamily:F.d,fontStyle:"italic",fontSize:17,fontWeight:500,color:C.tx}}>Benachrichtigungen</h3></div>
        <div style={{padding:"6px 0"}}>
          {[{l:"Push-Benachrichtigungen",sub:"Im Browser anzeigen",val:notif,set:setNotif},{l:"E-Mail-Digest",sub:"Tägliche Zusammenfassung",val:emails,set:setEmails},{l:"Dark Mode",sub:"Dunkles Erscheinungsbild",val:dark,set:setDark}].map((row,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 22px"}}>
              <div>
                <p style={{fontSize:13,fontWeight:500,fontFamily:F.b,color:C.tx}}>{row.l}</p>
                <p style={{fontSize:11.5,color:C.txL,fontFamily:F.b,marginTop:2}}>{row.sub}</p>
              </div>
              <Toggle on={row.val} set={row.set}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Root ────────────────────────────────────────────────────────────────────────────
export default function RespondaApp() {
  const [view, setView] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [key, setKey] = useState(0);
  const handleNav = (v: string) => { setView(v); setKey(k=>k+1); };
  const Views: Record<string, React.ComponentType> = {dashboard:DashboardView,projekte:ProjekteView,aufgaben:AufgabenView,analytics:AnalyticsView,team:TeamView,settings:SettingsView};
  const ActiveView = Views[view] || DashboardView;
  return (
    <div style={{display:"flex",height:"100vh",width:"100vw",background:C.bg,fontFamily:F.b,overflow:"hidden"}}>
      <Sidebar view={view} setView={handleNav}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <TopBar view={view} search={search} setSearch={setSearch}/>
        <div key={key} style={{flex:1,overflowY:"auto"}}><ActiveView/></div>
      </div>
    </div>
  );
}
