// dev helper: trace one bot. usage: node tools/trace.js <stage 1-4|gym> <bot> [seed] [every] [simfile]
const path=require('path');const S=require(path.resolve(process.argv[6]||'sim.js'));
const a=process.argv[2]||'gym',s=a==='gym'?'gym':+a-1,bi=+(process.argv[3]||50),seed=+(process.argv[4]||101),ev=+(process.argv[5]||20);
const sw=S.createSwarm(s,seed,100),b=sw.bots[bi];
while(!sw.over&&b.p.alive&&!b.p.done){sw.step();if(sw.t%ev===0||!b.p.alive||b.p.done)console.log('t',sw.t,'cell',(b.p.x/32).toFixed(1),(b.p.y/32).toFixed(1),'v',b.p.vx.toFixed(1),b.p.vy.toFixed(1),'keys',b.p.keys.toString(2),'tg',b.tg,'plan',JSON.stringify(b.plan),b.p.alive?'':'DEAD '+b.p.cause,b.p.done?'DONE':'');}
