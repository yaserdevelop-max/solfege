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
  const n=["rythme","partition"].includes(name)?name:"notes";
  ["notes","rythme","partition"].forEach(k=>{$("tab-"+k).setAttribute("aria-selected",n===k);$("panel-"+k).hidden=n!==k;});
  try{history.replaceState(null,"","#"+n)}catch(e){}
}
$("tab-notes").onclick=()=>showTab("notes");$("tab-rythme").onclick=()=>showTab("rythme");$("tab-partition").onclick=()=>showTab("partition");
if(location.hash==="#rythme"||location.hash==="#partition")showTab(location.hash.slice(1));

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
  ronde:{name:"Ronde",d:4,it:[[0,4,"w"]]},
  blanchep:{name:"Blanche pointée",d:3,it:[[0,3,"h."]]},
  blanche:{name:"Blanche",d:2,it:[[0,2,"h"]]},
  noirepc:{name:"Noire pointée + croche",d:2,it:[[0,1.5,"q."],[1.5,.5,"8"]]},
  noire:{name:"Noire",d:1,it:[[0,1,"q"]]},
  croches:{name:"2 croches",d:1,it:[[0,.5,"8"],[.5,.5,"8"]]},
  doubles:{name:"4 doubles croches",d:1,it:[[0,.25,"16"],[.25,.25,"16"],[.5,.25,"16"],[.75,.25,"16"]]},
  c2d:{name:"Croche + 2 doubles",d:1,it:[[0,.5,"8"],[.5,.25,"16"],[.75,.25,"16"]]},
  d2c:{name:"2 doubles + croche",d:1,it:[[0,.25,"16"],[.25,.25,"16"],[.5,.5,"8"]]},
  cpd:{name:"Croche pointée + double",d:1,it:[[0,.75,"8."],[.75,.25,"16"]]},
  triolet:{name:"Triolet de croches",d:1,trip:true,it:[[0,1/3,"8"],[1/3,1/3,"8"],[2/3,1/3,"8"]]},
  dsc:{name:"Demi-soupir + croche",d:1,it:[[0,.5,"r8"],[.5,.5,"8"]]},
  soupir:{name:"Soupir",d:1,it:[[0,1,"r4"]]},
  demipause:{name:"Demi-pause",d:2,it:[[0,2,"r2"]]},
  pause:{name:"Pause",d:4,it:[[0,4,"r1"]]}
};
Object.values(FIG).forEach(f=>{f.heads=f.it.filter(i=>i[2][0]!=="r");f.rest=!f.heads.length;f.dense=f.it.some(i=>i[2]==="16")||!!f.trip;});

const R={auto:store.get("rauto",true),sel:new Set(store.get("figs",["noire","croches","blanche","soupir"])),bpm:70,measures:1,seq:[],busy:false,taps:[],perfect:0,tries:0,hits:null};
const TEMPS=d=>d+" temps";

/* Remplit une mesure de 4 temps avec les figures choisies */
function fillMeasures(figs,measures){
  const durs=[...new Set(figs.map(k=>FIG[k].d))];
  const memo={};const can=r=>{if(r===0)return true;if(r<0)return false;if(r in memo)return memo[r];return memo[r]=durs.some(d=>can(r-d));};
  const seq=[];
  for(let m=0;m<measures;m++){let b=0;
    while(b<4){
      let ok=figs.filter(k=>{const d=FIG[k].d;return d<=4-b&&can(4-b-d)&&(d!==2||b%2===0);});
      if(!ok.length)ok=figs.filter(k=>{const d=FIG[k].d;return d<=4-b&&can(4-b-d);});
      const k=ok.length?ok[Math.floor(Math.random()*ok.length)]:"noire";
      seq.push({k,beat:m*4+b});b+=FIG[k].d;
    }
  }
  return seq;
}

/* Dessine une figure (notes, hampes, crochets, ligatures, points, silences) */
function drawGroup(svg,k,g){
  const f=FIG[k],sp=g.sp,rx=sp*.62,ry=sp*.45,col=g.col||"var(--ink)",mid=g.restMid;
  const heads=[];let j=0;
  f.it.forEach(([o,d,v])=>{
    const x=g.x+o*g.unit*.72;
    if(v[0]==="r"){
      if(v==="r4"){const t=el("text",{x:x-sp*.45,y:mid+sp*(g.single?.6:1.3),"font-size":sp*3.2,"font-family":"Noto Music, Bravura, serif",fill:col},svg);t.textContent="𝄽";}
      else if(v==="r8"){const cy=g.single?mid-sp*.9:mid-sp*.5;el("circle",{cx:x-sp*.3,cy:cy-sp*.2,r:sp*.32,fill:col},svg);
        el("path",{d:`M${x-sp*.3} ${cy} Q${x+sp*.2} ${cy+sp*.15} ${x+sp*.5} ${cy-sp*.45} L${x-sp*.05} ${cy+sp*1.6}`,stroke:col,"stroke-width":1.8,fill:"none","stroke-linecap":"round"},svg);}
      else if(v==="r2")el("rect",{x:x-sp*.8,y:mid-sp*.55,width:sp*1.6,height:sp*.55,fill:col},svg);
      else if(v==="r1")el("rect",{x:x-sp*.8,y:g.single?mid:mid-sp,width:sp*1.6,height:sp*.55,fill:col},svg);
      return;
    }
    const y=g.y(j),c=(g.cols&&g.cols(j))||col;
    if(g.ledger)g.ledger(x,j);
    const hg=el("g",{transform:`translate(${x} ${y}) rotate(${v==="w"?0:-20})`},svg);
    if(v==="w"){el("ellipse",{rx:rx*1.15,ry:ry*1.05,fill:c},hg);el("ellipse",{rx:rx*.55,ry:ry*.62,fill:"var(--soft)",transform:"rotate(-35)"},hg);}
    else{el("ellipse",{rx,ry,fill:c},hg);if(v[0]==="h")el("ellipse",{rx:rx*.55,ry:ry*.5,fill:"var(--soft)"},hg);}
    if(v.endsWith("."))el("circle",{cx:x+rx+sp*.55,cy:y-((g.dotUp&&g.dotUp(j))?sp*.5:0),r:sp*.2,fill:c},svg);
    if(g.label)g.label(x,j);
    heads.push({x,y,v,c});j++;
  });
  const up=g.up!==false;
  const st=heads.filter(h=>h.v!=="w");
  if(!st.length)return heads;
  st.forEach(h=>h.sx=up?h.x+rx*.9:h.x-rx*.9);
  const beam=st.filter(h=>/^(8|16)/.test(h.v));
  const beamed=beam.length>=2;
  const len=sp*3.3;
  let bend=null;
  if(beamed){const ys=beam.map(h=>h.y);bend=up?Math.min(...ys)-len-(beam.some(h=>h.v==="16")?sp*.3:0):Math.max(...ys)+len+(beam.some(h=>h.v==="16")?sp*.3:0);}
  st.forEach(h=>{const inBeam=beamed&&beam.includes(h);h.end=inBeam?bend:(up?h.y-len:h.y+len);
    el("line",{x1:h.sx,x2:h.sx,y1:h.y+(up?-2:2),y2:h.end,stroke:h.c,"stroke-width":1.8},svg);});
  const th=sp*.5;
  if(beamed){
    const a=beam[0],b=beam[beam.length-1];
    el("rect",{x:a.sx-.9,y:up?bend:bend-th,width:b.sx-a.sx+1.8,height:th,fill:col},svg);
    const y2=up?bend+th*1.6:bend-th*2.6;
    beam.forEach((h,i)=>{
      if(h.v!=="16")return;
      const nx=beam[i+1],pv=beam[i-1];
      if(nx&&nx.v==="16")el("rect",{x:h.sx-.9,y:y2,width:nx.sx-h.sx+1.8,height:th,fill:col},svg);
      else if(!(pv&&pv.v==="16")){const w=sp*1.1;el("rect",{x:pv?h.sx-w:h.sx-.9,y:y2,width:w+.9,height:th,fill:col},svg);}
    });
    if(f.trip){const t=el("text",{x:(a.sx+b.sx)/2,y:up?bend-sp*.5:bend+sp*1.5,"text-anchor":"middle","font-size":sp*1.4,"font-weight":800,"font-style":"italic","font-family":"Nunito, sans-serif",fill:col},svg);t.textContent="3";}
  }else{
    beam.forEach(h=>{const e=h.end,s=up?1:-1;
      const flag=off=>el("path",{d:`M${h.sx} ${e+off*s} C${h.sx+sp*.2} ${e+(off+sp*1.1)*s} ${h.sx+sp*1.6} ${e+(off+sp*1.5)*s} ${h.sx+sp*.9} ${e+(off+sp*3)*s}`,stroke:h.c,"stroke-width":2,fill:"none","stroke-linecap":"round"},svg);
      flag(0);if(h.v==="16")flag(sp*.9);});
  }
  return heads;
}


function renderFigChips(){
  const box=$("figChips");box.innerHTML="";
  Object.keys(FIG).forEach(k=>{
    const f=FIG[k];const b=document.createElement("button");b.className="chip";b.id="fig-"+k;b.setAttribute("aria-pressed",R.sel.has(k));
    const svg=document.createElementNS(SVGNS,"svg");svg.setAttribute("viewBox","0 0 80 56");b.appendChild(svg);
    el("line",{x1:4,x2:76,y1:40,y2:40,stroke:"var(--staff)","stroke-width":1.2},svg);
    {const mo=Math.max(...f.it.map(i=>i[0]));const u=mo?46/(mo*.72):0;drawGroup(svg,k,{x:mo?17:40,unit:u,sp:8,y:()=>40,restMid:40,single:true,dotUp:()=>true});}
    const lab=document.createElement("span");lab.textContent=f.name;b.appendChild(lab);
    const t=document.createElement("span");t.className="t";t.textContent=TEMPS(f.d);b.appendChild(t);
    b.onclick=()=>{if(R.busy)return;R.sel.has(k)?R.sel.delete(k):R.sel.add(k);store.set("figs",[...R.sel]);renderFigChips();newRhythm();};
    box.appendChild(b);
  });
}

function newRhythm(){
  const figs=[...R.sel];R.hits=null;
  if(!figs.some(k=>!FIG[k].rest)){R.seq=[];drawRhythm();$("rFeedback").className="feedback";$("rFeedback").textContent="Choisis au moins une figure qui se joue (pas seulement des silences).";setBtns();return;}
  let seq,tries=0;
  do{seq=fillMeasures(figs,R.measures);tries++;}
  while((seq.every(s=>FIG[s.k].rest)||(seq.length>1&&seq.every(s=>s.k===seq[0].k)&&figs.length>1&&tries<20))&&tries<40);
  R.seq=seq;drawRhythm();
  $("rFeedback").className="feedback";$("rFeedback").textContent="Écoute le modèle, puis tape le rythme !";setBtns();
}
function onsets(){const out=[];R.seq.forEach((s,i)=>{FIG[s.k].heads.forEach(([o],j)=>out.push({t:s.beat+o,i,j}));});return out;}

const RG={x0:56,L:78,sp:10};
function unit(){const beats=R.measures*4;return Math.max((350-RG.x0)/beats,R.seq.some(s=>FIG[s.k].dense)?68:(R.seq.some(s=>FIG[s.k].heads.length>1)?44:0));}
function rWidth(){return Math.max(360,RG.x0+R.measures*4*unit()+10);}
function beatX(b){return RG.x0+b*unit();}
function drawRhythm(playhead){
  const svg=$("rStaff");svg.innerHTML="";const u=unit(),beats=R.measures*4,W=rWidth();
  svg.setAttribute("viewBox","0 0 "+W+" 150");
  el("line",{x1:8,x2:W-8,y1:RG.L,y2:RG.L,stroke:"var(--staff)","stroke-width":1.6},svg);
  [["4",RG.L-4],["4",RG.L+22]].forEach(([n,y])=>{const t=el("text",{x:22,y,"font-size":26,"font-weight":800,"font-family":"Baloo 2, sans-serif",fill:"var(--staff)","text-anchor":"middle"},svg);t.textContent=n;});
  for(let m=1;m<=R.measures;m++){const x=beatX(m*4)-4;el("line",{x1:x,x2:x,y1:RG.L-26,y2:RG.L+26,stroke:"var(--staff)","stroke-width":m===R.measures?3:1.6},svg);}
  for(let b=0;b<beats;b++){const t=el("text",{x:beatX(b)+u*.15,y:RG.L+48,"font-size":14,"font-weight":700,"font-family":"Nunito, sans-serif",fill:"var(--muted)","text-anchor":"middle"},svg);t.textContent=(b%4)+1;}
  if(playhead!=null){el("rect",{x:beatX(playhead)+u*.3-u*.3,y:RG.L-44,width:3,height:80,rx:1.5,fill:"var(--sol)",id:"ph"},svg);}
  R.seq.forEach((s,i)=>{
    const cols=R.hits?(j=>{const h=R.hits.find(h=>h.i===i&&h.j===j);return h?(h.ok?"var(--ok)":"var(--bad)"):null;}):null;
    drawGroup(svg,s.k,{x:beatX(s.beat)+u*.15,unit:u,sp:RG.sp,y:()=>RG.L,restMid:RG.L,single:true,dotUp:()=>true,cols});
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
  const on0=onsets().map(o=>o.t).sort((a,b)=>a-b);let gap=1;for(let q=1;q<on0.length;q++)gap=Math.min(gap,on0[q]-on0[q-1]);const tol=Math.min(.2,R.bd*.3,gap*R.bd*.5);const used=new Set();const on=onsets();
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

/* ================= PARTITION ================= */
const P={clef:store.get("p_clef","sol"),
  sel:{sol:new Set(store.get("p_sel_sol",[28,32])),fa:new Set(store.get("p_sel_fa",[21,25]))},
  figs:new Set(store.get("p_figs",["noire","blanche"])),
  bpm:60,measures:2,names:false,metro:true,seq:[],busy:false,cur:-1,revealed:new Set()};

function pNoteChips(){
  const box=$("pChips");box.innerHTML="";const c=CLEF[P.clef];
  for(let s=c.range[0];s<=c.range[1];s++){
    const b=document.createElement("button");b.className="chip";b.id="pchip-"+P.clef+"-"+s;b.setAttribute("aria-pressed",P.sel[P.clef].has(s));
    const svg=document.createElementNS(SVGNS,"svg");svg.setAttribute("viewBox","0 0 64 70");b.appendChild(svg);
    drawStaff(svg,{sp:7,bottomY:50,x0:4,x1:60,notes:[{off:s-c.bottom,x:34,fill:COL[keyOf(s)]}]});
    const lab=document.createElement("span");lab.textContent=FR[keyOf(s)];b.appendChild(lab);
    b.onclick=()=>{if(P.busy)return;const set=P.sel[P.clef];set.has(s)?set.delete(s):set.add(s);store.set("p_sel_"+P.clef,[...set]);pNoteChips();newScore();};
    box.appendChild(b);
  }
}
function pFigChips(){
  const box=$("pFigChips");box.innerHTML="";
  Object.keys(FIG).forEach(k=>{
    const f=FIG[k];const b=document.createElement("button");b.className="chip";b.id="pfig-"+k;b.setAttribute("aria-pressed",P.figs.has(k));
    const svg=document.createElementNS(SVGNS,"svg");svg.setAttribute("viewBox","0 0 80 56");b.appendChild(svg);
    el("line",{x1:4,x2:76,y1:40,y2:40,stroke:"var(--staff)","stroke-width":1.2},svg);
    {const mo=Math.max(...f.it.map(i=>i[0]));const u=mo?46/(mo*.72):0;drawGroup(svg,k,{x:mo?17:40,unit:u,sp:8,y:()=>40,restMid:40,single:true,dotUp:()=>true});}
    const lab=document.createElement("span");lab.textContent=f.name;b.appendChild(lab);
    const tt=document.createElement("span");tt.className="t";tt.textContent=TEMPS(f.d);b.appendChild(tt);
    b.onclick=()=>{if(P.busy)return;P.figs.has(k)?P.figs.delete(k):P.figs.add(k);store.set("p_figs",[...P.figs]);pFigChips();newScore();};
    box.appendChild(b);
  });
}
function pSetClef(k){if(P.busy)return;P.clef=k;store.set("p_clef",k);$("pclef-sol").setAttribute("aria-pressed",k==="sol");$("pclef-fa").setAttribute("aria-pressed",k==="fa");pNoteChips();newScore();}
$("pclef-sol").onclick=()=>pSetClef("sol");$("pclef-fa").onclick=()=>pSetClef("fa");

function pMsg(t,cls){const f=$("pFeedback");f.className="feedback"+(cls?" "+cls:"");f.textContent=t;}
function newScore(){
  P.revealed=new Set();P.cur=-1;
  const notes=[...P.sel[P.clef]].sort((a,b)=>a-b),figs=[...P.figs];
  if(notes.length<1||!figs.some(k=>!FIG[k].rest)){P.seq=[];drawScore();pMsg(notes.length<1?"Choisis au moins une note.":"Choisis au moins une figure qui se joue.");pBtns();return;}
  let seq,tries=0;
  do{seq=fillMeasures(figs,P.measures);tries++;}
  while(seq.every(s=>FIG[s.k].rest)&&tries<40);
  let last=null,rep=0;
  const pick=()=>{let s,guard=0;do{s=notes[Math.floor(Math.random()*notes.length)];guard++;}while(notes.length>1&&s===last&&rep>=1&&guard<20);rep=(s===last)?rep+1:0;last=s;return s;};
  seq.forEach(e=>{e.p=FIG[e.k].heads.map(()=>pick());});
  P.seq=seq;drawScore();pMsg("Écoute le piano, puis lis la partition en disant le nom des notes.");pBtns();
}
function pEvents(){const out=[];P.seq.forEach((e,i)=>{let j=0;FIG[e.k].it.forEach(([o,d,v])=>{if(v[0]==="r")out.push({i,j:-1,t:e.beat+o,d,rest:true});else{out.push({i,j,t:e.beat+o,d,step:e.p[j]});j++;}});});return out;}

const PS={sp:10,sysH:152,topPad:50};
function drawScore(){
  const svg=$("pStaff");svg.innerHTML="";const sp=PS.sp;const c=CLEF[P.clef];
  const perSys=(P.measures===1||P.seq.some(e=>FIG[e.k].it.length>1))?1:2,systems=Math.ceil(P.measures/perSys);
  svg.setAttribute("viewBox","0 0 360 "+(systems*PS.sysH+6));
  for(let s=0;s<systems;s++){
    const top=s*PS.sysH+PS.topPad,bottom=top+4*sp;
    for(let i=0;i<5;i++)el("line",{x1:6,x2:354,y1:bottom-i*sp,y2:bottom-i*sp,stroke:"var(--staff)","stroke-width":1.3},svg);
    const ct=el("text",{x:10,y:P.clef==="sol"?bottom-sp:bottom-3*sp,"font-size":sp*4,"font-family":"Noto Music, Bravura, serif",fill:"var(--staff)"},svg);ct.textContent=c.glyph;
    const x0=s===0?72:52;
    if(s===0)[top+sp*1.9,top+sp*3.9].forEach(y=>{const t=el("text",{x:55,y,"font-size":21,"font-weight":800,"font-family":"Baloo 2, sans-serif",fill:"var(--staff)","text-anchor":"middle"},svg);t.textContent="4";});
    const unit=(350-x0)/(perSys*4);
    const mInSys=Math.min(perSys,P.measures-s*perSys);
    for(let m=1;m<=mInSys;m++){const x=x0+m*4*unit-3;const last=s*perSys+m===P.measures;el("line",{x1:x,x2:x,y1:top,y2:bottom,stroke:"var(--staff)","stroke-width":last?3:1.3},svg);if(last)el("line",{x1:x-5,x2:x-5,y1:top,y2:bottom,stroke:"var(--staff)","stroke-width":1.2},svg);}
    P.seq.forEach((e,i)=>{
      const sys=Math.floor(Math.floor(e.beat/4)/perSys);if(sys!==s)return;
      const lb=e.beat-s*perSys*4;const x=x0+lb*unit+unit*.16;
      drawScoreEvent(svg,e,i,x,unit,bottom,sp,c);
    });
  }
}
function drawScoreEvent(svg,e,i,x,unit,bottom,sp,c){
  const f=FIG[e.k];const mid=bottom-2*sp;
  const on=P.cur===i;const col=on?"var(--sol)":"var(--ink)";
  const mo=Math.max(...f.it.map(q=>q[0]));
  if(on)el("rect",{x:x-sp*1.1,y:bottom-4*sp-30,width:mo*unit*.72+sp*2.2,height:4*sp+60,rx:8,fill:"var(--sol)",opacity:.14},svg);
  const offs=e.p.map(s=>s-c.bottom);
  const up=offs.length?(offs.reduce((a,b)=>a+b,0)/offs.length)<4:true;
  const ledger=(hx,j)=>{const o=offs[j];const lw=sp*1.05;if(o<=-2)for(let v=-2;v>=o;v-=2)el("line",{x1:hx-lw,x2:hx+lw,y1:bottom-v*sp/2,y2:bottom-v*sp/2,stroke:"var(--staff)","stroke-width":1.3},svg);if(o>=10)for(let v=10;v<=o;v+=2)el("line",{x1:hx-lw,x2:hx+lw,y1:bottom-v*sp/2,y2:bottom-v*sp/2,stroke:"var(--staff)","stroke-width":1.3},svg);};
  const label=(hx,j)=>{const key=keyOf(e.p[j]);if(!(P.names||P.revealed.has(i+":"+j)))return;
    const t=el("text",{x:hx,y:bottom+sp*3.6+((f.dense&&j%2)?14:0),"text-anchor":"middle","font-size":f.dense?12:14,"font-weight":800,"font-family":"Baloo 2, sans-serif",fill:COL[key]},svg);t.textContent=FR[key];};
  drawGroup(svg,e.k,{x,unit,sp,col,up,restMid:mid,y:j=>bottom-offs[j]*sp/2,ledger,label,dotUp:j=>offs[j]%2===0});
}
function pBtns(){const empty=!P.seq.length;["pListen","pRead"].forEach(id=>$(id).disabled=P.busy||empty);$("pNew").disabled=P.busy;$("pStop").hidden=!P.busy;}

let pRaf=null;
function playScore(listen){
  const a=clock();if(!a||!P.seq.length||P.busy)return;
  P.busy=true;P.stop=false;P.revealed=new Set();P.cur=-1;drawScore();pBtns();
  const bd=60/P.bpm,beats=P.measures*4,t0=a.currentTime+.15,T=t0+4*bd;
  const evs=pEvents();const nodes=[];
  for(let i=0;i<4;i++)blip(i===0?1800:1300,t0+i*bd,.05,.25,"square");
  if(P.metro||!listen)for(let i=0;i<beats;i++)blip(i%4===0?1500:1100,T+i*bd,.04,.06,"square");
  if(listen)evs.forEach(ev=>{if(!ev.rest)playStep(ev.step,T+ev.t*bd,Math.max(.35,ev.d*bd*1.05));});
  pMsg(listen?"Écoute et suis les notes…":"Dis le nom de chaque note, en rythme !");
  const cnt=$("pCount");const end=T+beats*bd+.2;
  (function tick(){
    const now=a.currentTime;
    if(P.stop){finishScore(listen,true);return;}
    if(now<T){const n=Math.floor((now-t0)/bd)+1;cnt.hidden=n<1;cnt.textContent=n>=1?n:"";}
    else{
      cnt.hidden=true;const b=(now-T)/bd;let cur=-1,changed=false;
      evs.forEach(ev=>{
        const key=ev.i+":"+ev.j;
        if(b>=ev.t&&b<ev.t+ev.d)cur=ev.i;
        const reveal=listen?b>=ev.t:b>=ev.t+ev.d;
        if(reveal&&!ev.rest&&!P.revealed.has(key)){P.revealed.add(key);changed=true;}
      });
      if(cur!==P.cur){P.cur=cur;changed=true;}
      if(changed)drawScore();
    }
    if(now<end)pRaf=requestAnimationFrame(tick);else finishScore(listen,false);
  })();
}
function finishScore(listen,stopped){
  P.busy=false;P.cur=-1;$("pCount").hidden=true;
  if(!stopped)pEvents().forEach(ev=>{if(!ev.rest)P.revealed.add(ev.i+":"+ev.j);});
  drawScore();pBtns();
  if(stopped)pMsg("Arrêté.");
  else pMsg(listen?"À toi : appuie sur « À moi de lire » et dis les notes en rythme.":"Bravo ! Vérifie les noms sous les notes, puis écoute le piano pour comparer.","ok");
}
$("pListen").onclick=()=>playScore(true);$("pRead").onclick=()=>playScore(false);
$("pStop").onclick=()=>{P.stop=true;if(ctx&&ctx.suspend&&false)ctx.suspend();};
$("pNew").onclick=()=>{newScore();if(P.autoplay)setTimeout(()=>playScore(true),250);};
$("pBpm").oninput=e=>{P.bpm=+e.target.value;$("pBpmOut").textContent=P.bpm+" à la noire";};
function pSetLen(n){if(P.busy)return;P.measures=n;[1,2,4].forEach(k=>$("plen-"+k).setAttribute("aria-pressed",k===n));newScore();}
[1,2,4].forEach(k=>$("plen-"+k).onclick=()=>pSetLen(k));
P.autoplay=store.get("p_auto",true);
bindToggle("pNames",()=>P.names,v=>{P.names=v;drawScore();});
bindToggle("pMetro",()=>P.metro,v=>{P.metro=v;});
bindToggle("pAuto",()=>P.autoplay,v=>{P.autoplay=v;store.set("p_auto",v);});
$("pclef-sol").setAttribute("aria-pressed",P.clef==="sol");$("pclef-fa").setAttribute("aria-pressed",P.clef==="fa");
pNoteChips();pFigChips();newScore();
})();
