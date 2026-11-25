const state = {protocol:"rip", tab:"topology", router:"R1", down:[], from:"PC1", to:"PC5", history:[]};
const el = id => document.getElementById(id);
const label = {rip:"RIP v2",ospf:"OSPF Area 0"};
const routeText = path => path ? path.join(" → ") : "Unreachable";
const current = () => Campus.snapshot(state.protocol,state.down,state.from,state.to);
const router = id => Campus.routers.find(r=>r.id===id);
const pc = id => Campus.pcs.find(p=>p.id===id);
function table(cols,rows) {
  return '<div class="tablewrap"><table><thead><tr>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function card(title,body,extra='') {
  return '<article class="card"><div class="cardhead"><h2>'+title+'</h2>'+extra+'</div>'+body+'</article>';
}
function selectedRoute(s) {
  return s.routes[pc(s.from).router][pc(s.to).router];
}
function drawMap(s) {
  const coords={R1:[330,78],R2:[118,200],R3:[542,200]};
  const labelAt={"12":[199,128],"13":[459,128],"23":[330,200]};
  const nodePath=s.path||[];
  const drawEdge=l=>{
    const [x1,y1]=coords[l.a], [x2,y2]=coords[l.b];
    const [x,y]=labelAt[l.id], disabled=s.down.includes(l.id);
    const hit=nodePath.includes(l.a)&&nodePath.includes(l.b)&&Math.abs(nodePath.indexOf(l.a)-nodePath.indexOf(l.b))===1;
    const color=disabled?"#ad5548":hit?"#087e6b":"#a6bcba";
    return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="'+(hit?5:3)+'" '+(disabled?'stroke-dasharray="7 6"':'')+'/>'+
    '<rect x="'+(x-52)+'" y="'+(y-10)+'" width="104" height="20" rx="8" fill="#fff"/><text x="'+x+'" y="'+(y+4)+'" fill="'+color+'" font-size="11">'+(disabled?'LINK DOWN':'10.0.'+l.id+'.0/30')+'</text>';
  };
  function drawRouter(r) {
    const [x,y]=coords[r.id];
    const swY=r.id==='R1'?y-51:y+59;
    const pcNames=r.pcs.join(' · ');
    const left=r.id==='R1';
    return '<g><line x1="'+x+'" x2="'+x+'" y1="'+y+'" y2="'+swY+'" stroke="#a6bcba" stroke-width="3"/>'+
      '<rect x="'+(x-55)+'" y="'+(swY-13)+'" width="110" height="26" rx="7" fill="#eaf2ef" stroke="#c4d7d0"/>'+
      '<text x="'+x+'" y="'+(swY+4)+'" font-size="12" fill="#345b55">SW'+r.id[1]+' · '+pcNames+'</text>'+
      '<circle cx="'+x+'" cy="'+y+'" r="23" fill="#123e47"/><text x="'+x+'" y="'+(y+5)+'" fill="white" font-weight="bold" font-size="15">'+r.id+'</text>'+
      '<text x="'+(left?x+76:x)+'" y="'+(left?y-3:swY+35)+'" font-size="15" font-weight="bold" fill="#214449">'+r.department+'</text>'+
      '<text x="'+(left?x+77:x)+'" y="'+(left?y+14:swY+51)+'" font-size="12" fill="#4f7071">'+r.network+'.0/24</text></g>';
  }
  return '<svg class="diagram" role="img" aria-label="Campus router links and selected packet path" viewBox="0 0 660 330" text-anchor="middle">'+Campus.links.map(drawEdge).join('')+Campus.routers.map(drawRouter).join('')+'</svg>'+
    '<div class="legend"><span><b></b>Forwarding path</span><span><b class="standby"></b>Other link</span></div>';
}
function linkControls(){
  return Campus.links.map(l=>{
    const down=state.down.includes(l.id);
    return '<div class="linkrow"><strong>'+l.a+' ↔ '+l.b+'</strong><span class="'+(down?'down':'count')+'">'+(down?'Down':'Up')+' · cost '+l.cost+'</span><button class="toggle" data-link="'+l.id+'">'+(down?'Restore':'Disable')+'</button></div>';
  }).join('');
}
function summary(s) {
  const r=selectedRoute(s);
  const local=pc(s.from).router===pc(s.to).router;
  const metric=local?'Same LAN':!r?'No route':s.protocol==='rip'?'RIP metric · '+r.metric+' hop'+(r.metric===1?'':'s'):'OSPF metric · '+r.metric+' total cost';
  return '<div class="block"><span class="small">SELECTED PATH</span><div class="path">'+routeText(s.path)+'</div><span class="pill">'+metric+'</span></div>';
}
function topology(s) {
  return '<div class="grid">'+card('Campus topology',drawMap(s),'<span class="count">3 routers · 3 switches · 6 PCs</span>')+
    '<article class="card side">'+summary(s)+'<div class="block"><h3>Inter-router links</h3>'+linkControls()+'</div></article></div>'+
    '<div class="wide">'+card('Department addressing',table(['Building','LAN','Gateway · G0/0','PC addresses'],Campus.routers.map(r=>[
      r.department,r.network+'.0/24',r.network+'.1',r.pcs.map(id=>id+' · '+pc(id).ip).join(' / ')])))+'</div>';
}
function routerTables(s){
  const id=state.router, r=router(id);
  const selector='<label class="count">Inspect router <select id="router">'+Campus.routers.map(r=>'<option '+(r.id===id?'selected':'')+'>'+r.id+'</option>').join('')+'</select></label>';
  const rows=Campus.routers.map(dst=>{
    const entry=s.routes[id][dst.id], local=id===dst.id;
    const edge=entry?.next && Campus.peers(id,Campus.active(s.down)).find(p=>p.id===entry.next).link;
    return [dst.network+'.0/24',local?'Connected':entry?(s.protocol==='rip'?'R · RIP':'O · OSPF'):'Unreachable',
      local?'On-link':entry?Campus.ipAt(edge,entry.next)+' ('+entry.next+')':'—',local?'—':entry?.metric??'—'];
  });
  const peers=Campus.peers(id,Campus.links);
  const adj=peers.filter(p=>!s.down.includes(p.link.id)).map(p=>[p.id,Array(4).fill(p.id[1]).join('.'),Campus.ipAt(p.link,p.id),'Area 0']);
  return card(id+' · Department routes',table(['Destination','Source','Next hop','Metric'],rows),selector)+
   '<div class="grid wide">'+card('Interface summary',table(['Port','IPv4 address','Operational'],[
    ['G0/0',r.network+'.1/24','Up'],...peers.map(p=>['G0/'+(p.link.a===id?p.link.ap:p.link.bp),Campus.ipAt(p.link,id)+'/30',s.down.includes(p.link.id)?'Down':'Up'])]))+
   (s.protocol==='ospf'?card('OSPF model neighbors',adj.length?table(['Peer','Router ID','Peer IPv4','Area'],adj):'<p>No operational peers.</p>'):
    card('RIP settings','<p class="desc">RIPv2 exchanges distance vectors across active router links. Each router starts with its local LAN at distance zero.</p><p class="desc">The IOS configurations use passive LAN interfaces and disable automatic summarization.</p>'))+'</div>';
}
function probes(s) {
  const success=s.path&&s.reply;
  const other=Campus.snapshot(s.protocol==='rip'?'ospf':'rip',s.down,s.from,s.to);
  return '<div class="grid">'+card('Reachability and path trace','<pre class="probe">'+
      'Source       '+s.from+' · '+pc(s.from).ip+'\nDestination  '+s.to+' · '+pc(s.to).ip+'\n\n'+
      'Echo request  '+(s.path?'Delivered':'Unreachable')+'\nEcho reply    '+(success?'Delivered':'Unavailable')+
      '\n\nForward  '+routeText(s.path)+'\nReturn   '+routeText(s.reply)+'</pre>','<span class="pill">Model probes</span>')+
    card('All PC pairs','<div class="big">'+s.successes+' / 30</div><p class="desc">Ordered source–destination pairs with a working forward and return path. Each of the six PCs is tested against the other five.</p>')+'</div>'+
    '<div class="wide">'+card('Protocol comparison',table(['Protocol','Forwarding path','Destination LAN metric'],[s,other].map(v=>[label[v.protocol],routeText(v.path),pc(v.from).router===pc(v.to).router?'On-link':selectedRoute(v)?.metric??'—'])))+'</div>';
}
function logEvent(event){
  const s=current(), route=selectedRoute(s);
  state.history.push({event,path:routeText(s.path),metric:pc(s.from).router===pc(s.to).router?'On-link':route?.metric??'—',pairs:s.successes+'/30'});
}
function baseline(){state.history=[];logEvent('Starting state');}
function failover(s){
  return '<div class="grid">'+card('Link state and active path',drawMap(s))+'<article class="card side">'+summary(s)+
   '<div class="block"><h3>Change link state</h3>'+linkControls()+'</div></article></div>'+
    '<div class="wide">'+card('Change history',table(['Event','Forwarding path','Metric','Reachable pairs'],state.history.map(v=>[v.event,v.path,v.metric,v.pairs])),
    '<button class="reset" id="reset">Reset experiment</button>')+'</div>'+
    '<p class="notes">Routes are recomputed to a stable state after each change. The model does not simulate protocol timers or measure convergence in seconds.</p>';
}
function render(){
  const s=current();
  for(const id of ['rip','ospf']){
    const b=el(id);b.classList.toggle('on',id===state.protocol);b.setAttribute('aria-pressed',id===state.protocol);
  }
  document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('on',b.dataset.tab===state.tab);b.setAttribute('aria-pressed',b.dataset.tab===state.tab);});
  el('workspace').innerHTML=({topology,routes:routerTables,probes,failover})[state.tab](s);
  if (el('router')) el('router').onchange=e=>{state.router=e.target.value;render();};
  if (el('reset')) el('reset').onclick=()=>{state.down=[];baseline();render();};
  document.querySelectorAll('[data-link]').forEach(b=>b.onclick=()=>{
    const link=b.dataset.link;
    const restore=state.down.includes(link);
    state.down=restore?state.down.filter(l=>l!==link):[...state.down,link];
    logEvent('R'+link[0]+'–R'+link[1]+(restore?' restored':' disabled'));render();
  });
}
for(const id of ['rip','ospf']) el(id).onclick=()=>{if(state.protocol!==id){state.protocol=id;baseline();}render();};
for(const key of ['from','to']){
  const control=el(key);control.innerHTML=Campus.pcs.map(p=>'<option>'+p.id+'</option>').join('');
  control.value=state[key];control.onchange=()=>{state[key]=control.value;baseline();render();};
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render();});
baseline();render();
