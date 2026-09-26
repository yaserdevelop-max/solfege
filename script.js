(function(){
const SVGNS="http://www.w3.org/2000/svg";
const LET=["C","D","E","F","G","A","B"];
const FR={C:"Do",D:"Ré",E:"Mi",F:"Fa",G:"Sol",A:"La",B:"Si"};
const COL={C:"var(--do)",D:"var(--re)",E:"var(--mi)",F:"var(--fa)",G:"var(--sol)",A:"var(--la)",B:"var(--si)"};
const DARK={D:1,E:1};
const PRAISE=["Bravo !","Super !","Génial !","Parfait !","Excellent !","Trop fort !"];
const $=id=>document.getElementById(id);
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

/* ---------- audio ---------- */
let ctx=null,unlocked=false,soundOn=store.get("sound",true),silentEl=null;
function audio(){ if(!ctx){ try{ctx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){ctx=null} } if(ctx&&ctx.state!=="running"&&ctx.resume)ctx.resume().catch(()=>{}); return soundOn?ctx:null; }
function clock(){ unlock(); return ctx; }
/* un petit fichier audio silencieux : sur iPhone/iPad il permet d'entendre le son même en mode silencieux */
function silentWavUrl(){const n=4000,buf=new ArrayBuffer(44+n),v=new DataView(buf);const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  w(0,"RIFF");v.setUint32(4,36+n,true);w(8,"WAVE");w(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,8000,true);v.setUint16(32,1,true);v.setUint16(34,8,true);w(36,"data");v.setUint32(40,n,true);for(let i=0;i<n;i++)v.setUint8(44+i,128);
  return URL.createObjectURL(new Blob([buf],{type:"audio/wav"}));}
function unlock(){
  try{if(navigator.audioSession)navigator.audioSession.type="playback";}catch(e){}
  if(!ctx){try{ctx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){return}}
  if(ctx.state!=="running"&&ctx.resume)ctx.resume().catch(()=>{});
  if(!unlocked){
    try{const b=ctx.createBuffer(1,1,22050),s=ctx.createBufferSource();s.buffer=b;s.connect(ctx.destination);s.start(0);}catch(e){}
    try{silentEl=new Audio(silentWavUrl());silentEl.loop=true;silentEl.setAttribute("playsinline","");const p=silentEl.play();if(p&&p.catch)p.catch(()=>{});}catch(e){}
    unlocked=true;
  }
}
["touchstart","touchend","pointerdown","mousedown","click","keydown"].forEach(ev=>document.addEventListener(ev,unlock,{capture:true,passive:true}));
function midiOf(step){const l=LET[step%7],o=Math.floor(step/7);return 12*(o+1)+[0,2,4,5,7,9,11][LET.indexOf(l)];}
function playStep(step,when,dur){const a=audio();if(!a)return;const t=when||a.currentTime+.03;const f=440*Math.pow(2,(midiOf(step)-69)/12);
  const g=a.createGain();g.connect(a.destination);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.35,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+(dur||1.4));
  [[1,"triangle",1],[2,"sine",.25],[3,"sine",.08]].forEach(([m,type,v])=>{const o=a.createOscillator();o.type=type;o.frequency.value=f*m;const og=a.createGain();og.gain.value=v;o.connect(og);og.connect(g);o.start(t);o.stop(t+(dur||1.4)+.05);});}
function blip(freq,when,len,vol,type){const a=audio();if(!a)return;const t=when||a.currentTime;const o=a.createOscillator(),g=a.createGain();o.type=type||"sine";o.frequency.value=freq;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+len+.02);}
function buzz(){const a=audio();if(!a)return;blip(160,a.currentTime,.25,.15,"sawtooth");}

/* ---------- tabs ---------- */
function showTab(name){
  const n=name==="rythme"?"rythme":"notes";
  $("tab-notes").setAttribute("aria-selected",n==="notes");$("tab-rythme").setAttribute("aria-selected",n==="rythme");
  $("panel-notes").hidden=n!=="notes";$("panel-rythme").hidden=n!=="rythme";
  try{history.replaceState(null,"","#"+n)}catch(e){}
}
$("tab-notes").onclick=()=>showTab("notes");$("tab-rythme").onclick=()=>showTab("rythme");
if(location.hash==="#rythme")showTab("rythme");

/* ================= NOTES ================= */
const CLEF={
  sol:{bottom:30,range:[28,40],glyph:"𝄞",def:[28,29,30,31,32]},   /* Do3..La4 (C4..A5) */
  fa:{bottom:18,range:[16,28],glyph:"𝄢",def:[21,22,23,24,25]}      /* Mi1..Do3 (E2..C4) */
};
const keyOf=s=>LET[s%7];
const N={clef:"sol",sel:{sol:new Set(store.get("sel_sol",CLEF.sol.def)),fa:new Set(store.get("sel_fa",CLEF.fa.def))},
  auto:store.get("nauto",true),mode:"libre",ok:0,total:0,streak:0,cur:null,lock:false,timeLeft:60,timer:null,running:true};

function el(tag,attrs,parent){const e=document.createElementNS(SVGNS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;}
function drawStaff(svg,o){
  /* o: w,h,sp,bottomY,x0,x1,clef,notes:[{off,x,fill}],clefX */
  svg.innerHTML="";
  for(let i=0;i<5;i++)el("line",{x1:o.x0,x2:o.x1,y1:o.bottomY-i*o.sp,y2:o.bottomY-i*o.sp,stroke:"var(--staff)","stroke-width":o.sp>10?1.6:1.2},svg);
  if(o.clef){const t=el("text",{x:o.clefX,y:o.clef==="sol"?o.bottomY-o.sp:o.bottomY-3*o.sp,"font-size":o.sp*4,"font-family":"Noto Music, Bravura, serif",fill:"var(--staff)"},svg);t.textContent=CLEF[o.clef].glyph;}
  (o.notes||[]).forEach(n=>{
    const y=v=>o.bottomY-v*o.sp/2;
    const lw=o.sp*1.05;
    if(n.off<=-2)for(let v=-2;v>=n.off;v-=2)el("line",{x1:n.x-lw,x2:n.x+lw,y1:y(v),y2:y(v),stroke:"var(--staff)","stroke-width":o.sp>10?1.6:1.2},svg);
    if(n.off>=10)for(let v=10;v<=n.off;v+=2)el("line",{x1:n.x-lw,x2:n.x+lw,y1:y(v),y2:y(v),stroke:"var(--staff)","stroke-width":o.sp>10?1.6:1.2},svg);
    const g=el("g",{transform:`translate(${n.x} ${y(n.off)})`},svg);
    el("ellipse",{rx:o.sp*.72,ry:o.sp*.5,fill:n.fill||"var(--ink)"},g);
    el("ellipse",{rx:o.sp*.34,ry:o.sp*.25,fill:"var(--soft)",transform:"rotate(-35)"},g);
    if(n.label){const t=el("text",{x:0,y:n.off>=6?o.sp*2.3:-o.sp*1.5,"text-anchor":"middle","font-size":20,"font-weight":800,"font-family":"Baloo 2, sans-serif",fill:n.fill||"var(--ink)"},g);t.textContent=n.label;}
  });
}

function renderChips(){
  const box=$("chips");box.innerHTML="";const c=CLEF[N.clef];
  for(let s=c.range[0];s<=c.range[1];s++){
    const b=document.createElement("button");b.className="chip";b.id="chip-"+N.clef+"-"+s;
    b.setAttribute("aria-pressed",N.sel[N.clef].has(s));
    b.setAttribute("aria-label",FR[keyOf(s)]);
    const svg=document.createElementNS(SVGNS,"svg");svg.setAttribute("viewBox","0 0 64 70");b.appendChild(svg);
    drawStaff(svg,{sp:7,bottomY:50,x0:4,x1:60,notes:[{off:s-c.bottom,x:34,fill:COL[keyOf(s)]}]});
    const lab=document.createElement("span");lab.textContent=FR[keyOf(s)];b.appendChild(lab);
    b.onclick=()=>{const set=N.sel[N.clef];set.has(s)?set.delete(s):set.add(s);saveSel();renderChips();renderAnswers();if(!set.has(N.cur))nextNote();else if(!N.cur)nextNote();};
    box.appendChild(b);
  }
}
function saveSel(){store.set("sel_"+N.clef,[...N.sel[N.clef]]);}
function selWhere(fn){const c=CLEF[N.clef];const set=new Set();for(let s=c.range[0];s<=c.range[1];s++)if(fn(s-c.bottom))set.add(s);N.sel[N.clef]=set;saveSel();renderChips();renderAnswers();nextNote();}
$("selAll").onclick=()=>selWhere(()=>true);
$("selNone").onclick=()=>selWhere(()=>false);
$("selLines").onclick=()=>selWhere(o=>o%2===0);
$("selSpaces").onclick=()=>selWhere(o=>Math.abs(o%2)===1);

function setClef(k){N.clef=k;$("clef-sol").setAttribute("aria-pressed",k==="sol");$("clef-fa").setAttribute("aria-pressed",k==="fa");renderChips();renderAnswers();N.cur=null;nextNote();}
$("clef-sol").onclick=()=>setClef("sol");$("clef-fa").onclick=()=>setClef("fa");

function renderAnswers(){
  const box=$("answers");box.innerHTML="";
  const letters=new Set([...N.sel[N.clef]].map(keyOf));
  LET.filter(l=>letters.has(l)).forEach(l=>{
    const b=document.createElement("button");b.className="ans"+(DARK[l]?" dark":"");b.id="ans-"+l;b.textContent=FR[l];b.style.background=COL[l];
    b.onclick=()=>answer(l,b);box.appendChild(b);
  });
}
function showNote(opts){
  const c=CLEF[N.clef];opts=opts||{};
  drawStaff($("nStaff"),{sp:16,bottomY:128,x0:10,x1:310,clef:N.clef,clefX:16,
    notes:N.cur==null?[]:[{off:N.cur-c.bottom,x:200,fill:opts.fill,label:opts.label}]});
}
function nextNote(){
  const list=[...N.sel[N.clef]];
  $("answers").querySelectorAll(".ans").forEach(b=>b.classList.remove("right","wrong"));
  if(list.length<2){N.cur=list[0]??null;showNote();$("nFeedback").className="feedback";$("nFeedback").textContent="Choisis au moins 2 notes pour jouer.";N.lock=true;return;}
  if(!N.running){N.lock=true;return;}
  let s;do{s=list[Math.floor(Math.random()*list.length)]}while(s===N.cur);
  N.cur=s;N.lock=false;showNote();
  if(N.auto&&unlocked)setTimeout(()=>{if(N.cur===s)playStep(s)},200);
  $("nFeedback").className="feedback";$("nFeedback").textContent="Quelle est cette note ?";
}
function answer(l,btn){
  if(N.lock||N.cur==null)return;
  const good=keyOf(N.cur);N.total++;N.lock=true;
  if(l===good){
    N.ok++;N.streak++;playStep(N.cur);
    showNote({fill:"var(--ok)",label:FR[good]});
    $("nFeedback").className="feedback ok";$("nFeedback").textContent=PRAISE[Math.floor(Math.random()*PRAISE.length)];
    if(N.streak%5===0)addStar("nStars");
    updateN();setTimeout(nextNote,N.mode==="chrono"?450:850);
  }else{
    N.streak=0;buzz();btn.classList.add("wrong");
    const r=$("ans-"+good);if(r)r.classList.add("right");
    setTimeout(()=>playStep(N.cur),250);
    showNote({fill:COL[good],label:FR[good]});
    $("nFeedback").className="feedback bad";$("nFeedback").textContent="Oups, c'était "+FR[good]+".";
    updateN();setTimeout(nextNote,N.mode==="chrono"?900:1700);
  }
}
function updateN(){$("nScore").textContent=N.ok+" / "+N.total;$("nStreak").textContent=N.streak;}
function addStar(id){const s=$(id);if(s.textContent.length<10)s.textContent+="★";}
$("nListen").onclick=()=>{if(N.cur!=null)playStep(N.cur);};
function resetN(){N.ok=0;N.total=0;N.streak=0;$("nStars").textContent="";updateN();}
$("nReset").onclick=()=>{resetN();if(N.mode==="chrono")startChrono();else nextNote();};

function setMode(m){
  N.mode=m;$("mode-libre").setAttribute("aria-pressed",m==="libre");$("mode-chrono").setAttribute("aria-pressed",m==="chrono");
  clearInterval(N.timer);$("timerBox").hidden=m!=="chrono";resetN();
  if(m==="chrono"){N.running=false;showStartOverlay();}else{N.running=true;$("nOverlay").hidden=true;nextNote();}
}
$("mode-libre").onclick=()=>setMode("libre");$("mode-chrono").onclick=()=>setMode("chrono");
function showStartOverlay(){const o=$("nOverlay");o.hidden=false;o.innerHTML='<h2>Défi 60 secondes</h2><p>Lis un maximum de notes avant la fin du temps.</p><p>Record : <b>'+store.get("best_"+N.clef,0)+'</b></p><button class="btn" id="goChrono">C\'est parti !</button>';$("goChrono").onclick=startChrono;$("nTimer").textContent=60;}
function startChrono(){
  audio();resetN();$("nOverlay").hidden=true;N.running=true;N.timeLeft=60;$("nTimer").textContent=60;nextNote();
  clearInterval(N.timer);N.timer=setInterval(()=>{N.timeLeft--;$("nTimer").textContent=N.timeLeft;if(N.timeLeft<=0){clearInterval(N.timer);endChrono();}},1000);
}
function endChrono(){
  N.running=false;N.lock=true;const best=store.get("best_"+N.clef,0);const rec=N.ok>best;if(rec)store.set("best_"+N.clef,N.ok);
  const o=$("nOverlay");o.hidden=false;
  o.innerHTML='<h2>'+(rec?"Nouveau record !":"Temps écoulé !")+'</h2><p><b>'+N.ok+'</b> bonnes réponses sur '+N.total+'</p><p>Record : '+Math.max(best,N.ok)+'</p><button class="btn" id="againChrono">Rejouer</button>';
  $("againChrono").onclick=startChrono;
}

renderChips();renderAnswers();nextNote();

/* ================= RYTHME ================= */
const FIG={
  ronde:{d:4,name:"Ronde"},
  blanche:{d:2,name:"Blanche"},
  noire:{d:1,name:"Noire"},
  croches:{d:1,name:"2 croches",sub:[0,.5]},
  soupir:{d:1,rest:true,name:"Soupir"},
  demipause:{d:2,rest:true,name:"Demi-pause"}
};
const R={auto:store.get("rauto",true),sel:new Set(store.get("figs",["noire","croches","blanche","soupir"])),bpm:70,measures:1,seq:[],busy:false,taps:[],perfect:0,tries:0,hits:null};

function drawFigure(svg,f,x,L,sp,fill){
  const col=fill||"var(--ink)";const rx=sp*.62,ry=sp*.45;
  const head=(hx,hollow,c)=>{const g=el("g",{transform:`translate(${hx} ${L}) rotate(-20)`},svg);
    if(hollow){el("ellipse",{rx,ry,fill:c},g);el("ellipse",{rx:rx*.55,ry:ry*.5,fill:"var(--soft)"},g);}else el("ellipse",{rx,ry,fill:c},g);};
  const stem=(hx,c)=>el("line",{x1:hx+rx*.9,x2:hx+rx*.9,y1:L-2,y2:L-sp*3.2,stroke:c,"stroke-width":2},svg);
  if(f.k==="ronde"){const g=el("g",{transform:`translate(${x} ${L})`},svg);el("ellipse",{rx:rx*1.15,ry:ry*1.05,fill:(f.c&&f.c[0])||col},g);el("ellipse",{rx:rx*.55,ry:ry*.62,fill:"var(--soft)",transform:"rotate(-35)"},g);}
  else if(f.k==="blanche"){const c=(f.c&&f.c[0])||col;head(x,true,c);stem(x,c);}
  else if(f.k==="noire"){const c=(f.c&&f.c[0])||col;head(x,false,c);stem(x,c);}
  else if(f.k==="croches"){const dx=f.dx||sp*2.2;const c1=(f.c&&f.c[0])||col,c2=(f.c&&f.c[1])||col;
    head(x,false,c1);stem(x,c1);head(x+dx,false,c2);stem(x+dx,c2);
    el("rect",{x:x+rx*.9-1,y:L-sp*3.2-1,width:dx+2,height:sp*.5,fill:col},svg);}
  else if(f.k==="soupir"){const t=el("text",{x:x-sp*.4,y:L+sp*.6,"font-size":sp*3.2,"font-family":"Noto Music, Bravura, serif",fill:col},svg);t.textContent="𝄽";}
  else if(f.k==="demipause"){el("rect",{x:x-sp*.8,y:L-sp*.6,width:sp*1.6,height:sp*.6,fill:col},svg);}
}

function renderFigChips(){
  const box=$("figChips");box.innerHTML="";
  Object.keys(FIG).forEach(k=>{
    const f=FIG[k];const b=document.createElement("button");b.className="chip";b.id="fig-"+k;b.setAttribute("aria-pressed",R.sel.has(k));
    const svg=document.createElementNS(SVGNS,"svg");svg.setAttribute("viewBox","0 0 70 56");b.appendChild(svg);
    el("line",{x1:4,x2:66,y1:40,y2:40,stroke:"var(--staff)","stroke-width":1.2},svg);
    drawFigure(svg,{k,dx:18},k==="croches"?24:35,40,9);
    const lab=document.createElement("span");lab.textContent=f.name;b.appendChild(lab);
    const t=document.createElement("span");t.className="t";t.textContent=f.d+(f.d>1?" temps":" temps");b.appendChild(t);
    b.onclick=()=>{if(R.busy)return;R.sel.has(k)?R.sel.delete(k):R.sel.add(k);store.set("figs",[...R.sel]);renderFigChips();newRhythm();};
    box.appendChild(b);
  });
}

function newRhythm(){
  const figs=[...R.sel];R.hits=null;
  if(!figs.some(k=>!FIG[k].rest)){R.seq=[];drawRhythm();$("rFeedback").className="feedback";$("rFeedback").textContent="Choisis au moins une figure qui se joue (pas seulement des silences).";setBtns();return;}
  let seq,tries=0;
  do{seq=[];for(let m=0;m<R.measures;m++){let b=0;while(b<4){const ok=figs.filter(k=>FIG[k].d<=4-b);const k=ok[Math.floor(Math.random()*ok.length)];if(!k)break;seq.push({k,beat:m*4+b});b+=FIG[k].d;}}tries++;}
  while((seq.every(s=>FIG[s.k].rest)||(seq.length>1&&seq.every(s=>s.k===seq[0].k)&&figs.length>1&&tries<20))&&tries<40);
  R.seq=seq;drawRhythm();
  $("rFeedback").className="feedback";$("rFeedback").textContent="Écoute le modèle, puis tape le rythme !";setBtns();
}
function onsets(){const out=[];R.seq.forEach((s,i)=>{const f=FIG[s.k];if(f.rest)return;(f.sub||[0]).forEach((d,j)=>out.push({t:s.beat+d,i,j}));});return out;}

const RG={x0:56,L:78,sp:10};
function unit(){return (350-RG.x0)/(R.measures*4);}
function beatX(b){return RG.x0+b*unit();}
function drawRhythm(playhead){
  const svg=$("rStaff");svg.innerHTML="";const u=unit(),beats=R.measures*4;
  el("line",{x1:8,x2:352,y1:RG.L,y2:RG.L,stroke:"var(--staff)","stroke-width":1.6},svg);
  [["4",RG.L-4],["4",RG.L+22]].forEach(([n,y])=>{const t=el("text",{x:22,y,"font-size":26,"font-weight":800,"font-family":"Baloo 2, sans-serif",fill:"var(--staff)","text-anchor":"middle"},svg);t.textContent=n;});
  for(let m=1;m<=R.measures;m++){const x=beatX(m*4)-4;el("line",{x1:x,x2:x,y1:RG.L-26,y2:RG.L+26,stroke:"var(--staff)","stroke-width":m===R.measures?3:1.6},svg);}
  for(let b=0;b<beats;b++){const t=el("text",{x:beatX(b)+u*.3,y:RG.L+48,"font-size":14,"font-weight":700,"font-family":"Nunito, sans-serif",fill:"var(--muted)","text-anchor":"middle"},svg);t.textContent=(b%4)+1;}
  if(playhead!=null){el("rect",{x:beatX(playhead)+u*.3-u*.3,y:RG.L-44,width:3,height:80,rx:1.5,fill:"var(--sol)",id:"ph"},svg);}
  R.seq.forEach((s,i)=>{
    const f={k:s.k,dx:u*.5};
    if(R.hits){const c=[];(FIG[s.k].sub||[0]).forEach((d,j)=>{const h=R.hits.find(h=>h.i===i&&h.j===j);if(h)c.push(h.ok?"var(--ok)":"var(--bad)");});if(c.length)f.c=c;}
    drawFigure(svg,f,beatX(s.beat)+u*.3,RG.L,RG.sp);
  });
}
function setBtns(){const empty=!R.seq.length;$("rListen").disabled=R.busy||empty;$("rPlay").disabled=R.busy||empty;$("rNew").disabled=R.busy;$("pad").disabled=!R.busy||R.listening;}

function run(listen){
  const a=clock();if(!a||!R.seq.length||R.busy)return;
  R.busy=true;R.listening=listen;R.taps=[];R.hits=null;drawRhythm();
  const bd=60/R.bpm,beats=R.measures*4,t0=a.currentTime+.15,T=t0+4*bd;R.T=T;R.bd=bd;
  for(let i=0;i<4;i++)blip(i===0?1800:1300,t0+i*bd,.05,.25,"square");
  for(let i=0;i<beats;i++)blip(i%4===0?1500:1100,T+i*bd,.04,.07,"square");
  if(listen)onsets().forEach(o=>blip(760,T+o.t*bd,.12,.5,"triangle"));
  setBtns();
  $("rFeedback").className="feedback";$("rFeedback").textContent=listen?"Écoute bien…":"Prépare-toi… tape sur les notes !";
  const cnt=$("rCount");
  const end=T+beats*bd+.25;
  (function tick(){
    const now=a.currentTime;
    if(now<T){const n=Math.floor((now-t0)/bd)+1;cnt.hidden=n<1;cnt.textContent=n>=1?n:"";}
    else{cnt.hidden=true;const ph=Math.min((now-T)/bd,beats);const p=$("ph");const x=beatX(ph);if(p)p.setAttribute("x",x);else drawRhythm(ph);}
    if(now<end)requestAnimationFrame(tick);else finish(listen);
  })();
}
function finish(listen){
  R.busy=false;const svgph=$("ph");if(svgph)svgph.remove();
  if(listen){$("rFeedback").className="feedback";$("rFeedback").textContent="À toi maintenant !";setBtns();return;}
  const tol=Math.min(.2,R.bd*.3);const used=new Set();const on=onsets();
  R.hits=on.map(o=>{const tt=R.T+o.t*R.bd;let best=-1,bdiff=9;R.taps.forEach((t,ix)=>{if(used.has(ix))return;const d=Math.abs(t-tt);if(d<bdiff){bdiff=d;best=ix;}});const ok=bdiff<=tol;if(ok)used.add(best);return {i:o.i,j:o.j,ok};});
  const good=R.hits.filter(h=>h.ok).length,extra=R.taps.length-used.size;
  R.tries++;drawRhythm();
  const fb=$("rFeedback");
  if(good===on.length&&extra===0){R.perfect++;addStar("rStars");fb.className="feedback ok";fb.textContent=PRAISE[Math.floor(Math.random()*PRAISE.length)]+" Rythme parfait !";}
  else{fb.className="feedback bad";fb.textContent=good+" / "+on.length+" notes au bon moment"+(extra>0?" · "+extra+" tape"+(extra>1?"s":"")+" en trop":"")+". Réessaie !";}
  $("rScore").textContent=R.perfect;$("rTries").textContent=R.tries;setBtns();
}
function tap(e){if(e)e.preventDefault();if(!R.busy||R.listening)return;const a=clock();R.taps.push(a.currentTime);blip(600,a.currentTime,.1,.4,"triangle");const p=$("pad");p.classList.add("hit");setTimeout(()=>p.classList.remove("hit"),90);}
$("pad").addEventListener("pointerdown",tap);
document.addEventListener("keydown",e=>{if(e.code==="Space"&&!$("panel-rythme").hidden&&R.busy){tap(e);}});
$("rListen").onclick=()=>run(true);$("rPlay").onclick=()=>run(false);$("rNew").onclick=()=>{newRhythm();if(R.auto&&R.seq.length)setTimeout(()=>run(true),250);};
$("bpm").oninput=e=>{R.bpm=+e.target.value;$("bpmOut").textContent=R.bpm+" à la noire";};
function setLen(n){if(R.busy)return;R.measures=n;$("len-1").setAttribute("aria-pressed",n===1);$("len-2").setAttribute("aria-pressed",n===2);newRhythm();}
$("len-1").onclick=()=>setLen(1);$("len-2").onclick=()=>setLen(2);

renderFigChips();newRhythm();

function bindToggle(id,get,set){const b=$(id);const r=()=>b.setAttribute("aria-pressed",get());r();b.onclick=()=>{set(!get());r();};}
bindToggle("nAuto",()=>N.auto,v=>{N.auto=v;store.set("nauto",v);if(v&&N.cur!=null)playStep(N.cur);});
bindToggle("rAuto",()=>R.auto,v=>{R.auto=v;store.set("rauto",v);});
function refreshSound(){const b=$("soundBtn");b.setAttribute("aria-pressed",soundOn);b.textContent=soundOn?"Son activé":"Son coupé";}
$("soundBtn").onclick=()=>{soundOn=!soundOn;store.set("sound",soundOn);refreshSound();};
$("soundTest").onclick=()=>{if(!soundOn){soundOn=true;store.set("sound",true);refreshSound();}unlock();const a=audio();if(!a){$("soundHint").textContent="Ce navigateur ne permet pas de jouer du son.";return;}const t=a.currentTime+.08;[28,30,32,35].forEach((st,i)=>playStep(st,t+i*.2,.8));};
refreshSound();
})();
