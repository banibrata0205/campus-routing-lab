const C = require("./network.js");
const protocol = process.argv[2] || "rip";
const scenario = process.argv[3] || "topology";
const views = ["topology","routes","probe","failure","recovery"];
if (!["rip","ospf"].includes(protocol)||!views.includes(scenario)) {
  console.error("Usage: node lab/run.js rip|ospf topology|routes|probe|failure|recovery");
  process.exit(1);
}
const cut = protocol==="rip"?"13":"12";
const baseline = C.snapshot(protocol);
const failed = C.snapshot(protocol,[cut]);
const restored = C.snapshot(protocol,[]);
const active = scenario==="failure"?failed:scenario==="recovery"?restored:baseline;
const {path,routes,successes} = active;
const title = text => console.log("\n"+text+"\n"+"─".repeat(72));
const row = (...cells) => console.log(cells.map(v=>String(v).padEnd(17)).join(" ").trimEnd());
console.log("Group 11  /  Campus routing lab  /  "+(protocol==="rip"?"RIP v2":"OSPF Area 0"));
if (scenario==="topology") {
  title("Department LANs");
  row("Building","Gateway","Switch","Clients");
  for (const r of C.routers) row(r.department,r.network+".1","SW"+r.id[1],r.pcs.join(", "));
  title("Router connections");
  row("Endpoint A","IPv4","Endpoint B","IPv4","OSPF cost");
  for (const l of C.links) row(l.a+" G0/"+l.ap,C.ipAt(l,l.a)+"/30",l.b+" G0/"+l.bp,C.ipAt(l,l.b)+"/30",l.cost);
  title("PC configuration");
  for (const r of C.routers) console.log(r.pcs.map(id=>id+"  "+C.pcs.find(p=>p.id===id).ip+"/24").join("        ")+"        gateway "+r.network+".1");
} else if(scenario==="routes") {
  title("R1 interfaces");
  row("Port","IPv4","Peer","State");
  row("G0/0","192.168.10.1/24","SW1","Up");
  for (const {id,link} of C.peers("R1",C.links)) row("G0/"+link.ap,C.ipAt(link,"R1")+"/30",id,"Up");
  title("R1 routes to departmental LANs");
  row("LAN prefix","Source","Next hop","Metric");
  for (const r of C.routers) {
    const learned=routes.R1[r.id], peer=C.peers("R1",C.links).find(p=>p.id===learned.next);
    row(r.network+".0/24",peer?(protocol==="rip"?"RIP":"OSPF"):"Connected",peer?C.ipAt(peer.link,peer.id):"On-link",peer?learned.metric:"—");
  }
  if (protocol==="ospf"){
    title("R1 model neighbors in Area 0");
    for (const p of C.peers("R1",C.active(active.down))) row(p.id,Array(4).fill(p.id[1]).join("."),C.ipAt(p.link,p.id));
  }
} else if(scenario==="probe") {
  title("Bidirectional reachability probe");
  for (const key of ["from","to"]) {
    const p=C.pcs.find(p=>p.id===active[key]);
    row(key==="from"?"Source":"Destination",p.id,p.ip);
  }
  console.log("\nRequest    "+(path?"Delivered":"Unreachable")+"\nReply      "+(active.reply && path?"Delivered":"Unavailable"));
  title("Forwarding trace");
  console.log("Forward    "+path.join(" → ")+"\nReturn     "+active.reply.join(" → "));
  title("All distinct PC pairs");
  console.log(successes+" of 30 ordered pairs have a working forward and return path.");
} else {
  title("Event log · PC1 to PC5");
  const events=[["All links up",baseline],["R1–R"+cut[1]+" disabled",failed]];
  if(scenario==="recovery") events.push(["R1–R"+cut[1]+" restored",restored]);
  for (const [event,s] of events) {
    console.log(event.padEnd(20)+s.path.join(" → "));
    console.log(" ".repeat(20)+"Metric "+s.routes.R1.R3.metric+"   |   Reachable pairs "+s.successes+"/30\n");
  }
  title("Current forwarding");
  console.log("Route to 192.168.30.0/24 via "+routes.R1.R3.next+"\nPC1 trace  "+path.join(" → "));
}
