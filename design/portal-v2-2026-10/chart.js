/* 近 7 日流量：平滑面积图（总流量一条曲线；悬停显示下行 / 上行明细） */
(function(){
var DAYS=[["周五","10-16",4.2,1.1],["周六","10-17",6.8,1.6],["周日","10-18",3.1,0.9],["周一","10-19",5.4,1.4],["周二","10-20",7.9,2.1],["周三","10-21",2.6,0.8],["今天","10-22",1.2,0.7]];
var NS="http://www.w3.org/2000/svg",MAX=12,tot=DAYS.map(function(d){return d[2]+d[3]});
var tip=document.createElement('div');tip.className='ttip';document.body.appendChild(tip);
function f1(n){return n.toFixed(1)}
function el(p,n,a,t){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);if(t!=null)e.textContent=t;p.appendChild(e);return e}
function show(ev,i){var d=DAYS[i];tip.innerHTML='<b>'+d[0]+' '+d[1]+'</b>　'+f1(tot[i])+' GB<br><i style="background:var(--brand)"></i>下行 '+f1(d[2])+' GB<br><i style="background:var(--brand-2)"></i>上行 '+f1(d[3])+' GB';
  tip.style.display='block';tip.style.left=Math.min(ev.clientX+14,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=(ev.clientY-tip.offsetHeight-12)+'px'}
function draw(){var s=document.getElementById('tchart');if(!s)return;s.innerHTML='';
  var W=s.clientWidth,m=W<600,H=m?200:240,L=28,R=m?24:36,B=36,T=28;s.setAttribute('viewBox','0 0 '+W+' '+H);s.style.height=H+'px';
  var ph=H-B-T,pw=W-L-R;function X(i){return L+pw/6*i}function Y(v){return T+ph-v/MAX*ph}
  [0,6,12].forEach(function(v){el(s,'line',{'class':v?'ax':'base',x1:L,x2:W,y1:Y(v),y2:Y(v)});el(s,'text',{x:L-8,y:Y(v)+4,'text-anchor':'end'},v)});
  var p=tot.map(function(v,i){return[X(i),Y(v)]}),d='M'+p[0];
  for(var i=1;i<p.length;i++){var cx=(p[i-1][0]+p[i][0])/2;d+=' C'+cx+','+p[i-1][1]+' '+cx+','+p[i][1]+' '+p[i][0]+','+p[i][1]}
  var lg=el(el(s,'defs',{}),'linearGradient',{id:'tg',x1:0,y1:0,x2:0,y2:1});
  el(lg,'stop',{offset:0,'stop-color':'var(--brand)','stop-opacity':.16});el(lg,'stop',{offset:1,'stop-color':'var(--brand)','stop-opacity':0});
  el(s,'path',{d:d+' L'+X(6)+','+Y(0)+' L'+X(0)+','+Y(0)+' Z',fill:'url(#tg)'});
  el(s,'path',{d:d,fill:'none',stroke:'var(--brand)','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round'});
  var cross=el(s,'line',{y1:T,y2:T+ph,stroke:'var(--line2)','stroke-width':1,style:'display:none'});
  var dot=el(s,'circle',{r:4.5,fill:'var(--brand)',stroke:'var(--bg)','stroke-width':2,style:'display:none'});
  el(s,'circle',{cx:X(6),cy:Y(tot[6]),r:4.5,fill:'var(--brand)',stroke:'var(--bg)','stroke-width':2});
  el(s,'text',{x:X(6),y:Y(tot[6])-12,'text-anchor':'middle',style:'fill:var(--fg);font-weight:600'},f1(tot[6])+' GB');
  var hm=tot.indexOf(Math.max.apply(null,tot));el(s,'text',{x:X(hm),y:Y(tot[hm])-12,'text-anchor':'middle',style:'fill:var(--muted)'},f1(tot[hm]));
  DAYS.forEach(function(dd,i){el(s,'text',{x:X(i),y:H-B+22,'text-anchor':'middle',style:i===6?'fill:var(--fg);font-weight:600':'fill:var(--muted)'},m?(i===6?'今天':dd[0].replace('周','')):dd[0]+' '+dd[1])});
  var hit=el(s,'rect',{x:L,y:T,width:pw,height:ph,'class':'hit'});
  hit.onmousemove=function(e){var r=s.getBoundingClientRect(),i=Math.max(0,Math.min(6,Math.round((e.clientX-r.left-L)/(pw/6))));
    cross.setAttribute('x1',X(i));cross.setAttribute('x2',X(i));cross.style.display='';dot.setAttribute('cx',X(i));dot.setAttribute('cy',Y(tot[i]));dot.style.display='';show(e,i)};
  hit.onmouseleave=function(){cross.style.display='none';dot.style.display='none';tip.style.display='none'}}
draw();addEventListener('resize',draw);
document.querySelectorAll('.rng button').forEach(function(b){b.onclick=function(){b.parentNode.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x===b)})}});
})();
