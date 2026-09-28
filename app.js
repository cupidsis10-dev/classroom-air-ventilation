const $=id=>document.getElementById(id);
const select=$("mealSelect");

const mealOrder={"중식":0,"석식":1};
[...select.options]
 .sort((a,b)=>{
  const ma=meals[Number(a.value)],mb=meals[Number(b.value)];
  return ma.date.localeCompare(mb.date)||(mealOrder[ma.meal]??9)-(mealOrder[mb.meal]??9);
 })
 .forEach(option=>select.appendChild(option));

const LIMITS={
 co2:{min:400,max:5000,label:"CO₂",unit:"ppm"},
 pmIn:{min:0,max:500,label:"실내 PM2.5",unit:"μg/m³"},
 pmOut:{min:0,max:500,label:"외부 PM2.5",unit:"μg/m³"},
 odor:{min:0,max:100,label:"음식 냄새 정도",unit:"%"},
 students:{min:0,max:60,label:"사람 수",unit:"명"},
 volume:{min:50,max:500,label:"교실 부피",unit:"m³"},
 ach:{min:0.1,max:20,label:"환기 세기",unit:"ACH"}
};

function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function safeNumber(id,fallback){const v=Number($(id).value);return Number.isFinite(v)?v:fallback;}
function limitedValue(id,fallback){
 const rule=LIMITS[id];
 return clamp(safeNumber(id,fallback),rule.min,rule.max);
}
function pmGrade(v){if(v<=15)return "좋음";if(v<=35)return "보통";if(v<=75)return "나쁨";return "매우 나쁨";}
function co2Text(v){return v<=1000?"교실 기준 이하":"교실 기준보다 높음";}

function ensureWarningBox(){
 let box=$("inputWarning");
 if(box)return box;
 box=document.createElement("div");
 box.id="inputWarning";
 box.className="input-warning";
 const card=$("co2").closest(".card");
 card.appendChild(box);
 return box;
}
function validateInputs(){
 const messages=[];
 Object.entries(LIMITS).forEach(([id,rule])=>{
  const el=$(id),raw=Number(el.value);
  const bad=!Number.isFinite(raw)||raw<rule.min||raw>rule.max;
  el.classList.toggle("input-out-of-range",bad);
  el.setAttribute("aria-invalid",bad?"true":"false");
  if(bad){
   const shown=Number.isFinite(raw)?`${raw} ${rule.unit}`:"입력값 없음";
   messages.push(`${rule.label}: ${shown} → 계산에서는 ${rule.min}~${rule.max} ${rule.unit} 범위로 제한`);
  }
 });
 const box=ensureWarningBox();
 if(messages.length){
  box.classList.add("show");
  box.innerHTML=`<b>입력값을 확인해 주세요.</b><br>${messages.join("<br>")}<span>그래프가 비정상적으로 커지는 것을 막기 위해 계산 범위를 제한했습니다.</span>`;
 }else{
  box.classList.remove("show");
  box.textContent="";
 }
}

function simulate(mins,p){
 const t=mins/60,g=0.0042;
 const sourceM3h=g/1000*3600*p.students;
 const sourcePpmH=sourceM3h/p.volume*1e6;
 const e=Math.exp(-p.ach*t);
 const eqExcess=sourcePpmH/p.ach;
 return {
   co2:420+eqExcess+(p.co2-420-eqExcess)*e,
   pm:p.pmOut+(p.pmIn-p.pmOut)*e,
   odor:p.odor*e
 };
}
function params(){return {
 co2:limitedValue("co2",1400),
 pmIn:limitedValue("pmIn",15),
 pmOut:limitedValue("pmOut",20),
 odor:limitedValue("odor",100),
 students:limitedValue("students",30),
 volume:limitedValue("volume",180),
 ach:limitedValue("ach",5),
 odorTarget:+$("odorTarget").value,
 ventMinutes:+$("ventMinutes").value
};}
function rowInterpret(r,p){
 const c=r.co2<=1000,o=r.odor<=p.odorTarget,m=r.pm<=35;
 if(c&&o&&m)return "세 조건이 모두 목표 범위";
 if(o&&m&&!c)return "냄새는 충분히 줄었지만 CO₂는 아직 높음";
 if(c&&o&&!m)return "CO₂·냄새는 좋아졌지만 초미세먼지 유입 주의";
 if(!m)return "초미세먼지가 기준보다 높아짐";
 return "CO₂와 냄새가 아직 충분히 줄지 않음";
}
function drawChart(p){
 const svg=$("chart");svg.innerHTML="";
 const data=[];for(let t=0;t<=30;t++)data.push({t,...simulate(t,p)});
 const finiteMax=(arr,fallback)=>Math.max(fallback,...arr.filter(Number.isFinite));
 const co2Max=finiteMax(data.map(d=>d.co2),1000);
 const pmMax=finiteMax(data.map(d=>d.pm),35);
 const odorMax=finiteMax(data.map(d=>d.odor),100);
 const W=820,H=220,pad=22,ns="http://www.w3.org/2000/svg";
 const yFor=(value,max)=>clamp(H-pad-(H-2*pad)*(value/Math.max(max,1)),pad,H-pad);
 const pts=(key,max)=>data.map(d=>`${pad+(W-2*pad)*(d.t/30)},${yFor(d[key],max)}`).join(" ");
 const axis=document.createElementNS(ns,"line");axis.setAttribute("x1",pad);axis.setAttribute("x2",W-pad);axis.setAttribute("y1",H-pad);axis.setAttribute("y2",H-pad);axis.setAttribute("stroke","#dfe3e8");svg.appendChild(axis);
 [["co2",co2Max,"#1d6f5f"],["odor",odorMax,"#8b5e34"],["pm",pmMax,"#6c7480"]].forEach(([k,m,c])=>{
  const pl=document.createElementNS(ns,"polyline");pl.setAttribute("points",pts(k,m));pl.setAttribute("fill","none");pl.setAttribute("stroke",c);pl.setAttribute("stroke-width","3");pl.setAttribute("stroke-linecap","round");pl.setAttribute("stroke-linejoin","round");svg.appendChild(pl);
 });
 [["CO₂","#1d6f5f"],["냄새","#8b5e34"],["PM2.5","#6c7480"]].forEach((it,i)=>{const tx=document.createElementNS(ns,"text");tx.setAttribute("x",pad+i*90);tx.setAttribute("y",15);tx.setAttribute("fill",it[1]);tx.setAttribute("font-size","12");tx.textContent=it[0];svg.appendChild(tx);});
 [0,10,20,30].forEach(t=>{const tx=document.createElementNS(ns,"text");tx.setAttribute("x",pad+(W-2*pad)*(t/30));tx.setAttribute("y",H-4);tx.setAttribute("text-anchor",t===0?"start":t===30?"end":"middle");tx.setAttribute("fill","#7b828b");tx.setAttribute("font-size","10");tx.textContent=`${t}분`;svg.appendChild(tx);});
}
function findRecommendedTime(p){
 const candidates=[];
 for(let t=5;t<=60;t+=5)candidates.push({t,...simulate(t,p)});
 return candidates.find(r=>r.co2<=1000&&r.pm<=35&&r.odor<=p.odorTarget)||null;
}
function updateRecommendation(p){
 const box=$("recommendResult");
 if(!$("recommendToggle").checked){box.classList.remove("show");box.textContent="";return;}
 const rec=findRecommendedTime(p);
 box.classList.add("show");
 if(rec){
  box.innerHTML=`<b>시뮬레이션상 적정 환기 시간: 약 ${rec.t}분</b><br>이 시간부터 CO₂ 1,000 ppm 이하, PM2.5 35 μg/m³ 이하, 설정한 냄새 감소 목표를 함께 만족합니다.<br><span class="mini">실제 교실에서는 바람과 창문 상태에 따라 달라질 수 있습니다.</span>`;
 }else{
  box.innerHTML=`<b>현재 조건에서는 60분 이내에 세 목표를 동시에 만족하는 시간을 찾지 못했습니다.</b><br><span class="mini">특히 외부 초미세먼지가 높은 경우 한 가지 환기 시간만으로 모든 조건을 만족하기 어려울 수 있습니다.</span>`;
 }
}
function openRecommendModal(){$("recommendModal").classList.add("show");}
function closeRecommendModal(){$("recommendModal").classList.remove("show");}
function update(){
 validateInputs();
 const p=params(),m=meals[+select.value];
 $("mealMenu").textContent=m.menu.join(" · ");
 const src=m.sources.length?m.sources:["메뉴명만으로 특정하기 어려움"];
 $("mealBadge").textContent=`냄새원 후보 ${src.length}종`;
 $("sourceBox").innerHTML="<b>메뉴명에서 확인한 냄새원 후보</b><br>"+src.join(" · ")+"<br><span class='mini'>이 분류는 실제 냄새 농도를 뜻하지 않고, 어떤 종류의 냄새원이 있을 수 있는지 확인하기 위한 것입니다.</span>";
 $("mMeal").textContent=m.sources.length?`${m.sources.length}종`:"특정 어려움";
 $("mCo2").textContent=`${Math.round(p.co2)} ppm`;
 $("mCo2Note").textContent=co2Text(p.co2);
 $("mPm").textContent=pmGrade(p.pmOut);
 $("mPmNote").textContent=`${p.pmOut} μg/m³ · 에어코리아 구간`;

 const durations=[0,5,10,15,20,25,30],results=durations.map(t=>({t,...simulate(t,p)}));
 const tbody=$("tableBody");tbody.innerHTML="";
 results.forEach(r=>{
  const tr=document.createElement("tr");
  tr.innerHTML=`<td>${r.t}분</td><td>${Math.round(r.co2)} ppm</td><td>${r.odor.toFixed(0)}%</td><td>${r.pm.toFixed(1)} μg/m³</td><td>${rowInterpret(r,p)}</td>`;
  tbody.appendChild(tr);
 });
 const chosen=simulate(p.ventMinutes,p);
 const chosenText=rowInterpret(chosen,p);
 $("decision").textContent=`${p.ventMinutes}분 환기 후 예상`;
 $("reason").textContent=chosenText;
 $("selectedResult").innerHTML=`<b>${p.ventMinutes}분 뒤 계산값</b><p>CO₂ 약 ${Math.round(chosen.co2)} ppm · 냄새 약 ${chosen.odor.toFixed(0)}% · 실내 PM2.5 약 ${chosen.pm.toFixed(1)} μg/m³</p>`;

 updateRecommendation(p);
 drawChart(p);
}
["mealSelect","co2","pmIn","pmOut","odor","students","volume","ach","odorTarget","ventMinutes"].forEach(id=>$(id).addEventListener("input",update));

$("recommendToggle").addEventListener("change",()=>{
 if($("recommendToggle").checked){openRecommendModal();}
 else{$("recommendResult").classList.remove("show");$("recommendResult").textContent="";}
});
$("recommendYes").addEventListener("click",()=>{closeRecommendModal();updateRecommendation(params());});
$("recommendNo").addEventListener("click",()=>{$("recommendToggle").checked=false;closeRecommendModal();$("recommendResult").classList.remove("show");$("recommendResult").textContent="";});
$("recommendModal").addEventListener("click",e=>{if(e.target===$("recommendModal")){$("recommendToggle").checked=false;closeRecommendModal();}});
update();
