// Hand-calculated checks for the Irish tax and housing rules in ireland.html.
// Run with:  node tests/ireland-engine.test.js
// The engine is read out of the page itself, so the tests always cover what ships.
const fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','ireland.html'),'utf8');
const a=html.indexOf('/* ══ IRISH RULES AND SIMULATION ENGINE');
const marker="if(typeof module!=='undefined')module.exports={tyParams";
const b=html.indexOf(marker,a);
if(a<0||b<0){console.error('Could not find the engine block in ireland.html');process.exit(1);}
const code=html.slice(a,html.indexOf('\n',b)+1);
const S={bandIndex:3,genInfl:2.5,wageGrowth:3,spWeekly:309.3,spGrowth:3,startYear:2026,status:'married',endAge:90,useStress:false,stressRate:3,catUsed:0,fhsCharge:0,incomes:[]};
const mod={exports:{}};
vm.runInNewContext(code,{module:mod,S,Math,Infinity,console});
const E=mod.exports;
let fails=0;
const near=(label,got,want,tol=0.5)=>{const ok=Math.abs(got-want)<=tol;if(!ok)fails++;console.log((ok?'ok   ':'FAIL ')+label+': got '+got.toFixed(2)+' want '+want.toFixed(2));};

const P26=E.tyParams(2026),P27=E.tyParams(2027),P28=E.tyParams(2028);
const single=(P,age,salary,extra={})=>E.householdTax(P,[Object.assign({age,salary,relief:0,sp:0,pens:0,other:0,card:false},extra)],false,0);

// 1. Single, 2027, salary 60,000
let t=single(P27,35,60000);
near('2027 single 60k income tax',t.it,10450);
near('2027 single 60k USC',t.usc,1316.82,0.05);
near('2027 single 60k PRSI',t.prsi,2632.5,0.05);
// 2. 2026 same salary
t=single(P26,35,60000);
near('2026 single 60k income tax',t.it,11200);
near('2026 single 60k USC',t.usc,1332.82,0.05);
near('2026 single 60k PRSI',t.prsi,2542.5,0.05);
// 3. Married one earner 80,000 (2027)
t=E.householdTax(P27,[{age:40,salary:80000,relief:0,sp:0,pens:0,other:0},{age:40,salary:0,relief:0,sp:0,pens:0,other:0}],true,0);
near('2027 married one earner 80k income tax',t.it,14525);
// 4. Married two earners 60k + 40k
t=E.householdTax(P27,[{age:40,salary:60000,relief:0,sp:0,pens:0,other:0},{age:40,salary:40000,relief:0,sp:0,pens:0,other:0}],true,0);
near('2027 married 60k+40k income tax',t.it,12900);
// 5. Age exemption: both 70, State Pension only 32,000
t=E.householdTax(P27,[{age:70,salary:0,relief:0,sp:16000,pens:0,other:0},{age:70,salary:0,relief:0,sp:16000,pens:0,other:0}],true,0);
near('couple 70, SP only, exempt',t.it,0);
near('couple 70, SP only, USC (SP exempt)',t.usc,0);
// 6. Marginal relief: 40,000 pension income, both 70
t=E.householdTax(P27,[{age:70,salary:0,relief:0,sp:0,pens:20000,other:0},{age:70,salary:0,relief:0,sp:0,pens:20000,other:0}],true,0);
near('couple 70, 40k pensions, marginal relief tax',t.it,1600);
// 7. USC reduced rate at 70+: 30,000 pension income
t=single(P27,71,0,{pens:30000});
near('age 71, 30k pension USC reduced',t.usc,.005*12012+.02*(30000-12012),0.05);
// 8. Pension relief by age
near('relief age 35',E.reliefPct(35),.20,1e-9);near('relief age 60',E.reliefPct(60),.40,1e-9);near('relief age 29',E.reliefPct(29),.15,1e-9);
// 9. Own pension flows: salary 60k age 45, 5% each
let f=E.pensionFlows({pensionMode:'own',eePct:5,erPct:5},45,60000,2027,P27);
near('own pension ee',f.ee,3000);near('own pension relief (25% cap not binding)',f.relief,3000);near('own pension er',f.er,3000);
f=E.pensionFlows({pensionMode:'own',eePct:30,erPct:0},45,60000,2027,P27);
near('own pension relief capped at 25%',f.relief,15000);
// 10. Auto-enrolment
f=E.pensionFlows({pensionMode:'autoenrol'},30,50000,2026,P26);
near('AE 2026 employee',f.ee,750);near('AE 2026 employer',f.er,750);near('AE 2026 state',f.st,250);
f=E.pensionFlows({pensionMode:'autoenrol'},30,50000,2029,E.tyParams(2029));
near('AE 2029 employee 3%',f.ee,1500);
f=E.pensionFlows({pensionMode:'autoenrol'},22,50000,2026,P26);
near('AE under 23 not enrolled',f.ee,0);
f=E.pensionFlows({pensionMode:'autoenrol'},30,100000,2026,P26);
near('AE capped at 80k',f.ee,1200);
// 11. Mortgage and stamp duty
near('mortgage 300k 4% 30y',E.mortgagePayment(300000,4,30),1432.25,0.01);
near('stamp duty 400k',E.stampDuty(400000),4000);
near('stamp duty 1.2m',E.stampDuty(1200000),10000+4000);
// 12. State Pension
near('SP 2027 single person 66',E.statePension({spAge:66,spPct:100},66,2027,2),309.3*52,0.01);
near('SP 2027 living alone',E.statePension({spAge:66,spPct:100},66,2027,1),(309.3+25)*52,0.01);
near('SP age 80',E.statePension({spAge:66,spPct:100},80,2027,2),(319.3)*52,0.01);
near('SP 2028 grows 3%',E.statePension({spAge:66,spPct:100},66,2028,2),309.3*52*1.03,0.01);
near('SP 50% entitlement',E.statePension({spAge:66,spPct:50},66,2027,2),309.3*26,0.01);
// 13. Rent credit
t=E.householdTax(P27,[{age:30,salary:60000,relief:0,sp:0,pens:0,other:0}],false,1150);
near('rent credit applied',t.it,10450-1150);
t=E.householdTax(P27,[{age:30,salary:20000,relief:0,sp:0,pens:0,other:0}],false,1150);
near('rent credit cannot exceed tax',t.it,0);
// 14. 2029 scaling
near('2029 single band scales 2 yrs at 3%',P28.cut.single,46500*1.03,0.01);
near('2029 rent credit ends after 2028',E.tyParams(2029).cr.rent1,0);

console.log(fails?('\n'+fails+' FAILURES'):'\nALL HAND CHECKS PASSED');
// 15. Whole-simulation checks
const hs0={mode:'rent',rentMonthly:0,rentInfl:3,rtc:false,buyAge:34,price:420000,newBuild:true,ceiling:475000,houseGrowth:3,depositPct:10,useHTB:true,useFHS:true,fhsPct:20,mortRate:4,mortTerm:30,costsPct:1.5,runPct:1};
const person={id:1,name:'A',currentAge:33,retireAge:66,deathAge:88,salary:115000,pensionMode:'none',eePct:0,erPct:0,card:false,spAge:66,spPct:100};
Object.assign(S,{status:'single',people:[person],incomes:[],accounts:[{id:1,label:'Deposit',type:'deposit',owner:0,balance:100000,rate:2.5,feePct:0,regular:0,saveTo:'',growth:'nominal',drawOrder:1}],
  scenarios:[{id:1,name:'t',housing:Object.assign({},hs0,{mode:'buy'}),expenses:[],cashEvents:[],marketEvents:[]}],activeScenario:0});
let rows=E.simulateIE(0);
// price 420,000 grown 1 year at 3% = 432,600. Deposit 10%, scheme 20%, mortgage is the remaining 70%.
near('FHS + HTB: price',rows.bought.price,432600,0.01);
near('FHS + HTB: scheme share',rows.bought.fhsPct,0.20,1e-9);
near('FHS + HTB: Help to Buy refund',rows.bought.htb,35000);
near('FHS + HTB: mortgage',rows.bought.mort,432600*0.70,0.01);
// Same purchase after the scheme closes (2029): no equity share, mortgage is 90% of the price
S.scenarios[0].housing.buyAge=36;rows=E.simulateIE(0);
near('FHS closed in 2029: scheme share',rows.bought.fhsPct,0);
near('FHS closed in 2029: mortgage',rows.bought.mort,420000*Math.pow(1.03,3)*0.90,0.01);
// CAT: 800,000 gift from a parent in 2033 (age 40). Threshold 420,000 and the 3,000 exemption both scale 1.03^6.
S.scenarios[0].housing.mode='rent';
S.scenarios[0].cashEvents=[{id:1,dir:'in',type:'gift',group:'A',age:40,amount:800000,label:'gift'}];
rows=E.simulateIE(0);
const f6=Math.pow(1.03,6);
near('CAT on 800k gift',rows.find(r=>r.age===40).cat,.33*(800000-3000*f6-420000*f6),1);

console.log(fails?('\n'+fails+' FAILURES'):'\nALL SIMULATION CHECKS PASSED');process.exit(fails?1:0);
