/* 样稿交互：仅主题、菜单、状态切换。状态也可用网址 # 直接打开（截图用）：
 * #notices 待付款 + 流量不足；#menu 移动菜单；#usermenu 用户菜单；#confirm 确认订单；#register 注册 */
(function(){
  var root=document.documentElement, body=document.body;
  var ICON={light:'#i-sun',dark:'#i-moon',system:'#i-monitor'};
  var LABEL={light:'浅色',dark:'深色',system:'跟随系统'};
  function cur(){return root.getAttribute('data-theme')||'system'}
  function apply(t){
    if(t==='system')root.removeAttribute('data-theme');else root.setAttribute('data-theme',t);
    try{localStorage.setItem('akari-theme',t)}catch(e){}
    paint();
  }
  function paint(){
    var t=cur();
    document.querySelectorAll('[data-theme-btn] use').forEach(function(u){u.setAttribute('href',ICON[t])});
    document.querySelectorAll('[data-theme-btn]').forEach(function(b){b.title='主题：'+LABEL[t]+'（点击切换）'});
    document.querySelectorAll('[data-theme-set]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.themeSet===t)});
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-theme-btn]');
    if(b){var o=['light','dark','system'];apply(o[(o.indexOf(cur())+1)%3]);return}
    var s=e.target.closest('[data-theme-set]'); if(s){apply(s.dataset.themeSet);return}
    var t=e.target.closest('[data-toggle]');
    if(t){e.preventDefault();body.classList.toggle('state-'+t.dataset.toggle);sync();return}
    var u=e.target.closest('.user>button');
    var um=document.querySelector('.user');
    if(u){um.classList.toggle('open');u.setAttribute('aria-expanded',um.classList.contains('open'));return}
    if(um&&!e.target.closest('.user'))um.classList.remove('open');
    var sw=e.target.closest('.switch'); if(sw){sw.setAttribute('aria-checked',sw.getAttribute('aria-checked')!=='true');return}
    var op=e.target.closest('.opt');
    if(op){op.parentNode.querySelectorAll('.opt').forEach(function(x){x.classList.toggle('on',x===op)});return}
    var tab=e.target.closest('[data-tab]');
    if(tab){body.classList.toggle('state-register',tab.dataset.tab==='register');sync();return}
    if(e.target.classList.contains('dlg-wrap'))body.classList.remove('state-confirm');
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){body.classList.remove('state-confirm','state-menu');var um=document.querySelector('.user');if(um)um.classList.remove('open');sync()}});
  function sync(){
    document.querySelectorAll('[data-tab]').forEach(function(x){x.setAttribute('aria-selected',(x.dataset.tab==='register')===body.classList.contains('state-register'))});
    document.querySelectorAll('[data-toggle=menu]').forEach(function(x){
      var open=body.classList.contains('state-menu');x.setAttribute('aria-expanded',open);
      var u=x.querySelector('use');if(u)u.setAttribute('href',open?'#i-x':'#i-menu');
      var l=x.querySelector('span');if(l)l.textContent=open?'关闭':'菜单';
    });
  }
  var h=location.hash.slice(1);
  if(h==='usermenu'){var um=document.querySelector('.user');if(um)um.classList.add('open')}
  else if(h)body.classList.add('state-'+h);
  paint();sync();
})();
