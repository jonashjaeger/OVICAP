(function(){
'use strict';
const E=window.OVICAP;
const $=id=>document.getElementById(id);
const STORAGE='ovicap-v1-store';
const CURRENT='ovicap-v1-current';
const fields=[...E.integerKeys,'name','site','period','strategy','prior','notes','threeTaxa'];
let current={...E.DEMO};
let saved=[];
let debounce=null, last=null;
const nf=new Intl.NumberFormat('en-GB',{maximumFractionDigits:0});
const one=new Intl.NumberFormat('en-GB',{maximumFractionDigits:1,minimumFractionDigits:1});
function h(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeLoad(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
function store(k,val){try{localStorage.setItem(k,JSON.stringify(val));return true}catch{showMessage('Could not save locally. Check storage settings and export a backup.',true);return false}}
function showMessage(message,isWarn=false){const el=$('notice');el.textContent=message;el.className='notice'+(isWarn?' warn':'');clearTimeout(showMessage.tm);showMessage.tm=setTimeout(()=>el.classList.add('hidden'),7800)}
function takeForm(){const s={...current};for(const f of fields){const el=$(f);if(!el)continue;s[f]=f==='threeTaxa'?el.checked:el.value;}return E.normalize(s)}
function applyForm(data){current={...E.normalize(data)};for(const f of fields){let el=$(f);if(!el)continue;if(f==='threeTaxa')el.checked=Boolean(current[f]);else el.value=String(current[f]??'');}recompute();store(CURRENT,current)}
function onEdit(){current=takeForm();store(CURRENT,current);clearTimeout(debounce);debounce=setTimeout(recompute,140)}
function labelInterval(s){return `${nf.format(Math.round(s.lo))}–${nf.format(Math.round(s.hi))} · 95% interval`}
function fullStat(s){return nf.format(Math.round(s.mean))}
function per(p){return `${one.format(100*p)}%`}
function escapeSvg(s){return h(s)}
function histogram(container,arr){
  const width=570,height=175,pl=44,pr=20,pt=16,pb=39,bins=30;
  const low=Math.min(...arr),high=Math.max(...arr);
  const lo=Math.max(0,Math.floor(low-(high-low)*.02)),hi=Math.ceil(high+(high-low)*.02)+((high===low)?1:0);
  const span=Math.max(1,hi-lo),counts=Array(bins).fill(0);
  for(const v of arr)counts[Math.min(bins-1,Math.floor((v-lo)/span*bins))]++;
  const max=Math.max(...counts),w=(width-pl-pr)/bins,base=height-pb,available=height-pt-pb;
  const bars=counts.map((n,i)=>{const bh=max?available*n/max:0;return `<rect x="${(pl+i*w+1).toFixed(2)}" y="${(base-bh).toFixed(2)}" width="${Math.max(1,w-2).toFixed(2)}" height="${bh.toFixed(2)}" rx="1.5" fill="#c98756"/>`}).join('');
  const ticks=[0,.25,.5,.75,1].map(x=>`<text x="${pl+(width-pl-pr)*x}" y="${height-13}" fill="#7b9287" font-size="11" text-anchor="middle">${nf.format(Math.round(lo+span*x))}</text>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" aria-label="Distribution of estimated goat NISP"><line x1="${pl}" y1="${base}" x2="${width-pr}" y2="${base}" stroke="#d5e3d7"/><line x1="${pl}" y1="${pt}" x2="${pl}" y2="${base}" stroke="#d5e3d7"/>${bars}${ticks}<text x="13" y="${pt+10}" font-size="10" fill="#7b9287">${nf.format(max)}</text><text x="13" y="${base}" font-size="10" fill="#7b9287">0</text></svg>`;
  container.innerHTML=svg;
}
function auditTable(res){const x=res.input;
  const rows=[
    ['Sheep','Morphological + ZooMS',x.morphSheep+x.zooSheep,fullStat(res.sheep)],
    ['Goat','Morphological + ZooMS',x.morphGoat+x.zooGoat,fullStat(res.goat)],
    ['Other','ZooMS-confirmed',x.zooOther,fullStat(res.other)],
    ['Unresolved','Including inconclusive',res.unresolved,'Allocated by model'],
    ['Assemblage total','All input specimens',res.observedTotal,nf.format(res.observedTotal)]
  ];
  $('audit-table').innerHTML=`<table class="audit"><thead><tr><th>Category</th><th>Directly identified</th><th>Estimated total</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${h(row[0])}${row[1]==='Including inconclusive'?'<br><small style="color:#9aab9d">including inconclusive</small>':''}</td><td>${typeof row[2]==='number'?nf.format(row[2]):h(row[2])}</td><td>${h(row[3])}</td></tr>`).join('')}</tbody></table>`;
}
function recompute(){
  const v=E.validate(current);
  $('model-errors').classList.toggle('hidden',!v.errors.length);
  if(v.errors.length){$('model-errors').textContent=v.errors.join(' ');last=null;return;}
  try{
    last=E.estimate(current);
    const r=last;
    $('sheep-est').textContent=fullStat(r.sheep);$('sheep-ci').textContent=labelInterval(r.sheep);
    $('goat-est').textContent=fullStat(r.goat);$('goat-ci').textContent=labelInterval(r.goat);
    $('other-est').textContent=fullStat(r.other);$('other-ci').textContent=labelInterval(r.other);
    $('total-nisp').textContent=`${nf.format(r.observedTotal)} total fragments`;
    const shares=[r.sheep.mean,r.goat.mean,r.other.mean].map(v=>r.observedTotal?100*v/r.observedTotal:0);
    ['sheep','goat','other'].forEach((k,i)=>{$('mix-bar').querySelector('.bar-'+k).style.width=`${shares[i].toFixed(5)}%`});
    $('mix-bar').setAttribute('aria-label',`Expected sheep ${shares[0].toFixed(1)}%, goat ${shares[1].toFixed(1)}%, other ${shares[2].toFixed(1)}%`);
    $('goat-percent').textContent=`${one.format(r.goatPercent.mean)}%`;
    $('goat-percent-ci').textContent=`${one.format(r.goatPercent.lo)}–${one.format(r.goatPercent.hi)}% · 95% interval`;
    $('result-tag').textContent=current.strategy==='random'?'MODEL CONDITIONAL ON RANDOM SAMPLING':'EXPLORATORY SCENARIO';
    histogram($('nisp-hist'),r.distributions.goat);auditTable(r);
    $('assumption-notices').innerHTML=r.flags.map(f=>`<div class="assumption">${h(f)}</div>`).join('');
    renderDetection();
  }catch(err){last=null;$('model-errors').textContent=err.message;$('model-errors').classList.remove('hidden')}
}
function switchTab(tab){document.querySelectorAll('.tab').forEach(btn=>{btn.classList.toggle('active',btn.dataset.tab===tab);btn.setAttribute('aria-selected',String(btn.dataset.tab===tab))});document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+tab));history.replaceState(null,'','#'+tab);if(tab==='library')renderSaved();if(tab==='detect')renderDetection();}
function idNow(){return 'scenario-'+Date.now()+'-'+Math.floor(Math.random()*1e6)}
function saveScenario(){
  const v=E.validate(current);if(v.errors.length){showMessage('Correct the highlighted count errors before saving.',true);return}
  if(!current.id || current.id==='karleby-example')current.id=idNow();
  const pos=saved.findIndex(x=>x.id===current.id);
  if(pos>=0)saved[pos]={...current};else saved.unshift({...current});
  store(STORAGE,saved);store(CURRENT,current);showMessage('Scenario saved on this device. Export a backup for safekeeping.');renderSaved();
}
function formatDate(date){return new Date(date).toISOString().slice(0,10)}
function download(filename,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportScenarioCSV(){const data=saved.length?saved:[current];download(`ovicap-scenarios-${formatDate(Date.now())}.csv`,E.toCSV(E.scenarioRows(data)),'text/csv;charset=utf-8');}
function exportEstimateCSV(){const data=saved.length?saved:[current];const rows=[];
  for(const item of data){const v=E.validate(item);if(v.errors.length)continue;const r=E.estimate(item);rows.push({name:item.name,site:item.site,period:item.period,sampling_strategy:item.strategy,prior:item.prior,model_other:item.threeTaxa,observed_NISP:r.observedTotal,diagnostic_ZooMS:r.diagnostic,inconclusive_ZooMS:item.zooFail,unresolved_NISP:r.unresolved,expected_sheep_NISP:r.sheep.mean,sheep_PPI_low:r.sheep.lo,sheep_PPI_high:r.sheep.hi,expected_goat_NISP:r.goat.mean,goat_PPI_low:r.goat.lo,goat_PPI_high:r.goat.hi,expected_other_NISP:r.other.mean,other_PPI_low:r.other.lo,other_PPI_high:r.other.hi,expected_goat_percent_among_caprines:r.goatPercent.mean,goat_percent_CrI_low:r.goatPercent.lo,goat_percent_CrI_high:r.goatPercent.hi,model_draws:r.draws,model_version:E.VERSION})}
  if(!rows.length){showMessage('No valid scenarios to export.',true);return}
  download(`ovicap-estimates-${formatDate(Date.now())}.csv`,E.toCSV(rows),'text/csv;charset=utf-8');
}
function exportBackup(){download(`ovicap-backup-${formatDate(Date.now())}.json`,JSON.stringify({app:'OVICAP',schema:1,createdAt:new Date().toISOString(),current,scenarios:saved},null,2),'application/json');}
function loadScenario(s){applyForm(s);switchTab('estimate');window.scrollTo({top:0,behavior:'smooth'});showMessage('Scenario loaded. Changes are not saved to the project list until you select Save scenario.');}
function renderSaved(){const el=$('saved-list');if(!saved.length){el.innerHTML='<div class="empty-state">No saved scenarios yet. Save an assemblage on the first tab to begin your local project collection.</div>';return}
  el.innerHTML=saved.map((s,i)=>`<div class="saved-item"><div><h3>${h(s.name||'Untitled assemblage')}</h3><p>${h([s.site,s.period].filter(Boolean).join(' · '))} · ${nf.format(s.morphSheep+s.morphGoat+s.ambiguous)} total NISP</p></div><div class="saved-actions"><button type="button" data-load="${i}">Open</button><button type="button" class="delete" data-delete="${i}">Delete</button></div></div>`).join('');
  el.querySelectorAll('[data-load]').forEach(b=>b.addEventListener('click',()=>loadScenario(saved[Number(b.dataset.load)])));
  el.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.delete);if(confirm(`Delete ${saved[i].name||'this scenario'} from this device? Export a backup first if needed.`)){saved.splice(i,1);store(STORAGE,saved);renderSaved()}}));
}
async function importData(file){if(file.size>3e6){showMessage('Import is limited to 3 MB per file.',true);return}
  const text=await file.text(),isJson=file.name.toLowerCase().endsWith('.json');let items=[];
  try{
    if(isJson){const j=JSON.parse(text);if(j.app!=='OVICAP'||j.schema!==1||!Array.isArray(j.scenarios))throw Error('Not an OVICAP v1 backup.');items=j.scenarios;if(j.current&&E.validate(j.current).errors.length===0){current=E.normalize(j.current);}}
    else items=E.parseCSV(text);
    if(items.length>1000)throw Error('Import limit: 1,000 scenarios.');
    let added=0,skipped=0;
    for(const record of items){const item=E.normalize(record);if(E.validate(item).errors.length){skipped++;continue}
      item.id=idNow();item.name=String(item.name||'Imported assemblage').slice(0,100);item.site=String(item.site||'').slice(0,100);item.period=String(item.period||'').slice(0,100);item.notes=String(item.notes||'').slice(0,5000);
      saved.push(item);added++;
    }
    store(STORAGE,saved);applyForm(current);renderSaved();switchTab('library');showMessage(`Imported ${added} scenario(s)${skipped?`, skipped ${skipped} invalid row(s)`:''}. Existing records were kept.`);
  }catch(err){showMessage('Import unsuccessful: '+err.message,true)}
}
function detectionCurve(p,n,q,N,mode){const w=570,ht=209,pl=43,pr=21,pt=13,pb=40;
  const maxP=Math.max(.05,Math.min(.30,Math.ceil(p*160)/100)),sx=x=>pl+(w-pl-pr)*(x/maxP),sy=y=>pt+(ht-pt-pb)*(1-y);
  let path='';const pts=[];
  for(let i=0;i<=100;i++){const x=i/100*maxP,y=mode==='finite'?E.detectionFinite(N,Math.round(N*x),Math.min(n,N)):E.detectionBinomial(x,n,q);pts.push([x,y??0]);path+=(i?'L':'M')+sx(x).toFixed(2)+','+sy(y??0).toFixed(2)+' '}
  const py=mode==='finite'?E.detectionFinite(N,Math.round(N*p),Math.min(n,N)):E.detectionBinomial(p,n,q);
  const grid=[0,.25,.5,.75,1].map(v=>`<line x1="${pl}" x2="${w-pr}" y1="${sy(v)}" y2="${sy(v)}" stroke="#e1e8e1"/><text x="${pl-9}" y="${sy(v)+4}" font-size="10" fill="#758d80" text-anchor="end">${Math.round(v*100)}%</text>`).join('');
  const ticks=[0,.25,.5,.75,1].map(v=>`<text x="${sx(maxP*v)}" y="${ht-12}" text-anchor="middle" fill="#758d80" font-size="10">${one.format(maxP*v*100)}%</text>`).join('');
  $('detection-curve').innerHTML=`<svg viewBox="0 0 ${w} ${ht}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Detection probability as a function of hypothetical goat proportion">${grid}<path d="${path}" fill="none" stroke="#397e6a" stroke-width="3" stroke-linejoin="round"/><line x1="${sx(p)}" x2="${sx(p)}" y1="${pt}" y2="${sy(0)}" stroke="#c78e5b" stroke-dasharray="4 4"/><circle cx="${sx(p)}" cy="${sy(py??0)}" r="5" fill="#db9c60" stroke="#fff" stroke-width="2"/>${ticks}<text x="${w/2}" y="${ht-1}" font-size="10" fill="#718b80" text-anchor="middle">Hypothetical goat NISP share</text></svg>`;
}
function renderDetection(){
  const p=Number($('rare-p').value)/100,n=Number($('rare-n').value),q=Number($('success-q').value)/100,c=Number($('target-conf').value)/100;
  const mode=$('detection-mode').value,N=Math.max(1,Math.floor(Number($('finite-N').value)||1446));
  $('rare-p-value').textContent=one.format(p*100)+'%';$('rare-n-value').textContent=n;$('success-q-value').textContent=Math.round(q*100)+'%';$('target-conf-value').textContent=Math.round(c*100)+'%';
  $('finite-fields').classList.toggle('hidden',mode!=='finite');$('success-q').disabled=mode==='finite';
  const K=Math.round(N*p),usedN=Math.min(n,N);
  const probability=mode==='finite'?E.detectionFinite(N,K,usedN):E.detectionBinomial(p,n,q);
  const target=mode==='finite'?finiteTarget(N,K,c):E.sampleTarget(p,q,c);
  $('detection-chance').textContent=per(probability??0);$('miss-chance').textContent=per(1-(probability??0));
  $('suggested-attempts').textContent=target==null?'Not attainable':nf.format(target);
  $('detection-bar').style.width=`${100*(probability??0)}%`;
  $('detect-explanation').textContent=mode==='finite'?`Finite pool of ${nf.format(N)} specimens, ${nf.format(K)} hypothetical goats, ${nf.format(usedN)} specimens selected without replacement. Every draw is assumed diagnostic; the success-rate slider is disabled.`:`${nf.format(n)} attempted ZooMS tests × ${Math.round(q*100)}% diagnostic success, assuming independent sampling and species-independent ZooMS success.`;
  $('zero-bound').innerHTML=`With <strong>${nf.format(current.zooSheep+current.zooGoat)} sheep/goat diagnostic results</strong> and no goat identifications, a 95% one-sided upper limit would be <strong>${E.zeroSuccessUpper(current.zooSheep+current.zooGoat)==null?'unavailable':per(E.zeroSuccessUpper(current.zooSheep+current.zooGoat))}</strong>. ${current.zooGoat>0?'Your current data already contain goat identifications, so this zero-goat hypothetical does not describe them.':''}`;
  detectionCurve(p,n,q,N,mode);
}
function finiteTarget(N,K,c){if(!K)return null;let lo=0,hi=N;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(E.detectionFinite(N,K,mid)>=c)hi=mid;else lo=mid+1;}return lo;}
function connectUpdates(){
  if(!('serviceWorker' in navigator))return;
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    let ready=false;
    function showUpdate(){if(reg.waiting&&navigator.serviceWorker.controller){$('update-banner').classList.remove('hidden');}}
    showUpdate();reg.addEventListener('updatefound',()=>{const sw=reg.installing;if(sw)sw.addEventListener('statechange',()=>{if(sw.state==='installed')showUpdate()});});
    $('update-now').addEventListener('click',()=>{if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});else location.reload()});
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!ready){ready=true;location.reload()}});
  }).catch(()=>{});
}
function init(){saved=safeLoad(STORAGE,[]);if(!Array.isArray(saved))saved=[];
  const c=safeLoad(CURRENT,null);applyForm(c&&E.validate(c).errors.length===0?c:E.DEMO);
  fields.forEach(f=>{const el=$(f);if(!el)return;el.addEventListener('input',onEdit);el.addEventListener('change',onEdit)});
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  $('saveScenario').addEventListener('click',saveScenario);
  $('resetDemo').addEventListener('click',()=>{applyForm(E.DEMO);showMessage('Karleby example loaded. It is a worked illustration, not an unbiased assemblage estimate.')});
  $('newScenario').addEventListener('click',()=>{applyForm(E.emptyScenario());showMessage('Empty scenario ready.')});
  ['rare-p','rare-n','success-q','target-conf','detection-mode','finite-N'].forEach(id=>{$(id).addEventListener('input',renderDetection);$(id).addEventListener('change',renderDetection)});
  $('use-current-n').addEventListener('click',()=>{$('rare-n').value=Math.max(1,Math.min(400,current.zooSheep+current.zooGoat+current.zooOther+current.zooFail));renderDetection()});
  $('export-scenarios').addEventListener('click',exportScenarioCSV);$('export-estimates').addEventListener('click',exportEstimateCSV);$('export-backup').addEventListener('click',exportBackup);
  $('import-data').addEventListener('click',()=>$('upload-data').click());$('upload-data').addEventListener('change',async evt=>{const file=evt.target.files?.[0];if(file)await importData(file);evt.target.value=''});
  $('download-template').addEventListener('click',()=>download('ovicap-template.csv',E.toCSV(E.scenarioRows([E.emptyScenario()])),'text/csv;charset=utf-8'));
  $('app-version').textContent=E.VERSION;
  const route=location.hash.replace('#','');switchTab(['estimate','detect','library','methods'].includes(route)?route:'estimate');connectUpdates();
}
window.addEventListener('DOMContentLoaded',init);
})();
