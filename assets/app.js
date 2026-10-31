/* MULTI TOOL HUB — shared helpers.
   Credit: chank!nd3 p4d4y41! */
(function(){
  try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t;}catch(e){}

  /* Early theme application for no-flash */
  try{
    var th=localStorage.getItem("theme");
    if(th)document.documentElement.dataset.theme=th;
    ;
  }catch(e){}

  var PE=window.PE={};
  PE.credit="chank!nd3 p4d4y41!";
  PE.version="4.2";
  var scriptEl=document.currentScript;
  var assetBase=scriptEl&&scriptEl.src?new URL(".",scriptEl.src).href:new URL("assets/",location.href).href;
  PE.asset=function(name){return new URL(name,assetBase).href};

  /* ---------- basics ---------- */
  PE.$=function(id){return document.getElementById(id)};
  PE.$$=function(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel))};
  /* Attribute-safe escaping: quotes are escaped too, so this can be used
     inside HTML attributes as well as in text nodes. */
  PE.esc=function(s){
    return String(s==null?"":s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  };
  PE.fmt=function(b){
    if(b==null||isNaN(b))return "0 KB";
    if(b>=1048576)return (b/1048576).toFixed(2)+" MB";
    if(b>=1024)return Math.max(1,Math.round(b/1024))+" KB";
    return b+" B";
  };
  PE.baseName=function(n){return String(n||"file").replace(/\.[^.]+$/,"")};
  PE.now=function(){return new Date().toLocaleString()};

  /* ---------- feedback ---------- */
  PE.download=function(data,name,type){
    var blob=data instanceof Blob?data:new Blob([data],{type:type||"application/octet-stream"});
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;style(a);
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href)},8000);
    PE.log("Downloaded "+name+" ("+PE.fmt(blob.size)+")");
    return blob;
  };
  function style(a){a.style.position="fixed";a.style.left="-9999px"}
  PE.toast=function(msg,kind){
    var t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;
    if(kind==="err")t.style.background="var(--err)",t.style.color="#fff";
    document.body.appendChild(t);setTimeout(function(){t.remove()},2800);
  };
  PE.status=function(msg,kind){
    var s=PE.$("status");if(!s)return null;
    s.textContent=msg;s.className="status"+(kind?" "+kind:"");
    if(msg)PE.log((kind==="err"?"✗ ":kind==="ok"?"✓ ":"· ")+msg);
    return s;
  };
  PE.progress=function(p){
    var w=PE.$("prog");if(!w)return;
    w.style.display=p==null?"none":"block";
    if(p!=null&&w.firstElementChild)w.firstElementChild.style.width=Math.max(0,Math.min(1,p))*100+"%";
  };
  PE.busy=function(on,msg){
    PE.$$("[data-busy]").forEach(function(b){b.disabled=!!on});
    if(msg!=null)PE.status(msg);
  };
  /* Friendly wrapper: run an async job with progress + error handling. */
  PE.run=async function(label,fn){
    try{var r=await fn();return r}
    catch(e){
      PE.progress(null);
      var m=(e&&e.message)||String(e);
      if(/encrypt|password/i.test(m))m="This PDF is password-protected. Remove the password first, then try again.";
      else if(/Invalid PDF|not a PDF|Failed to parse|damaged/i.test(m))m="This file could not be read. It may be damaged or it is not a PDF.";
      else if(/encode|WinAnsi/i.test(m))m="One of your texts has a character the PDF font cannot draw. Use Latin letters, numbers and common symbols.";
      PE.status(label+" — "+m,"err");
      throw e;
    }
  };

  /* ---------- diagnostics log (used by the assistant) ---------- */
  PE.logs=[];
  PE.log=function(msg){
    PE.logs.push("["+new Date().toLocaleTimeString()+"] "+msg);
    if(PE.logs.length>200)PE.logs.shift();
    try{sessionStorage.setItem("mth.logs",JSON.stringify(PE.logs.slice(-60)))}catch(e){}
  };

  /* ---------- drag & drop ---------- */
  PE.drop=function(zone,input,accept,onFiles){
    if(!zone||!input)return;
    function take(list){
      var all=Array.prototype.slice.call(list||[]);
      var ok=all.filter(function(f){return accept.test(f.type||"")||accept.test(f.name||"")});
      if(!ok.length){PE.status("That file type isn’t supported here.","err");return}
      if(ok.length<all.length)PE.toast((all.length-ok.length)+" file(s) skipped — wrong type");
      onFiles(ok);
    }
    input.addEventListener("change",function(){take(input.files);input.value=""});
    ["dragenter","dragover"].forEach(function(e){zone.addEventListener(e,function(ev){ev.preventDefault();if(ev.dataTransfer)ev.dataTransfer.dropEffect="copy";zone.classList.add("over")})});
    ["dragleave","drop"].forEach(function(e){zone.addEventListener(e,function(ev){if(e==="dragleave"&&zone.contains(ev.relatedTarget))return;zone.classList.remove("over")})});
    zone.addEventListener("drop",function(ev){ev.preventDefault();take(ev.dataTransfer&&ev.dataTransfer.files)});
    /* allow dropping anywhere on the page */
    ["dragover","drop"].forEach(function(e){window.addEventListener(e,function(ev){if(!PE.$("panel")||PE.$("panel").hidden)ev.preventDefault()})});
    return zone;
  };
  PE.pickFiles=function(opts){
    var o=opts||{};
    return new Promise(function(res){
      var i=document.createElement("input");i.type="file";i.accept=o.accept||"";
      if(o.multiple)i.multiple=true;i.style.position="fixed";i.style.left="-9999px";
      document.body.appendChild(i);
      i.onchange=function(){var f=Array.prototype.slice.call(i.files);i.remove();res(f)};
      i.click();
    });
  };

  /* ---------- page ranges ---------- */
  /* "1-3, 5, 8-" -> sorted unique 0-based indices, or throws a readable error */
  PE.ranges=function(text,n,opts){
    /* One-based input, zero-based output — every tool consumer expects
       page indices. `opts.oneBased` is available for the rare display-only
       caller that needs the original numbers back. */
    var out=[];
    function add(v){var k=v-1;if(out.indexOf(k)<0)out.push(k)}
    var parts=String(text||"").split(/[,;]/);
    var any=false;
    parts.forEach(function(part){
      part=part.trim();if(!part){return}
      var m=part.match(/^(\d+)\s*(?:-|–|to)\s*(\d+)$/i),a,b;
      if(m){a=+m[1];b=+m[2]}
      else if(/^(\d*)\s*-\s*(\d*)$/.test(part)){var mm=part.match(/^(\d*)\s*-\s*(\d*)$/);a=mm[1]?+mm[1]:1;b=mm[2]?+mm[2]:n;var t=a;a=Math.min(t,b);b=Math.max(t,b)}
      else if(/^(all|\*)$/.test(part.toLowerCase())){a=1;b=n}
      else if(/^\d+$/.test(part)){a=b=+part}
      else throw new Error("“"+part+"” isn’t a valid page or range. Try 1-3, 5, 8-.");
      var hi=n,lo=1;
      if(a<lo||b>hi)throw new Error("Pages must be between "+lo+" and "+hi+" (you entered “"+part+"”).");
      for(var i=a;i<=b;i++)add(i);
      any=true;
    });
    if(!any||!out.length)throw new Error("Enter at least one page number, for example 1-3, 5.");
    out.sort(function(x,y){return x-y});
    return opts&&opts.oneBased?out.map(function(i){return i+1}):out;
  };
  /* Turn a list of 0-based indices into a compact label: 1-3, 5, 8 */
  PE.rangesText=function(list){
    var a=list.slice().sort(function(x,y){return x-y}),out=[],i=0;
    while(i<a.length){var s=a[i],e=s;while(i+1<a.length&&a[i+1]===e+1){e=a[i+1];i++}
      out.push(s===e?String(s+1):(e===s+1?(s+1)+", "+(e+1):(s+1)+"-"+(e+1)));i++}
    return out.join(", ");
  };

  /* ---------- PDF reading ---------- */
  PE.pdfjs=function(){
    if(typeof pdfjsLib==="undefined")throw new Error("The PDF engine did not load. Check your internet connection and refresh.");
    pdfjsLib.GlobalWorkerOptions.workerSrc=PE.asset("pdf.worker.min.js");
    return pdfjsLib;
  };
  PE.openPdf=async function(file){
    var data;
    if(file&&typeof file.arrayBuffer==="function")data=new Uint8Array(await file.arrayBuffer());
    else if(file&&file.bytes)data=new Uint8Array(file.bytes);
    else if(file instanceof Uint8Array)data=file;
    else if(file instanceof ArrayBuffer)data=new Uint8Array(file);
    else throw new Error("Choose a PDF file first.");
    return PE.pdfjs().getDocument({data:data}).promise;
  };
  PE.readPdf=async function(file){
    if(typeof PDFLib==="undefined")throw new Error("The PDF builder did not load. Check your internet connection and refresh.");
    try{return await PDFLib.PDFDocument.load(new Uint8Array(await file.arrayBuffer()),{ignoreEncryption:false})}
    catch(e){
      var m=(e&&e.message)||"";
      if(/encrypt/i.test(m))throw new Error(file.name+" is password-protected. Remove the password first, then try again.");
      if(/No PDF|parse|Invalid/i.test(m))throw new Error(file.name+" could not be read. It may be damaged, or it is not a PDF.");
      throw new Error(file.name+" could not be read. It may be damaged, or it is not a PDF.");
    }
  };
  /* Opens a PDF with pdf.js, optionally supplying a password. Throws
     {needsPassword:true} when the file is protected and no password (or
     the wrong one) was given, so callers can prompt and retry. Used by the
     PDF Password Unlocker — it never guesses or brute-forces a password,
     only decrypts with the one the visitor supplies. */
  PE.openPdfWithPassword=async function(file,password){
    var data;
    if(file&&typeof file.arrayBuffer==="function")data=new Uint8Array(await file.arrayBuffer());
    else if(file instanceof Uint8Array)data=file;
    else if(file instanceof ArrayBuffer)data=new Uint8Array(file);
    else throw new Error("Choose a PDF file first.");
    var opts={data:data};
    if(password)opts.password=password;
    try{
      return await PE.pdfjs().getDocument(opts).promise;
    }catch(e){
      var isPwd=e&&(e.name==="PasswordException"||/password/i.test(e.message||""));
      if(isPwd){
        var err=new Error(password?"That password is incorrect.":"This PDF is password-protected.");
        err.needsPassword=true;
        err.incorrect=!!password;
        throw err;
      }
      throw e;
    }
  };
  PE.pageCount=async function(file){
    var pdf=await PE.openPdf(file);
    var n=pdf.numPages;
    try{pdf.destroy()}catch(e){}
    return n;
  };

  /* ---------- live preview ---------- */
  /* Render one page of a PDF onto a canvas. Needs pdf.js. Returns layout info
     {pw,ph,s,pages,page,rotate,canvas} where pw/ph are the page's size in points. */
  PE.preview=async function(file,canvas,opts){
    opts=opts||{};
    var lib=PE.pdfjs();
    var src=file&&file.arrayBuffer?await file.arrayBuffer():(file.bytes||file);
    var pdf=await lib.getDocument({data:src.slice?src.slice(0):src}).promise;
    var num=Math.max(1,Math.min(pdf.numPages,opts.page||1));
    var page=await pdf.getPage(num);
    var v1=page.getViewport({scale:1});
    var maxW=opts.maxW||680, extra=opts.scale||1;
    var s=(maxW/v1.width)*(opts.fit===false?1:1)*extra;
    s=Math.max(0.15,Math.min(3,s));
    if(opts.zoom)s=opts.zoom;
    var vp=page.getViewport({scale:s});
    var dpr=Math.min(2,window.devicePixelRatio||1);
    if(canvas){
      canvas.width=Math.round(vp.width*dpr);canvas.height=Math.round(vp.height*dpr);
      canvas.style.width=vp.width+"px";canvas.style.height=vp.height+"px";
      var cx=canvas.getContext("2d");cx.setTransform(dpr,0,0,dpr,0,0);
      cx.fillStyle="#fff";cx.fillRect(0,0,vp.width,vp.height);
      await page.render({canvasContext:cx,viewport:vp}).promise;
    }
    var info={pw:v1.width,ph:v1.height,s:s,pages:pdf.numPages,page:num,rotate:((page.rotate||0)%360+360)%360,canvas:canvas,pdf:pdf,vp:vp};
    PE.blankTime=Date.now();
    return info;
  };
  PE.hex=function(h){
    h=String(h||"#000").replace("#","");
    if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [0,2,4].map(function(i){return parseInt(h.substr(i,2),16)/255});
  };
  PE.rgbStr=function(h,a){var c=PE.hex(h);return "rgba("+c.map(function(v){return Math.round(v*255)}).join(",")+","+(a==null?1:a)+")"};
  PE.copyHex=async function(hex){
    try{await navigator.clipboard.writeText(hex);PE.toast("Copied "+hex)}catch(e){PE.toast(hex)}
  };

  /* ---------- images ---------- */
  PE.loadImage=function(file){
    return new Promise(function(res,rej){
      var url=file instanceof Blob?URL.createObjectURL(file):file;
      var im=new Image();
      im.onload=function(){res(im)};
      im.onerror=function(){rej(new Error(((file&&file.name)||"That image")+" could not be opened as an image."))};
      im.src=url;
    });
  };
  PE.imageToCanvas=function(im,maxSide){
    var k=maxSide?Math.min(1,maxSide/Math.max(im.width,im.height)):1;
    var c=document.createElement("canvas");c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));
    var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);
    x.drawImage(im,0,0,c.width,c.height);
    return c;
  };
  /* Scaled JPEG/PNG/WebP bytes from an image file, honouring scale + quality + rotation. */
  PE.imageBytes=async function(file,opts){
    opts=opts||{};
    var im=await PE.loadImage(file);
    var deg=((opts.rotate||0)%360+360)%360, q=deg%180!==0;
    var k=Math.min(1,(opts.maxSide||2400)/Math.max(im.width,im.height))*(opts.scale||1);
    var w=Math.round((q?im.height:im.width)*k),h=Math.round((q?im.width:im.height)*k);
    var c=document.createElement("canvas");c.width=Math.max(1,w);c.height=Math.max(1,h);
    var x=c.getContext("2d");
    if(!opts.keepAlpha){x.fillStyle=opts.background||"#fff";x.fillRect(0,0,c.width,c.height)}
    x.translate(c.width/2,c.height/2);x.rotate(deg*Math.PI/180);
    x.drawImage(im,-im.width*k/2,-im.height*k/2,im.width*k,im.height*k);
    if(opts.grayscale){grayscale(x,c.width,c.height)}
    if(opts.brightness||opts.contrast){levels(x,c.width,c.height,opts.brightness||0,opts.contrast||0)}
    if(opts.watermark)stampText(x,c.width,c.height,opts.watermark);
    var mime=opts.webp?"image/webp":opts.png?"image/png":opts.keepAlpha?"image/png":"image/jpeg";
    var blob=await new Promise(function(r){c.toBlob(r,mime,opts.quality==null?0.92:opts.quality)});
    if(!blob&&mime==="image/webp"){
      mime="image/png";
      blob=await new Promise(function(r){c.toBlob(r,mime,opts.quality==null?0.92:opts.quality)});
    }
    if(!blob)throw new Error("The browser could not encode this image.");
    return {bytes:await blob.arrayBuffer(),blob:blob,w:c.width,h:c.height,original:{w:im.width,h:im.height},type:mime};
  };
  function grayscale(x,w,h){var d=x.getImageData(0,0,w,h),p=d.data;for(var i=0;i<p.length;i+=4){var g=(p[i]*.299+p[i+1]*.587+p[i+2]*.114);p[i]=p[i+1]=p[i+2]=g}x.putImageData(d,0,0)}
  function levels(x,w,h,br,ct){var d=x.getImageData(0,0,w,h),p=d.data,f=(259*(ct+255))/(255*(259-ct));for(var i=0;i<p.length;i+=4){for(var k=0;k<3;k++){var v=f*(p[i+k]-128)+128+br;p[i+k]=v<0?0:v>255?255:v}}x.putImageData(d,0,0)}
  function stampText(x,w,h,o){
    var t=typeof o==="string"?{text:o}:o;var size=t.size||Math.max(10,w*0.045);
    x.save();x.globalAlpha=t.opacity==null?0.45:t.opacity;x.fillStyle=t.color||"#ffffff";x.strokeStyle="rgba(0,0,0,.35)";x.lineWidth=1;
    x.font="bold "+size+"px var(--font-body)";x.textAlign="center";x.textBaseline="middle";
    x.translate(w/2,h/2);x.rotate((t.angle||0)*Math.PI/180);x.fillText(t.text||"MULTI TOOL HUB",0,0);
    if(t.stroke)x.strokeText(t.text||"",0,0);x.restore();
  }
  PE.dataUrlToBytes=function(url){
    var b64=String(url).split(",")[1]||"";
    var bin=atob(b64),u=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    return u;
  };

  /* ---------- misc ---------- */
  PE.debounce=function(fn,ms){var t;return function(){var a=arguments,c=this;clearTimeout(t);t=setTimeout(function(){fn.apply(c,a)},ms||120)}};
  PE.uid=function(){return Math.random().toString(36).slice(2,10)};
  PE.clamp=function(v,a,b){return v<a?a:v>b?b:v};
  PE.sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
  PE.uniqueName=function(name,used){
    var base=PE.baseName(name),ext=(name.match(/\.[^.]+$/)||[""])[0],out=name,n=2;
    while(used[out.toLowerCase()]){out=base+" ("+n+")"+ext;n++}
    used[out.toLowerCase()]=1;return out;
  };
  PE.csrfSafeName=function(n){return String(n).replace(/[\\/:*?"<>|]+/g,"_")};

  /* Copy text to the clipboard with a fallback for older browsers. */
  PE.copy=async function(text,msg){
    try{await navigator.clipboard.writeText(text);PE.toast(msg||"Copied")}
    catch(e){
      var t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();
      try{document.execCommand("copy");PE.toast(msg||"Copied")}catch(x){PE.toast("Press Ctrl+C to copy")}
      t.remove();
    }
  };

  /* Shared branding and theme controls for tool/legal pages */
  var sunSvg='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var moonSvg='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M20 14.3A8 8 0 0 1 9.7 4 8.1 8.1 0 1 0 20 14.3Z"/></svg>';
  function themeIsDark(){
    var cur=document.documentElement.dataset.theme;
    return cur==="dark"||false;
  }
  function paintThemeBtn(btn){
    if(!btn)return;
    var dark=themeIsDark();
    btn.innerHTML=dark?sunSvg:moonSvg;
    btn.setAttribute("aria-label",dark?"Switch to light theme":"Switch to dark theme");
    btn.setAttribute("title",dark?"Switch to light theme":"Switch to dark theme");
    btn.setAttribute("aria-pressed",dark?"true":"false");
  }
  function applyTheme(next){
    document.documentElement.dataset.theme=next;
    try{localStorage.setItem("theme",next)}catch(e){}
    try{window.dispatchEvent(new CustomEvent("mth:theme",{detail:next}))}catch(e){}
    paintThemeBtn(document.getElementById("mthThemeToggle"));
  }
  function injectBrand(){
    try{
      var bar=document.querySelector("header .bar");
      if(bar&&!document.getElementById("mthThemeToggle")&&!document.getElementById("themeBtn")){
        var btn=document.createElement("button");
        btn.type="button";btn.id="mthThemeToggle";btn.className="theme-toggle";
        btn.onclick=function(){applyTheme(themeIsDark()?"light":"dark")};
        bar.appendChild(btn);paintThemeBtn(btn);
      }
      var brands=document.querySelectorAll(".brand img");
      brands.forEach(function(img){
        if(img.getAttribute("src")&&img.getAttribute("src").indexOf("logo.svg")>=0)img.setAttribute("alt","MULTI TOOL HUB logo");
      });
      /* Keep the injected control in sync when another control changes the theme. */
      window.addEventListener("mth:theme",function(){paintThemeBtn(document.getElementById("mthThemeToggle"))});
    }catch(e){}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",injectBrand);else injectBrand();

  /* ------------------------------------------------------------------ */
  /* Expandable previews                                                 */
  /* ------------------------------------------------------------------ */
  function previewSource(host){
    if(!host)return null;
    if(host.tagName==="CANVAS"||host.tagName==="IMG")return host;
    var pick=host.querySelector("canvas#base,canvas#pv,canvas#out,canvas#preview,canvas#canvas,canvas,img#pv,img#preview,img");
    return pick||null;
  }
  function previewLabel(el){
    var t=(el.getAttribute&&(el.getAttribute("aria-label")||el.getAttribute("title")||el.getAttribute("alt")))||"";
    return t||"Preview";
  }
  /* Some tools stack a transparent overlay canvas (watermark, page numbers,
     crop frame) on top of the page canvas. The enlarged preview must show the
     finished result, so composite every perfectly aligned layer. */
  function alignedLayers(host,primary){
    if(!host||!host.querySelectorAll||!primary.getBoundingClientRect)return [primary];
    var pr=primary.getBoundingClientRect();
    if(!pr.width||!pr.height)return [primary];
    var list=[primary];
    host.querySelectorAll("canvas").forEach(function(c){
      if(c===primary||!c.width||!c.height||c.getClientRects().length===0)return;
      var r=c.getBoundingClientRect();
      if(!r.width||!r.height)return;
      if(Math.abs(r.left-pr.left)<=2&&Math.abs(r.top-pr.top)<=2&&
         Math.abs(r.width-pr.width)<=2&&Math.abs(r.height-pr.height)<=2)list.push(c);
    });
    return list;
  }
  function compositeLayers(list){
    if(list.length<2)return list[0];
    var out=document.createElement("canvas");
    out.width=list[0].width;out.height=list[0].height;
    var ctx=out.getContext("2d");
    if(!ctx)return list[0];
    list.forEach(function(c){
      var op=parseFloat(getComputedStyle(c).opacity);
      ctx.globalAlpha=isFinite(op)?op:1;
      ctx.drawImage(c,0,0,out.width,out.height);
    });
    ctx.globalAlpha=1;
    return out;
  }
  var closePreview=function(modal,returnTo){
    if(!modal)return;
    if(modal._mthKey)document.removeEventListener("keydown",modal._mthKey);
    if(modal._mthResize)window.removeEventListener("resize",modal._mthResize);
    if(modal._mthRaf)cancelAnimationFrame(modal._mthRaf);
    modal.remove();
    document.documentElement.style.overflow="";
    if(returnTo&&returnTo.focus)try{returnTo.focus()}catch(e){}
  };
  function imageInfo(url){
    return new Promise(function(resolve){
      var im=new Image();
      im.onload=function(){resolve({w:im.naturalWidth||im.width,h:im.naturalHeight||im.height})};
      im.onerror=function(){resolve({w:0,h:0})};
      im.src=url;
    });
  }
  function previewPayload(src,host){
    if(src.tagName==="CANVAS"){
      if(!src.width||!src.height)return null;
      var merged=compositeLayers(alignedLayers(host,src));
      try{
        return {url:merged.toDataURL("image/png"),w:merged.width,h:merged.height,name:"multi-tool-hub-preview.png"};
      }catch(e){return null}
    }
    var url=src.currentSrc||src.src;
    if(!url||/^data:,$/.test(url))return null;
    var mime=(url.match(/^data:(image\/[a-z0-9.+-]+)[;,]/i)||[])[1]||"";
    var byMime={ "image/png":"png","image/jpeg":"jpg","image/jpg":"jpg","image/webp":"webp","image/gif":"gif","image/svg+xml":"svg" };
    var ext=byMime[mime.toLowerCase()]||(url.match(/\.(png|jpe?g|webp|gif|svg)(?:[?#]|$)/i)||[,"png"])[1].toLowerCase();
    return {url:url,w:src.naturalWidth||src.width||0,h:src.naturalHeight||src.height||0,name:"multi-tool-hub-preview."+ext};
  }
  PE.openPreview=async function(el,returnTo){
    el=el||returnTo;
    var src=el;
    if(!src||(src.tagName!=="CANVAS"&&src.tagName!=="IMG"))src=previewSource(el);
    if(!src){PE.toast("There is no preview to enlarge yet.");return}
    var host=returnTo&&returnTo!==src?returnTo:(src.parentElement||null);
    var info=previewPayload(src,host);
    if(!info){PE.toast(src.tagName==="CANVAS"?"The preview is still rendering. Try again in a moment.":"This preview cannot be enlarged.");return}
    if(!info.w||!info.h){
      var size=await imageInfo(info.url);
      info.w=size.w;info.h=size.h;
    }
    if(!info.w||!info.h){PE.toast("This preview has no visible image yet.");return}

    var label=previewLabel(src);
    var modal=document.createElement("div");
    modal.className="pv-modal";
    modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label","Enlarged preview of "+label);
    modal.innerHTML=
      '<div class="pv-box">'+
        '<div class="pv-head">'+
          '<div class="pv-title"><b>'+PE.esc(label)+'</b><span class="pv-state" data-pv-state>Fit</span></div>'+
          '<div class="pv-tools">'+
            '<button type="button" class="pv-ib" data-pv="out" aria-label="Zoom out" title="Zoom out"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>'+
            '<input class="pv-zoom" type="range" min="10" max="400" value="100" step="1" aria-label="Preview zoom percentage">'+
            '<output class="pv-pct" data-pv-pct>100%</output>'+
            '<button type="button" class="pv-ib" data-pv="in" aria-label="Zoom in" title="Zoom in"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>'+
            '<span class="pv-div" aria-hidden="true"></span>'+
            '<button type="button" class="pv-txt" data-pv="fit" aria-pressed="true" title="Fit the whole preview in the window">Fit</button>'+
            '<button type="button" class="pv-txt" data-pv="actual" aria-pressed="false" title="Show the image at its native size">1:1</button>'+
            '<button type="button" class="pv-txt pv-download" data-pv="download" title="Download this preview as an image">Download</button>'+
            '<button type="button" class="pv-close" data-pv="close" aria-label="Close enlarged preview" title="Close (Esc)"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>'+
          '</div>'+
        '</div>'+
        '<div class="pv-stage" data-pv-stage tabindex="0" aria-label="Interactive preview. Drag to pan, scroll to zoom, double-click to switch between fit and actual size.">'+
          '<img alt="'+PE.esc(label)+'" draggable="false">'+
        '</div>'+
        '<div class="pv-foot"><span data-pv-dims>'+info.w+' × '+info.h+' px</span><span class="pv-help">Drag to pan · scroll or pinch to zoom · double-click to fit</span><span class="pv-live">Live preview</span></div>'+
      '</div>';
    document.body.appendChild(modal);
    document.documentElement.style.overflow="hidden";

    var stage=modal.querySelector("[data-pv-stage]");
    var img=modal.querySelector("img");
    var zoom=modal.querySelector(".pv-zoom");
    var pct=modal.querySelector("[data-pv-pct]");
    var stateEl=modal.querySelector("[data-pv-state]");
    var dims=modal.querySelector("[data-pv-dims]");
    var fitBtn=modal.querySelector('[data-pv="fit"]');
    var actualBtn=modal.querySelector('[data-pv="actual"]');
    var download=modal.querySelector('[data-pv="download"]');
    var iw=info.w, ih=info.h, scale=1, tx=0, ty=0, mode="fit", dragging=false, lastX=0, lastY=0;
    var pointers=new Map(), pinchStart=0, pinchScale=1;

    img.src=info.url;
    img.style.width=iw+"px";img.style.height=ih+"px";
    download.href=info.url;
    download.setAttribute("download",info.name);

    function fitScale(){
      var pad=stage.clientWidth<560?24:48;
      var s=Math.min((stage.clientWidth-pad)/iw,(stage.clientHeight-pad)/ih,4);
      return Math.max(0.05,Math.min(4,s));
    }
    function clampPan(){
      var mx=Math.max(0,(iw*scale-stage.clientWidth)/2)+18;
      var my=Math.max(0,(ih*scale-stage.clientHeight)/2)+18;
      tx=PE.clamp(tx,-mx,mx);ty=PE.clamp(ty,-my,my);
    }
    function paint(){
      clampPan();
      img.style.transform="translate(-50%,-50%) translate("+tx+"px,"+ty+"px) scale("+scale+")";
      var n=Math.round(scale*100);
      pct.textContent=n+"%";zoom.value=PE.clamp(n,10,400);
      stateEl.textContent=mode==="fit"?"Fit":(mode==="actual"?"Actual size":"Zoom");
      fitBtn.setAttribute("aria-pressed",mode==="fit"?"true":"false");
      actualBtn.setAttribute("aria-pressed",mode==="actual"?"true":"false");
      dims.textContent=iw+" × "+ih+" px · "+n+"%";
    }
    function fit(){
      mode="fit";tx=0;ty=0;scale=fitScale();paint();
    }
    function setZoom(next,px,py){
      next=PE.clamp(next,0.1,4);
      if(px==null){px=stage.clientWidth/2;py=stage.clientHeight/2}
      var ox=(px-stage.clientWidth/2-tx)/scale;
      var oy=(py-stage.clientHeight/2-ty)/scale;
      scale=next;mode="manual";
      tx=px-stage.clientWidth/2-ox*scale;
      ty=py-stage.clientHeight/2-oy*scale;
      paint();
    }
    function actual(){mode="actual";scale=1;tx=0;ty=0;paint()}
    fit();
    modal.querySelector(".pv-tools").addEventListener("click",function(e){
      var b=e.target.closest("[data-pv]");if(!b)return;
      var k=b.getAttribute("data-pv");
      if(k==="in")setZoom(scale*1.25);
      else if(k==="out")setZoom(scale/1.25);
      else if(k==="fit")fit();
      else if(k==="actual")actual();
      else if(k==="download"){/* the anchor handles it */}
      else if(k==="close")closePreview(modal,returnTo);
    });
    zoom.addEventListener("input",function(){setZoom(+zoom.value/100)});
    stage.addEventListener("wheel",function(e){
      e.preventDefault();
      var r=stage.getBoundingClientRect();
      setZoom(scale*(e.deltaY<0?1.12:0.892),e.clientX-r.left,e.clientY-r.top);
    },{passive:false});
    stage.addEventListener("pointerdown",function(e){
      if(e.pointerType==="mouse"&&e.button!==0)return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      try{stage.setPointerCapture(e.pointerId)}catch(x){}
      if(pointers.size===1){dragging=true;lastX=e.clientX;lastY=e.clientY;stage.classList.add("drag")}
      if(pointers.size===2){
        var p=Array.from(pointers.values());
        pinchStart=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1;
        pinchScale=scale;dragging=false;
      }
    });
    stage.addEventListener("pointermove",function(e){
      if(!pointers.has(e.pointerId))return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===2&&pinchStart){
        var p=Array.from(pointers.values());
        var d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)||1;
        setZoom(pinchScale*d/pinchStart);
        return;
      }
      if(!dragging)return;
      tx+=e.clientX-lastX;ty+=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
      mode="manual";paint();
    });
    function endPointer(e){
      pointers.delete(e.pointerId);
      if(pointers.size<2)pinchStart=0;
      if(pointers.size===0){dragging=false;stage.classList.remove("drag")}
    }
    stage.addEventListener("pointerup",endPointer);
    stage.addEventListener("pointercancel",endPointer);
    stage.addEventListener("dblclick",function(){if(mode==="fit")actual();else fit()});
    modal.addEventListener("click",function(e){if(e.target===modal)closePreview(modal,returnTo)});
    modal.querySelector(".pv-close").focus();
    modal._mthKey=function(e){
      if(e.key==="Escape"){e.preventDefault();closePreview(modal,returnTo);return}
      if(!stage.contains(document.activeElement)&&document.activeElement!==stage)return;
      if(e.key==="+"||e.key==="="){e.preventDefault();setZoom(scale*1.25)}
      else if(e.key==="-"){e.preventDefault();setZoom(scale/1.25)}
      else if(e.key==="0"){e.preventDefault();fit()}
      else if(e.key==="1"){e.preventDefault();actual()}
      else if(e.key.indexOf("Arrow")===0){
        e.preventDefault();var step=e.shiftKey?60:20;
        if(e.key==="ArrowLeft")tx-=step;if(e.key==="ArrowRight")tx+=step;
        if(e.key==="ArrowUp")ty-=step;if(e.key==="ArrowDown")ty+=step;
        mode="manual";paint();
      }
    };
    document.addEventListener("keydown",modal._mthKey);
    modal._mthResize=function(){if(mode==="fit")fit();else paint()};
    window.addEventListener("resize",modal._mthResize);
  };
  function addPreviewButton(host){
    if(!host||host.dataset.pvReady)return;
    if(host.closest(".pv-modal")||host.id==="hubchat"||host.closest("#hubchat"))return;
    var src=previewSource(host);
    if(!src)return;
    host.dataset.pvReady="1";
    if(getComputedStyle(host).position==="static")host.style.position="relative";
    var b=document.createElement("button");
    b.type="button";b.className="pvexpand";b.setAttribute("aria-label","Open a large interactive preview");
    b.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg><span>Large preview</span>';
    b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();PE.openPreview(src,host)});
    host.appendChild(b);
  }
  PE.enhancePreviews=function(){
    var hosts=[];
    document.querySelectorAll(".pvframe,.wm-pv,.pn-wrap,.crop-wrap,.stage,.preview-box,.preview-wrap").forEach(function(h){hosts.push(h)});
    document.querySelectorAll("canvas#pv,canvas#base,canvas#out,canvas#preview,img#pv,img#preview").forEach(function(el){
      var host=el.parentElement;
      if(host&&!host.closest(".pvframe,.wm-pv,.pn-wrap,.crop-wrap,.stage,.preview-box,.preview-wrap"))hosts.push(host);
    });
    hosts.forEach(addPreviewButton);
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",PE.enhancePreviews);else PE.enhancePreviews();
  try{
    var pvTimer=null,mo=new MutationObserver(function(){
      if(pvTimer)return;
      pvTimer=setTimeout(function(){pvTimer=null;PE.enhancePreviews()},220);
    });
    mo.observe(document.body,{childList:true,subtree:true});
  }catch(e){}

  /* Build a ZIP in the background without freezing the page. */
  PE.zip=async function(entries,onProgress){
    if(typeof JSZip==="undefined")throw new Error("The ZIP builder did not load. Check your connection and refresh.");
    var z=new JSZip();
    entries.forEach(function(e){z.file(e.name,e.data)});
    return z.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}},function(m){if(onProgress)onProgress(m.percent/100)});
  };

  /* Numbers with sensible rounding */
  PE.round=function(v,n){var p=Math.pow(10,n==null?1:n);return Math.round(v*p)/p};

  /* Ask the hub assistant about something (available on every page). */
  PE.askHub=function(text){if(typeof window.openHubChat==="function"){window.openHubChat();window.hubAsk&&window.hubAsk(text)}};

  /* Report the page to the assistant for support/debugging. */
  PE.context=function(extra){
    var c={page:location.pathname,title:document.title,ua:navigator.userAgent.split(") ")[0]+")",online:navigator.onLine,logs:PE.logs.slice(-12)};
    if(extra)for(var k in extra)c[k]=extra[k];
    return c;
  };
  PE.exportLogs=function(){
    var txt="MULTI TOOL HUB diagnostics\n"+JSON.stringify(PE.context(),null,2);
    PE.download(new Blob([txt],{type:"text/plain"}),"multi-tool-hub-diagnostics.txt");
  };
})();

/* Offline support */
(function(){
  var s=document.currentScript;
  if("serviceWorker" in navigator&&s&&/^https?:/.test(location.protocol))
    navigator.serviceWorker.register(new URL("../sw.js",s.src).href).catch(function(){});
})();
