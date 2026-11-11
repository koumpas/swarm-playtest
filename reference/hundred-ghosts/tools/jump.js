// dev helper: measured jump numbers on flat ground (stage 1 start). usage: node tools/jump.js [simfile]
const S=require(require('path').resolve(process.argv[2]||'sim.js'));const st=S.STAGES[0];
function jump(run,hold){const p=S.newPlayer(st);p.x=64;let t=0;for(;t<30;t++)S.step(st,p,0,false,t,t);const y0=p.y;for(let i=0;i<run;i++,t++)S.step(st,p,1,false,t,t);const x0=p.x;let top=0,f=0;
for(;;t++,f++){S.step(st,p,1,f<hold,t,t);top=Math.max(top,y0-p.y);if(f>2&&p.ground)break;if(f>200)break;}return{dist:+(p.x-x0).toFixed(0),top:+top.toFixed(0),frames:f};}
for(const run of [0,20])for(const hold of [2,6,12,22])console.log('run-up frames',run,'hold',hold,JSON.stringify(jump(run,hold)));
