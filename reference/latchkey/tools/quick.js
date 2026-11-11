// dev helper: run a swarm in Node (no browser). usage: node tools/quick.js <stage 1-4|gym|all> [seed] [simfile]
const path=require('path');const S=require(path.resolve(process.argv[4]||'sim.js'));
const arg=process.argv[2]||'gym', seed=+(process.argv[3]||101);
const list=arg==='all'?S.STAGES.map((_,i)=>i):[arg==='gym'?'gym':+arg-1];
for(const s of list){const t0=Date.now();const sw=S.createSwarm(s,seed,100);while(!sw.over)sw.step();const r=S.swarmStats(sw);
const far={};for(const d of sw.deaths){const k=Math.floor(d.x/32)+','+Math.floor(d.y/32)+':'+d.c;far[k]=(far[k]||0)+1;}
console.log(s,sw.st.name,'pass',r.pass,'low/mid/high',r.passLow+'/'+r.nLow,r.passMid+'/'+r.nMid,r.passHigh+'/'+r.nHigh,'frames',r.frames,'avg',r.avgFinishSec,JSON.stringify(r.causes),'stuck',r.stuck,'emb',r.embedded,'warp',r.warp,'early',r.earlyexit,(Date.now()-t0)+'ms');
console.log('   deaths by cell:',Object.entries(far).sort((a,b)=>b[1]-a[1]).slice(0,8).map(e=>e.join(' x')).join('  '));}
