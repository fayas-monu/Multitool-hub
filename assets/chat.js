/* MULTI TOOL HUB — Hub Assistant (runs fully in the browser). Credit: (hank!nd3 p4d4y41! | FAYAS MONU */
(function(){
  var me=document.currentScript,base=new URL("../",me.src).href;
  var T=[
    ["Merge PDF","tools/merge-pdf.html","merge combine join several pdfs together one file append"],
    ["Split PDF","tools/split-pdf.html","split extract separate pages range cut apart"],
    ["Organize Pages","tools/organize-pdf.html","organize reorder rearrange delete remove pages order sort"],
    ["Rotate PDF","tools/rotate-pdf.html","rotate turn sideways upside landscape portrait"],
    ["Compress PDF","tools/compress-pdf.html","compress shrink reduce size smaller email too big large"],
    ["Crop PDF","tools/crop-pdf.html","crop trim margins cut edges"],
    ["PDF Editor","tools/editor.html","edit text sign signature fill form highlight draw annotate type whiteout acrobat"],
    ["Watermark","tools/watermark.html","watermark stamp confidential draft logo overlay"],
    ["Page Numbers","tools/page-numbers.html","page numbers numbering number pages footer"],
    ["PDF to Word","tools/pdf-to-word.html","word docx doc convert editable document"],
    ["PDF to JPG","tools/pdf-to-jpg.html","pdf to jpg image picture png export pages"],
    ["JPG to PDF","tools/jpg-to-pdf.html","jpg to pdf image photo png webp scan pictures"],
    ["Video to MP3","tools/video-to-mp3.html","mp3 audio extract video music sound convert"],
    ["YouTube Downloader","tools/youtube-downloader.html","youtube download video yt"],
    ["Instagram Downloader","tools/instagram-downloader.html","instagram reel story download insta"]
  ];
  var FAQ=[
    [/free|price|cost|pay|subscription|limit/,"Everything is free, with no sign-up and no daily limits. Large files are limited only by your device’s memory."],
    [/upload|private|privacy|safe|secure|server|stored/,"PDF, image and audio files are processed inside your browser and are never uploaded. Only the YouTube and Instagram downloaders send the link you paste to the Loader.to API. Details are in the <a href='{b}privacy.html'>Privacy Policy</a>."],
    [/offline|internet|no wifi/,"After your first visit the tools can work offline, because the site saves itself in your browser. The downloaders always need internet."],
    [/password|protected|encrypt/,"Password-protected PDFs can’t be opened by these tools yet. Remove the password in your PDF viewer first, then try again."],
    [/size|big|large|memory|crash|slow|hang/,"Very large files can run slowly because your device does all the work. Try Split PDF first, or close other tabs. Compress PDF can shrink image-heavy files."],
    [/phone|mobile|android|iphone|ios|tablet/,"Yes, it works on phones and tablets. Add the site to your home screen to use it like an app."],
    [/format|support|type|file types/,"PDF tools take .pdf files. JPG to PDF accepts JPG, PNG and WebP. Video to MP3 accepts MP4, WebM, MOV and most audio files."],
    [/not working|error|failed|broken|bug|problem|doesn/,"Sorry about that. Please try again with a smaller file, check that the PDF has no password, and refresh the page. If it keeps failing, message the creator on Instagram and describe what happened."],
    [/creator|who made|owner|developer|fayas|contact|support|instagram.*creator/,"MULTI TOOL HUB is created by <strong>(hank!nd3 p4d4y41! | FAYAS MONU</strong>. Message on Instagram: <a href='https://www.instagram.com/____fa_y_as_____' target='_blank' rel='noopener'>@____fa_y_as_____</a>"],
    [/terms|conditions/,"You can read the <a href='{b}terms.html'>Terms &amp; Conditions</a> any time."],
    [/api|loader/,"The YouTube and Instagram downloaders are powered by the Loader.to API. All other tools run on your device."],
    [/scan|ocr/,"Scanned PDFs are pictures, so PDF to Word can’t read their text yet. Use PDF to JPG if you only need the pages as images."]
  ];
  var css="#hubfab{position:fixed;right:18px;bottom:18px;z-index:9998;width:60px;height:60px;border:0;border-radius:18px;padding:0;cursor:pointer;background:none;filter:drop-shadow(0 10px 18px rgba(30,30,120,.4));transition:transform .15s}#hubfab:hover{transform:translateY(-3px) rotate(-4deg)}#hubfab img{width:60px;height:60px}#hubfab i{position:absolute;top:-3px;right:-3px;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;display:none}"+
  "#hubchat{display:none;position:fixed;right:18px;bottom:90px;z-index:9999;width:min(370px,calc(100vw - 24px));height:min(560px,76vh);flex-direction:column;overflow:hidden;border-radius:20px;background:var(--surface,#fff);color:var(--ink,#11162b);border:1px solid var(--line,#d9deea);box-shadow:0 30px 60px -15px rgba(10,12,40,.45);font:14px 'Plus Jakarta Sans',system-ui,sans-serif}#hubchat.open{display:flex}"+
  "#hubchat .h{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#1b1f45,#3d3bf3);color:#fff}#hubchat .h img{width:36px;height:36px}#hubchat .h b{display:block;font-size:14.5px}#hubchat .h small{opacity:.8;font-size:11.5px}#hubchat .h span{flex:1}#hubchat .h button{background:rgba(255,255,255,.14);border:0;color:#fff;width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:15px}"+
  "#hubchat .b{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--bg,#f2f4f9)}#hubchat .m{max-width:88%;padding:10px 13px;border-radius:14px;line-height:1.5;white-space:pre-line}#hubchat .m.bot{background:var(--surface,#fff);border:1px solid var(--line,#d9deea);align-self:flex-start;border-bottom-left-radius:4px}#hubchat .m.me{background:var(--accent,#3d3bf3);color:var(--accent-ink,#fff);align-self:flex-end;border-bottom-right-radius:4px}#hubchat .m a{color:var(--accent,#3d3bf3);font-weight:700}"+
  "#hubchat .c{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;background:var(--bg,#f2f4f9)}#hubchat .c button,#hubchat .card{font:600 12.5px 'Plus Jakarta Sans',sans-serif;border:1px solid var(--line,#d9deea);background:var(--surface,#fff);color:var(--ink,#11162b);border-radius:18px;padding:6px 12px;cursor:pointer;text-decoration:none}#hubchat .c button:hover,#hubchat .card:hover{border-color:var(--accent,#3d3bf3);color:var(--accent,#3d3bf3)}"+
  "#hubchat .card{display:inline-block;margin:6px 6px 0 0;border-radius:10px}#hubchat .dots span{display:inline-block;width:7px;height:7px;margin:0 2px;border-radius:50%;background:var(--muted,#59627c);animation:hd 1s infinite}#hubchat .dots span:nth-child(2){animation-delay:.15s}#hubchat .dots span:nth-child(3){animation-delay:.3s}@keyframes hd{0%,60%,100%{opacity:.25}30%{opacity:1}}"+
  "#hubchat form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line,#d9deea);background:var(--surface,#fff)}#hubchat input{flex:1;min-width:0;padding:10px 12px;border:1px solid var(--line,#d9deea);border-radius:12px;background:var(--bg,#f2f4f9);color:inherit;font:inherit}#hubchat form button{border:0;border-radius:12px;background:var(--accent,#3d3bf3);color:var(--accent-ink,#fff);font-weight:700;padding:0 16px;cursor:pointer}";
  var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
  var fab=document.createElement("button");fab.id="hubfab";fab.setAttribute("aria-label","Open Hub Assistant");fab.innerHTML='<img src="'+base+'assets/logo.svg" alt=""><i></i>';
  var box=document.createElement("div");box.id="hubchat";box.setAttribute("role","dialog");box.setAttribute("aria-label","Hub Assistant");
  box.innerHTML='<div class="h"><img src="'+base+'assets/logo.svg" alt=""><span><b>Hub Assistant</b><small>● Online · replies instantly</small></span><button type="button" data-x="clear" title="Clear chat" aria-label="Clear chat">⟲</button><button type="button" data-x="close" aria-label="Close">✕</button></div><div class="b" id="hb" aria-live="polite"></div><div class="c" id="hc"></div><form><input id="hi" placeholder="Ask anything, e.g. “make my PDF smaller”" autocomplete="off" aria-label="Message"><button>Send</button></form>';
  document.body.append(box,fab);
  var $=function(i){return document.getElementById(i)},hist=[];
  function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}
  function save(){try{sessionStorage.setItem("hubchat",JSON.stringify(hist.slice(-40)))}catch(e){}}
  function add(who,html,noSave){var m=document.createElement("div");m.className="m "+who;m.innerHTML=html;$("hb").appendChild(m);$("hb").scrollTop=1e9;if(!noSave){hist.push([who,html]);save()}return m}
  function chips(l){$("hc").innerHTML="";l.forEach(function(t){var b=document.createElement("button");b.type="button";b.textContent=t;b.onclick=function(){ask(t)};$("hc").appendChild(b)})}
  var HOME=["Find a tool","Make a PDF smaller","Is it private?","Contact"];
  function cards(list){return list.map(function(t){return '<a class="card" href="'+base+t[1]+'">'+t[0]+' →</a>'}).join("")}
  function findTools(q){var w=q.toLowerCase().split(/[^a-z0-9]+/).filter(function(x){return x.length>2});
    return T.map(function(t){var s=0,k=t[2]+" "+t[0].toLowerCase();w.forEach(function(x){if(k.indexOf(x)>-1)s+=x.length>3?2:1});return[s,t]}).filter(function(x){return x[0]>0}).sort(function(a,b){return b[0]-a[0]}).slice(0,3).map(function(x){return x[1]})}
  function theme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem("theme",t)}catch(e){}}
  function reply(q){
    var l=q.toLowerCase().trim();
    if(/^(hi|hello|hey|salam|hai)\b/.test(l))return["Hello! 👋 Tell me what you want to do with your file, and I’ll point you to the right tool.",HOME];
    if(/dark/.test(l)&&/mode|theme|on/.test(l)){theme("dark");return["Dark mode is on. 🌙",["Light mode"]]}
    if(/light/.test(l)&&/mode|theme|on/.test(l)){theme("light");return["Light mode is on. ☀️",["Dark mode"]]}
    if(/^(find a tool|tools|all tools|list|what can you do|tools info)/.test(l))return["Here is everything I know:<br>"+cards(T),["Is it private?","Contact"]];
    if(/how (do|to|can)|guide|steps|use/.test(l)&&!findTools(l).length)return["1. Pick a tool.\n2. Add your file (drag it in or tap to choose).\n3. Adjust the options and download the result.",HOME];
    for(var i=0;i<FAQ.length;i++)if(FAQ[i][0].test(l))return[FAQ[i][1].replace(/\{b\}/g,base),HOME];
    var f=findTools(l);
    if(f.length)return["I’d use "+(f.length>1?"one of these":"this")+":<br>"+cards(f),["Find a tool","Is it private?"]];
    return["I’m not sure about that one. I can help you choose a tool, explain privacy, or share contact details.",HOME];
  }
  function ask(t){
    t=(t||"").trim();if(!t)return;add("me",esc(t));$("hi").value="";$("hc").innerHTML="";
    var d=add("bot",'<span class="dots"><span></span><span></span><span></span></span>',true),r=reply(t);
    setTimeout(function(){d.remove();add("bot",r[0]);chips(r[1]||HOME)},420);
  }
  function open(v){box.classList.toggle("open",v);fab.querySelector("i").style.display="none";if(v)$("hi").focus()}
  fab.onclick=function(){open(!box.classList.contains("open"))};
  box.onclick=function(e){var x=e.target.getAttribute&&e.target.getAttribute("data-x");if(x==="close")open(false);if(x==="clear"){hist=[];save();$("hb").innerHTML="";start()}};
  box.querySelector("form").onsubmit=function(e){e.preventDefault();ask($("hi").value)};
  document.addEventListener("keydown",function(e){if(e.key==="Escape")open(false)});
  window.openHubChat=function(){open(true)};
  function start(){add("bot","Hi, I’m the Hub Assistant. 👋 I can find the right tool, answer questions about privacy and formats, or switch dark mode for you.",true);chips(HOME)}
  try{hist=JSON.parse(sessionStorage.getItem("hubchat")||"[]")}catch(e){}
  if(hist.length){hist.forEach(function(m){add(m[0],m[1],true)});chips(HOME)}else{start();setTimeout(function(){if(!box.classList.contains("open"))fab.querySelector("i").style.display="block"},8000)}
})();
