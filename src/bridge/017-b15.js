/* ── [B15] 资源 URL 重写层 ───────────────────────────────────────────────
   依赖：B8(__RES__) / B14
   维护：把脚本/图片/worker 的 URL 换成 blob:/data:；短变量名是刻意的，改名要整体核对
   ───────────────────────────────────────────────────────────── */

(function(){
  var R=window.__RES__||{}, BL=window.__BILUP_BLOBS__||{};
  var WBL={};
  /* 去掉协议/域名与开头的 ./，把绝对 URL 归一成资源表的 key。 */
  function norm(u){
    if(typeof u!=='string') return null;
    if(/^(data:|blob:)/.test(u)) return null;
    var s=u.replace(/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\/[^\/]*/,'');
    s=s.replace(/^[.\/]+/,'');
    return s;
  }
  function blobFor(b64, mime){
    var bin=atob(b64), len=bin.length, u8=new Uint8Array(len);
    for(var i=0;i<len;i+=4096){var end=Math.min(len,i+4096);for(var j=i;j<end;j++)u8[j]=bin.charCodeAt(j);}
    return URL.createObjectURL(new Blob([u8],{type:mime}));
  }
  function workerUrl(u){
    var key=norm(u); if(!key) return u;
    if(WBL[key]) return WBL[key];
    var d=R[key];
    if(!d) return u;
    WBL[key]=blobFor(d.slice(d.indexOf(',')+1),'text/javascript');
    return WBL[key];
  }
  window.__bilupResolve=function(u){ return u; };

  // ---- ① webpack jsonp chunk：把 src 换成 B14 预建好的 Blob URL
  try{
    var sd=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
    Object.defineProperty(HTMLScriptElement.prototype,'src',{
      configurable:true,
      get:function(){ return sd.get.call(this); },
      set:function(v){ var k=norm(v); sd.set.call(this, (k&&BL[k]) ? BL[k] : v); }
    });
  }catch(e){}

  // ---- ② 常见元素的 src/href 属性：换成 __RES__ 里的 data URI
  function patchProp(proto,prop){
    try{
      var d=Object.getOwnPropertyDescriptor(proto,prop);
      if(!d||!d.set) return;
      Object.defineProperty(proto,prop,{
        configurable:true,
        get:function(){ return d.get.call(this); },
        set:function(v){
          var k=norm(v);
          d.set.call(this, (k&&R[k]) ? R[k] : v);
        }
      });
    }catch(e){}
  }
  patchProp(HTMLImageElement.prototype,'src');
  patchProp(HTMLSourceElement.prototype,'src');
  patchProp(HTMLAudioElement.prototype,'src');
  patchProp(HTMLLinkElement.prototype,'href');
  patchProp(HTMLTrackElement.prototype,'src');

  // ---- ③ setAttribute / setAttributeNS（含 SVG image 的 xlink:href）
  function isUrlAttr(n){
    var ln=String(n).toLowerCase();
    return ln==='src' || ln.indexOf('href')>=0;
  }
  function swap(v){ var k=norm(v); return (k&&R[k]) ? R[k] : v; }
  try{
    var sa=Element.prototype.setAttribute;
    Element.prototype.setAttribute=function(n,v){ return sa.call(this,n, isUrlAttr(n)?swap(v):v); };
  }catch(e){}
  try{
    var sans=Element.prototype.setAttributeNS;
    Element.prototype.setAttributeNS=function(ns,n,v){ return sans.call(this,ns,n, isUrlAttr(n)?swap(v):v); };
  }catch(e){}
  try{
    var bd=Object.getOwnPropertyDescriptor(SVGAnimatedString.prototype,'baseVal');
    if(bd&&bd.set){
      Object.defineProperty(SVGAnimatedString.prototype,'baseVal',{
        configurable:true,
        get:function(){ return bd.get.call(this); },
        set:function(v){ bd.set.call(this, swap(v)); }
      });
    }
  }catch(e){}

  // ---- Worker
  try{
    var RW=window.Worker;
    var Patched=function Worker(url,opts){ return new RW(workerUrl(url),opts); };
    Patched.prototype=RW.prototype;
    window.Worker=Patched;
  }catch(e){}

  // ---- fetch / XHR for inlined text assets
  try{
    var rf=window.fetch;
    window.fetch=function(input,init){
      try{
        var u=(typeof input==='string')?input:(input&&input.url);
        var k=norm(u);
        if(k&&R[k]) return rf(R[k],init);
      }catch(e){}
      return rf.apply(window,arguments);
    };
  }catch(e){}
  try{
    var xo=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(m,u){
      var k=norm(u);
      if(k&&R[k]) u=R[k];
      return xo.apply(this,[m,u].concat([].slice.call(arguments,2)));
    };
  }catch(e){}

  // ---- CSS url() inside injected stylesheets
  function fixCss(text){
    return text.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g,function(m0,url){
      var k=norm(url);
      return (k&&R[k]) ? "url('"+R[k]+"')" : m0;
    });
  }
  function fixStyleEl(el){
    if(el.__bilupFixed) return;
    el.__bilupFixed=1;
    if(el.textContent && el.textContent.indexOf('url(')>=0) el.textContent=fixCss(el.textContent);
  }
  function scan(root){
    try{
      var st=root.querySelectorAll?root.querySelectorAll('style'):[];
      for(var i=0;i<st.length;i++) fixStyleEl(st[i]);
    }catch(e){}
  }
  scan(document);
  try{
    new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var added=muts[i].addedNodes;
        for(var j=0;j<added.length;j++){
          var n=added[j];
          if(n.nodeType!==1) continue;
          if(n.tagName==='STYLE') fixStyleEl(n); else scan(n);
        }
      }
    }).observe(document.documentElement,{childList:true,subtree:true});
  }catch(e){}
})();
