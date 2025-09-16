/* ===== Accordion ===== */
function openAll(){ document.querySelectorAll('details').forEach(d=>d.open=true); }
function closeAll(){ document.querySelectorAll('details').forEach(d=>d.open=false); }

/* ===== Medikamente-Tabelle ===== */
const medTbody = () => document.querySelector('#medTable tbody');
function addMedRow(data={}){ const tb=medTbody(); const idx=tb.children.length+1; const tr=document.createElement('tr');
  tr.innerHTML = `
    <td>${idx}</td>
    <td><input name="med_name_${idx}" type="text" value="${data.name||''}"></td>
    <td><input name="med_dose_${idx}" type="text" value="${data.dose||''}"></td>
    <td><input name="med_unit_${idx}" type="text" value="${data.unit||''}" placeholder="mg/ml/µg"></td>
    <td>
      <select name="med_route_${idx}">
        <option value=""></option>
        <option ${data.route==='i.v.'?'selected':''}>i.v.</option>
        <option ${data.route==='i.o.'?'selected':''}>i.o.</option>
        <option ${data.route==='i.m.'?'selected':''}>i.m.</option>
        <option ${data.route==='i.n.'?'selected':''}>i.n.</option>
        <option ${data.route==='p.o.'?'selected':''}>p.o.</option>
      </select>
    </td>
    <td><input name="med_time_${idx}" type="time" value="${data.time||''}"></td>
    <td><input name="med_note_${idx}" type="text" value="${data.note||''}"></td>
    <td><button class="subbtn" type="button" onclick="delMedRow(this)">Löschen</button></td>`;
  tb.appendChild(tr);
}
function delMedRow(btn){ const tr=btn.closest('tr'); tr.remove(); medTbody().querySelectorAll('tr').forEach((row,i)=> row.children[0].textContent=i+1 ); }
addMedRow(); addMedRow(); addMedRow();

/* ===== GCS & qSOFA ===== */
function calcGCS(){
  const e=+document.querySelector('input[name="gcs_e"]:checked')?.value||0;
  const v=+document.querySelector('input[name="gcs_v"]:checked')?.value||0;
  const m=+document.querySelector('input[name="gcs_m"]:checked')?.value||0;
  const sum=e+v+m||null;
  document.getElementById('gcs_sum').textContent=sum??'—';
  document.querySelector('input[name="qsofa_gcs"]').value=sum??'';
  document.querySelector('input[name="qsofa_gcs2"]').value=sum??'';
  calcQSOFA();
}
function calcQSOFA(){
  const gcs=parseInt(document.querySelector('input[name="qsofa_gcs"]').value||0);
  const af =parseInt(document.querySelector('input[name="af"]').value||0);
  const rr =parseInt(document.querySelector('input[name="rr_sys"]').value||0);
  document.querySelector('input[name="qsofa_af"]').value = isNaN(af)?'':af;
  document.querySelector('input[name="qsofa_rr"]').value = isNaN(rr)?'':rr;
  document.querySelector('input[name="qsofa_af2"]').value= isNaN(af)?'':af;
  document.querySelector('input[name="qsofa_rr2"]').value= isNaN(rr)?'':rr;
  let score=0; if(gcs && gcs<15) score++; if(af && af>=22) score++; if(rr && rr<=100) score++;
  document.getElementById('qsofa_sum').textContent=String(score||0);
  document.getElementById('qsofa_sum2').textContent=String(score||0);
}
document.addEventListener('input',(e)=>{
  if(['af','rr_sys'].includes(e.target.name)) calcQSOFA();
  if(['gcs_e','gcs_v','gcs_m'].includes(e.target.name)) calcGCS();
});

/* ===== Fotos: stärker komprimieren ===== */
const photoInput=document.getElementById('photoInput'); const thumbs=document.getElementById('thumbs'); let photos=[];
photoInput?.addEventListener('change', async (e)=>{
  const files=[...e.target.files||[]];
  for(const f of files){ const url=await compressImage(f,1200,1200,0.7); photos.push(url); }
  renderThumbs(); autoSave(); photoInput.value='';
});
function renderThumbs(){ thumbs.innerHTML=''; photos.forEach((src,i)=>{ const d=document.createElement('div'); d.className='thumb';
  const img=new Image(); img.src=src; d.appendChild(img);
  const b=document.createElement('button'); b.className='rm'; b.innerHTML='&times;';
  b.onclick=()=>{ photos.splice(i,1); renderThumbs(); autoSave(); };
  d.appendChild(b); thumbs.appendChild(d);
});}
function compressImage(file,maxW,maxH,q){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>{ const img=new Image(); img.onload=()=>{ const s=Math.min(maxW/img.width,maxH/img.height,1);
      const w=img.width*s,h=img.height*s; const c=document.createElement('canvas'); c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h); res(c.toDataURL('image/jpeg',q)); };
      img.onerror=rej; img.src=r.result; };
    r.onerror=rej; r.readAsDataURL(file);
  });
}

/* ===== Unterschrift (Canvas) ===== */
const sig=document.getElementById('sig'); const sctx=sig.getContext('2d');
let drawing=false,last={x:0,y:0}, signatureData='';
function resizeSig(){ const dpr=window.devicePixelRatio||1; const w=sig.clientWidth,h=sig.clientHeight;
  sig.width=Math.floor(w*dpr); sig.height=Math.floor(h*dpr); sctx.setTransform(dpr,0,0,dpr,0,0);
  sctx.lineWidth=2; sctx.lineJoin='round'; sctx.lineCap='round'; sctx.strokeStyle='#111';
  if(signatureData){ const img=new Image(); img.onload=()=>sctx.drawImage(img,0,0,w,h); img.src=signatureData; }
}
function pos(ev){ const r=sig.getBoundingClientRect();
  if(ev.touches?.[0]) return {x:ev.touches[0].clientX-r.left,y:ev.touches[0].clientY-r.top};
  return {x:ev.clientX-r.left,y:ev.clientY-r.top};
}
function start(ev){ drawing=true; last=pos(ev); ev.preventDefault(); }
function move(ev){ if(!drawing) return; const p=pos(ev); sctx.beginPath(); sctx.moveTo(last.x,last.y); sctx.lineTo(p.x,p.y); sctx.stroke(); last=p; ev.preventDefault(); autoSaveSig(); }
function end(){ drawing=false; autoSaveSig(); }
function autoSaveSig(){ try{
    const w=sig.clientWidth,h=sig.clientHeight; if(w&&h){ const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h;
      tmp.getContext('2d').drawImage(sig,0,0,w,h); signatureData=tmp.toDataURL('image/png'); autoSave(); }
  }catch(_){}
}
window.addEventListener('resize',resizeSig);
sig.addEventListener('mousedown',start); sig.addEventListener('mousemove',move); sig.addEventListener('mouseup',end); sig.addEventListener('mouseleave',end);
sig.addEventListener('touchstart',start,{passive:false}); sig.addEventListener('touchmove',move,{passive:false}); sig.addEventListener('touchend',end);
document.getElementById('sigClear').addEventListener('click',()=>{ sctx.clearRect(0,0,sig.width,sig.height); signatureData=''; autoSave(); });

/* ===== Speichern / Laden / Reset ===== */
const STORAGE_KEY='patientendoku_v3_full';
function serializeMedRows(){ const rows=[]; medTbody().querySelectorAll('tr').forEach((tr,i)=>{ const idx=i+1, get=n=>tr.querySelector(`[name="${n}_${idx}"]`);
  rows.push({name:get('med_name')?.value||'',dose:get('med_dose')?.value||'',unit:get('med_unit')?.value||'',route:get('med_route')?.value||'',time:get('med_time')?.value||'',note:get('med_note')?.value||''});
}); return rows; }
function hydrateMedRows(rows){ medTbody().innerHTML=''; (rows && rows.length? rows : [{},{},{}]).forEach(r=>addMedRow(r)); }
function saveForm(){ const data=collectFormData(); localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); alert('Formular lokal gespeichert.'); }
function autoSave(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFormData())); }catch(_){ } }
function collectFormData(){
  const data={}; document.querySelectorAll('input, textarea, select').forEach(el=>{
    if(!el.name) return; if(el.type==='checkbox') data[el.name]=el.checked; else if(el.type==='radio'){ if(el.checked) data[el.name]=el.value; } else data[el.name]=el.value;
  });
  data.__gcs_sum=document.getElementById('gcs_sum')?.textContent||'';
  data.__qsofa_sum=document.getElementById('qsofa_sum')?.textContent||'';
  data.__qsofa_sum2=document.getElementById('qsofa_sum2')?.textContent||'';
  data.__med_rows=serializeMedRows(); data.__photos=photos.slice(); data.__signature=signatureData||'';
  return data;
}
function loadForm(){ const raw=localStorage.getItem(STORAGE_KEY); if(!raw){alert('Keine gespeicherten Daten.');return;}
  const data=JSON.parse(raw); applyData(data); alert('Formular geladen.'); }
function applyData(data){
  hydrateMedRows(data.__med_rows);
  document.querySelectorAll('input, textarea, select').forEach(el=>{
    if(!(el.name in data)) return; if(el.type==='checkbox') el.checked=!!data[el.name]; else if(el.type==='radio') el.checked=(data[el.name]===el.value); else el.value=data[el.name];
  });
  document.getElementById('gcs_sum').textContent=data.__gcs_sum||'—';
  document.getElementById('qsofa_sum').textContent=data.__qsofa_sum||'—';
  document.getElementById('qsofa_sum2').textContent=data.__qsofa_sum2||'—';
  photos=Array.isArray(data.__photos)? data.__photos.slice() : []; renderThumbs(); signatureData=data.__signature||''; resizeSig(); calcQSOFA();
}
function resetFormConfirm(){ if(!confirm('Formular wirklich zurücksetzen?')) return;
  document.querySelectorAll('input, textarea, select').forEach(el=>{ if(el.type==='checkbox'||el.type==='radio') el.checked=false; else el.value=''; });
  hydrateMedRows(null); photos=[]; renderThumbs(); signatureData=''; resizeSig();
  document.getElementById('gcs_sum').textContent='—'; document.getElementById('qsofa_sum').textContent='—'; document.getElementById('qsofa_sum2').textContent='—';
  localStorage.removeItem(STORAGE_KEY);
}

/* ===== ABSENDEN (nur Netlify-Route) + Debug ===== */
const SUBMIT_URL='/.netlify/functions/patientendokumentation-dateien';

async function submitToBackend(){
  const btn=document.getElementById('sendBtn');
  try{
    btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Sende...';
    const data=collectFormData();
    if(!data.name || !data.vorname){
      alert('Bitte Name und Vorname des Patienten ausfüllen.');
      return;
    }

    const res=await fetch(SUBMIT_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({ formData:data, submitterName:data.ausfueller_name||'', authorSignature:data.__signature||'' })
    });

    const rawCT=(res.headers.get('content-type')||'').toLowerCase();
    const text=await res.text(); let json=null; try{ json=JSON.parse(text);}catch(_){}
    if(!res.ok || !json?.ok){
      const msg=[
        'Fehler beim Absenden:',
        `HTTP ${res.status}`,
        '',
        `URL: ${SUBMIT_URL}`,
        json?.error ? `Server meldet: ${json.error}` : '',
        !rawCT.includes('application/json') ? `Antwort (Text): ${text.slice(0,200)}` : ''
      ].join('\n');
      alert(msg);
      return;
    }

    alert('Einsendung erfolgreich.\nID: '+json.id+'\nDie Doku erscheint im Admin-Dashboard unter „Patientendokumentation“.');
    // resetFormConfirm(); // optional
  } catch(err){
    alert('Fehler beim Absenden: ' + (err?.message||String(err)));
  } finally {
    btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-paper-plane"></i> Absenden';
  }
}

/* ===== Start ===== */
window.addEventListener('load',()=>{ resizeSig(); calcGCS(); calcQSOFA(); });
