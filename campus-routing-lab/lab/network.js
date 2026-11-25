// A campus LAN-prefix model. One synchronous step exchanges advertisements
// across every operational router link. LAN interfaces have OSPF cost 1.
const Campus = (() => {
  const routers = [
    { id: "R1", department: "Academic", network: "192.168.10", pcs: ["PC1","PC2"] },
    { id: "R2", department: "Administrative", network: "192.168.20", pcs: ["PC3","PC4"] },
    { id: "R3", department: "Research", network: "192.168.30", pcs: ["PC5","PC6"] }
  ];
  const links = [
    { id: "12", a: "R1", b: "R2", ap: 1, bp: 1, cost: 10 },
    { id: "13", a: "R1", b: "R3", ap: 2, bp: 2, cost: 100 },
    { id: "23", a: "R2", b: "R3", ap: 2, bp: 1, cost: 10 }
  ];
  const ids = routers.map(r => r.id);
  const pcs = routers.flatMap(r => r.pcs.map((id,i) => ({id, router:r.id, ip:r.network+"."+(10+i)})));
  const active = down => links.filter(link => !down.includes(link.id));
  const peers = (id, edges) => edges.filter(l => l.a === id || l.b === id)
    .map(l => ({id:l.a === id ? l.b : l.a, link:l}));
  const ipAt = (link, id) => '10.0.'+link.id+(id===link.a?'.1':'.2');
  const clone = obj => JSON.parse(JSON.stringify(obj));

  function stable(previous, next) {
    return ids.every(a => ids.every(b => previous[a][b]?.metric === next[a][b]?.metric &&
      previous[a][b]?.next === next[a][b]?.next));
  }

  function rip(down) {
    const edges = active(down);
    let routes = Object.fromEntries(ids.map(id => [id,{[id]:{metric:0,next:null}}]));
    for (let round=1; round<=16; round++) {
      const next = clone(routes);
      for (const src of ids) {
        for (const peer of peers(src,edges)) {
          for (const [dst, advertised] of Object.entries(routes[peer.id])) {
            const metric = advertised.metric+1;
            if (metric < 16 && (!next[src][dst] || metric < next[src][dst].metric)) {
              next[src][dst] = {metric,next:peer.id};
            }
          }
        }
      }
      if (stable(routes,next)) return routes;
      routes = next;
    }
    return routes;
  }

  function shortestPaths(src, edges) {
    const remaining = new Set(ids);
    const distance = Object.fromEntries(ids.map(id => [id,Infinity]));
    const firstHop = {[src]:null};
    distance[src] = 0;
    while (remaining.size) {
      const current = [...remaining].sort((a,b) => distance[a]-distance[b])[0];
      if (!Number.isFinite(distance[current])) break;
      remaining.delete(current);
      for (const peer of peers(current,edges)) {
        const candidate = distance[current]+peer.link.cost;
        if (candidate < distance[peer.id]) {
          distance[peer.id] = candidate;
          firstHop[peer.id] = current===src ? peer.id : firstHop[current];
        }
      }
    }
    return Object.fromEntries(ids.filter(id => Number.isFinite(distance[id]))
      .map(id => [id,{next:firstHop[id], metric:distance[id]+1}]));
  }

  function ospf(down) {
    const edges = active(down);
    // Each origin advertises its operational links. Flood one round per hop.
    let databases = Object.fromEntries(ids.map(id => [id,new Set([id])]));
    for (let step=0;step<ids.length;step++) {
      const next = {};
      for (const id of ids) {
        next[id] = new Set(databases[id]);
        for (const peer of peers(id,edges)) {
          for (const origin of databases[peer.id]) next[id].add(origin);
        }
      }
      databases=next;
    }
    return Object.fromEntries(ids.map(id =>
      [id,shortestPaths(id,edges.filter(l => databases[id].has(l.a) && databases[id].has(l.b)))]));
  }

  function trace(routes, down, from, to) {
    const src=pcs.find(p => p.id===from), dst=pcs.find(p => p.id===to);
    const devices=[src.id];
    if (from===to) return devices;
    if (src.router===dst.router) return [...devices,dst.id];
    let current=src.router;
    while (current!==dst.router) {
      if (devices.includes(current)) return null;
      devices.push(current);
      const hop=routes[current][dst.router]?.next;
      if (!peers(current,active(down)).some(p => p.id===hop)) return null;
      current=hop;
    }
    return [...devices,current,dst.id];
  }

  function snapshot(protocol,down=[],from="PC1",to="PC5") {
    const routes = protocol==="rip" ? rip(down) : ospf(down);
    const path = trace(routes,down,from,to);
    const reply = trace(routes,down,to,from);
    const successes=pcs.flatMap(a=>pcs.filter(b=>b.id!==a.id).map(b=>Boolean(
      trace(routes,down,a.id,b.id) && trace(routes,down,b.id,a.id)))).filter(Boolean).length;
    return {protocol, down:[...down], from, to, routes, path, reply, successes};
  }
  return {routers,links,pcs,ipAt,active,peers,snapshot};
})();
if (typeof module !== "undefined") module.exports = Campus;
