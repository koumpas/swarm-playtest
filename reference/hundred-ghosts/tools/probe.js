// dev helper: where do bots end on one stage, per tier. usage: [SEEDS=20] node tools/probe.js <stage 1-8> [simfile] [rows]
const S=require(require('path').resolve(process.argv[3]||'sim.js'));const s=+process.argv[2]-1;const spots={};let pass=[0,0,0],tot=[0,0,0];
const NSEEDS=+(process.env.SEEDS||5);const SEEDLIST=Array.from({length:NSEEDS},(_,k)=>101*(k+1)); // SEEDS=20 for a larger sample; the first 5 are the seeds of record
for(const seed of SEEDLIST){const sw=S.createSwarm(s,seed,100);while(!sw.over)sw.step();for(const b of sw.bots){const k=S.tierOf(b,100);tot[k]++;if(b.p.done)pass[k]++;}
for(const d of sw.deaths){const k=Math.floor(d.x/32)+':'+d.c;(spots[k]=spots[k]||[0,0,0])[S.tierOf({i:d.i},100)]++;}}
console.log(S.STAGES[s].name,'pass% low/mid/high',pass.map((p,i)=>(100*p/tot[i]).toFixed(1)).join(' / '));
console.log(Object.entries(spots).sort((a,b)=>(b[1][0]+b[1][1]+b[1][2])-(a[1][0]+a[1][1]+a[1][2])).slice(0,+(process.argv[4]||12)).map(([k,v])=>k.padEnd(12)+' low '+v[0]+' mid '+v[1]+' high '+v[2]).join('\n'));
