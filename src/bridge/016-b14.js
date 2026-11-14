/* ── [B14] webpack chunk → Blob URL ───────────────────────────────────────────────
   依赖：B13
   维护：合并存储后的逐段惰性解压；含逐段读取兜底
   ───────────────────────────────────────────────────────────── */

(function(){
  var BL={};
  var BUNDLE=window.__BL_BUNDLE__;
  var nodes=document.querySelectorAll('script[type="application/x-bilup-chunk"]');

  /* 合并存储后：按 key 从 bundle 取 b64 + 解压后长度，同步解压建 Blob。
     这与原来的逐段读取语义完全一致，只是不再需要 102 个 script 节点。 */
  /* 合并存储路径：同一个 key 只解压一次，结果缓存成 Blob URL。
     Object.defineProperty 的 setter 供外部（webpack 运行时）覆写。 */
  function lazyBundled(key,len){
    var url=null;
    Object.defineProperty(BL,key,{
      configurable:true,enumerable:true,
      get:function(){
        if(url) return url;
        var raw=window.__blBundleRaw?window.__blBundleRaw(key):null;
        if(raw && window.__blInflateB64){
          try{
            var payload=window.__blInflateB64(raw,len);
            url=URL.createObjectURL(new Blob([payload],{type:'text/javascript'}));
          }catch(e){ url=''; }
        } else url='';
        return url;
      },
      set:function(v){
        url=v;
        Object.defineProperty(BL,key,{value:v,writable:true,configurable:true,enumerable:true});
      }
    });
  }
  if(BUNDLE && BUNDLE.index){
    for(var bk in BUNDLE.index){
      if(bk.slice(0,3)==='js/') lazyBundled(bk,BUNDLE.index[bk].len);
    }
  }

  /* 逐段读取兜底：bundle 不可用（例如被外部工具拆过）时退回逐段读取 */
  function lazy(node,key){
    var url=null;
    Object.defineProperty(BL,key,{
      configurable:true,enumerable:true,
      get:function(){
        if(url) return url;
        var txt=node.textContent||'';
        if(txt){
          /* 压缩存储：同步解压成 UTF-8 字节再建 Blob，避免 binary string
             被 Blob 二次编码；未压缩段保持原行为。 */
          var payload=txt;
          if(node.getAttribute && node.getAttribute('data-bl-enc')==='z' && window.__blInflateB64){
            payload=window.__blInflateB64(txt,+(node.getAttribute('data-bl-len')||0));
          }
          url=URL.createObjectURL(new Blob([payload],{type:'text/javascript'}));
        } else url='';
        try{ node.textContent=''; }catch(e){}
        return url;
      },
      set:function(v){
        url=v;
        Object.defineProperty(BL,key,{value:v,writable:true,configurable:true,enumerable:true});
      }
    });
  }
  for(var i=0;i<nodes.length;i++){
    var k=nodes[i].getAttribute('data-u');
    if(k && !Object.prototype.hasOwnProperty.call(BL,k)) lazy(nodes[i],k);
  }
  window.__BILUP_BLOBS__=BL;
  window.__BILUP_CHUNKS__=BL;
})();
