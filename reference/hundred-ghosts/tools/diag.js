// dev helper: ASCII map + trace of one bot. usage: node tools/diag.js <stage 1-8> [bot] [seed] [fromTile] [toTile]
const S=require(require('path').resolve('sim.js'));const s=+process.argv[2]-1,bi=+(process.argv[3]||99),seed=+(process.argv[4]||101);
const st=S.STAGES[s];const a=+(process.argv[5]||0),b=+(process.argv[6]||st.W);
for(let ty=0;ty<S.ROWS;ty++){let l='';for(let tx=a;tx<Math.min(b,st.W);tx++)l+=' #^~P'[S.tile(st,tx,ty)];if(l.trim())console.log(String(ty).padStart(2),l);}
let l='   ';for(let tx=a;tx<Math.min(b,st.W);tx++)l+=tx%10===0?String(tx/10%10|0):tx%5===0?'+':'.';console.log(l);
console.log('saws',st.saws.map(x=>[x.x/32,x.y/32,x.ax/32,x.ay/32,x.orbit/32,x.period,x.phase].map(v=>+v.toFixed(1)).join('/')).join('  '));
console.log('plats',st.plats.map(x=>[x.x/32,x.y/32,x.w/32,x.ax/32,x.ay/32,x.period,x.phase].join('/')).join('  '));
console.log('lasers',st.lasers.map(x=>[(x.x/32).toFixed(1),x.period,x.on,x.phase].join('/')).join('  '));
const sw=S.createSwarm(s,seed,100),bot=sw.bots[bi];let out=[];
while(!sw.over&&bot.p.alive&&!bot.p.done){sw.step();if(sw.t%10===0)out.push(`${sw.t}:${(bot.p.x/32).toFixed(1)},${(bot.p.y/32).toFixed(1)}${bot.p.ground?'g':'a'}`);}
console.log('bot',bi,'skill',bot.skill.toFixed(2),'risk',bot.risk.toFixed(2),'end',bot.p.done?'GOAL':bot.p.cause,'t',sw.t,'x tile',(bot.p.x/32).toFixed(1));
console.log(out.slice(-40).join(' '));
