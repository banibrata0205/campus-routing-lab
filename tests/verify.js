// Run from any directory with: node tests/verify.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../lab/network.js");
const base = path.resolve(__dirname,"..");

// Enumerate simple router paths independently of the model algorithms.
function bestCost(protocol,down,at,target,visited=[]) {
  if (at===target) return protocol==="rip"?0:1;
  let best=Infinity;
  for (const link of C.links) {
    if (down.includes(link.id) || (at!==link.a && at!==link.b)) continue;
    const next=at===link.a?link.b:link.a;
    if (visited.includes(next)) continue;
    const tail=bestCost(protocol,down,next,target,[...visited,at]);
    best=Math.min(best,tail+(protocol==="rip"?1:link.cost));
  }
  return best;
}
let checks=0;
for (const protocol of ["rip","ospf"]) {
  for (const r of C.routers) {
    const config=fs.readFileSync(path.join(base,"configs",protocol,r.id+".txt"),"utf8");
    const blocks=config.split(/^interface /m).slice(1);
    assert.equal(blocks.length,3);
    assert.ok(blocks[0].includes("ip address "+r.network+".1 255.255.255.0"));
    assert.ok(config.includes(protocol==="rip"?"router rip":"router ospf 1"));
    for (const {link} of C.peers(r.id,C.links)) {
      const port=link.a===r.id?link.ap:link.bp;
      const block=blocks.find(text=>text.startsWith("GigabitEthernet0/"+port+"\n"));
      assert.ok(block.includes("ip address "+C.ipAt(link,r.id)+" 255.255.255.252"));
      assert.ok(block.includes("no shutdown"));
      if (protocol==="ospf") assert.ok(block.includes("ip ospf cost "+link.cost));
    }
  }
  for (let bits=0;bits<8;bits++) {
    const down=C.links.filter((l,k)=>(bits & (1<<k))).map(l=>l.id);
    for (const a of C.pcs) for (const b of C.pcs) {
      const s=C.snapshot(protocol,down,a.id,b.id);
      const metric=bestCost(protocol,down,a.router,b.router);
      assert.equal(s.routes[a.router][b.router]?.metric??Infinity,metric);
      assert.equal(Boolean(s.path && s.reply),Number.isFinite(metric));
      if (s.path) {
        assert.equal(s.path[0],a.id);assert.equal(s.path.at(-1),b.id);
        const hops=s.path.filter(x=>x.startsWith("R"));
        if (hops.length) {
          let actual=protocol==="rip"?0:1;
          for(let i=1;i<hops.length;i++){
            const link=C.peers(hops[i-1],C.active(down)).find(p=>p.id===hops[i]).link;
            actual+=protocol==="rip"?1:link.cost;
          }
          assert.equal(actual,metric);
        }
      }
      checks++;
    }
  }
}
const data={};
for (const protocol of ["rip","ospf"]) {
  data[protocol]=[["baseline",[]],["R1–R2 down",["12"]],["R1–R2 restored",[]],["R1–R3 down",["13"]],["R1–R3 restored",[]]]
    .map(([event,down])=>({event,...C.snapshot(protocol,down)}));
}
if (process.argv.includes("--export")) {
  fs.writeFileSync(path.join(base,"results","observations.json"),JSON.stringify(data,null,2)+"\n");
}
console.log("PASS · "+checks+" protocol/link-state/PC-pair combinations and six IOS configuration cross-checks.");
