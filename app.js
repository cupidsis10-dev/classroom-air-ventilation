const $=id=>document.getElementById(id);
const select=$("mealSelect");

function pmGrade(v){if(v<=15)return "좋음";if(v<=35)return "보통";if(v<=75)return "나쁨";return "매우 나쁨";}
function co2Text(v){return v<=1000?"교실 기준 이하":"교실 기준보다 높음";}
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
 co2:+$("co2").value,pmIn:+$("pmIn").value,pmOut:+$("pmOut").value,odor:+$("odor").value,
 students:+$("students").value,volume:+$("volume").value,ach:Math.max(.1,+$("ach").value),
 odorTarget:+$("odorTarget").value,ventMinutes:+$("ventMinutes").value
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
 const co2Max=Math.max(...data.map(d=>d.co2),1000),pmMax=Math.max(...data.map(d=>d.pm),35,1);
 const W=820,H=220,pad=20,ns="http://www.w3.org/2000/svg";
 const pts=(key,max)=>data.map(d=>`${pad+(W-2*pad)*(d.t/30)},${H-pad-(H-2*pad)*(d[key]/max)}`).join(" ");
 const axis=document.createElementNS(ns,"line");axis.setAttribute("x1",pad);axis.setAttribute("x2",W-pad);axis.setAttribute("y1",H-pad);axis.setAttribute("y2",H-pad);axis.setAttribute("stroke","#dfe3e8");svg.appendChild(axis);
 [["co2",co2Max,"#1d6f5f"],["odor",100,"#8b5e34"],["pm",pmMax,"#6c7480"]].forEach(([k,m,c])=>{
  const pl=document.createElementNS(ns,"polyline");pl.setAttribute("points",pts(k,m));pl.setAttribute("fill","none");pl.setAttribute("stroke",c);pl.setAttribute("stroke-width","3");pl.setAttribute("stroke-linecap","round");pl.setAttribute("stroke-linejoin","round");svg.appendChild(pl);
 });
 [["CO₂","#1d6f5f"],["냄새","#8b5e34"],["PM2.5","#6c7480"]].forEach((it,i)=>{const tx=document.createElementNS(ns,"text");tx.setAttribute("x",pad+i*90);tx.setAttribute("y",15);tx.setAttribute("fill",it[1]);tx.setAttribute("font-size","12");tx.textContent=it[0];svg.appendChild(tx);});
}
function findRecommendedTime(p){
 const candidates=[];
 for(let t=5;t<=60;t+=5) candidates.push({t,...simulate(t,p)});
 return candidates.find(r=>r.co2<=1000&&r.pm<=35&&r.odor<=p.odorTarget) || null;
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
function openRecommendModal(){
 $("recommendModal").classList.add("show");
}
function closeRecommendModal(){
 $("recommendModal").classList.remove("show");
}
function update(){
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

 const durations=[0,5,10,15,20],results=durations.map(t=>({t,...simulate(t,p)}));
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
 if($("recommendToggle").checked){
  openRecommendModal();
 }else{
  $("recommendResult").classList.remove("show");
  $("recommendResult").textContent="";
 }
});
$("recommendYes").addEventListener("click",()=>{
 closeRecommendModal();
 updateRecommendation(params());
});
$("recommendNo").addEventListener("click",()=>{
 $("recommendToggle").checked=false;
 closeRecommendModal();
 $("recommendResult").classList.remove("show");
 $("recommendResult").textContent="";
});
$("recommendModal").addEventListener("click",(e)=>{
 if(e.target===$("recommendModal")){
  $("recommendToggle").checked=false;
  closeRecommendModal();
 }
});
update();
