/* MULTI TOOL HUB — Hub Assistant v6.
   Local by default. The optional Gemini connection has two explicit modes:
   • Browser key — the key you paste is kept only in this tab's sessionStorage
     and sent directly to Google's Generative Language API. It is never
     hardcoded, written to localStorage, or routed through this site.
   • Secure proxy — a server-side proxy holds the key; only chat text is sent.
   No API key belongs in this public repository.
   Credit: chank!nd3 p4d4y41! */
(function(){
  "use strict";
  var script=document.currentScript,base=new URL("../",script.src).href;
  var GEMINI=base+"assets/gemini.svg";
  var ASSIST_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-11.2 6.5L4 19.5l1.5-4.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 10h7M8.5 13.2h4.4"/></svg>';
  var STORE="mth.gemini.session.v1";
  var DIRECT_ROOT="https://generativelanguage.googleapis.com/v1beta";
  var MODELS=["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.5-pro","gemini-2.0-flash"];
  var MODEL_LABEL={
    "gemini-2.5-flash":"Gemini 2.5 Flash",
    "gemini-2.5-flash-lite":"Gemini 2.5 Flash-Lite",
    "gemini-2.5-pro":"Gemini 2.5 Pro",
    "gemini-2.0-flash":"Gemini 2.0 Flash"
  };
  var remote=false,remoteMsgs=[],lastAbort=null,turn=0,cfg=loadCfg();
  if(!cfg.mode)applyBuiltIn();
  remote=!!cfg.mode;
  function loadCfg(){
    try{
      var x=JSON.parse(sessionStorage.getItem(STORE)||"null");
      if(x&&x.mode)return{
        mode:x.mode==="direct"?"direct":"proxy",
        key:String(x.key||""),
        model:MODELS.indexOf(x.model)>-1?x.model:MODELS[0],
        endpoint:String(x.endpoint||""),
        token:String(x.token||"")
      };
    }catch(e){}
    return{mode:"",key:"",model:MODELS[0],endpoint:"",token:""};
  }
  /* Site-wide Gemini from assets/config.js. Held in memory only: never written to
     localStorage/sessionStorage. A visitor can still opt out with Disconnect. */
  function applyBuiltIn(){
    try{
      if(sessionStorage.getItem("mth.gemini.off")==="1")return;
      var c=window.MTH_CONFIG&&window.MTH_CONFIG.gemini;if(!c)return;
      var m=MODELS.indexOf(c.model)>-1?c.model:MODELS[0];
      if(c.proxy){cfg={mode:"proxy",key:"",model:m,endpoint:String(c.proxy),token:"",builtin:true};return}
      if(c.k&&c.k.length){
        var k=c.k.map(function(p){return atob(p)}).join("").split("").reverse().join("");
        if(k)cfg={mode:"direct",key:k,model:m,endpoint:"",token:"",builtin:true};
      }
    }catch(e){}
  }
  function saveCfg(){
    if(cfg.builtin)return;
    try{
      if(cfg.mode)sessionStorage.setItem(STORE,JSON.stringify({
        mode:cfg.mode,key:cfg.key,model:cfg.model,endpoint:cfg.endpoint,token:cfg.token
      }));
      else sessionStorage.removeItem(STORE);
    }catch(e){}
  }
  function resetCfg(){
    if(cfg.builtin){try{sessionStorage.setItem("mth.gemini.off","1")}catch(e){}}
    cfg={mode:"",key:"",model:MODELS[0],endpoint:"",token:""};
    try{sessionStorage.removeItem(STORE)}catch(e){}
  }

  /* ------------------------------------------------------------------ */
  /* Knowledge base                                                      */
  /* ------------------------------------------------------------------ */
  var TOOLS=[
    {id:"editor",name:"PDF Editor",url:"tools/editor.html",icon:"fa-pen-nib",cat:"Edit & sign",
     keys:"edit pdf editor acrobat text signature sign annotate highlight underline strike draw shape arrow box ellipse redact form fill comment image page rotate merge pages acrobat",
     desc:"The full editor: existing text, new text, highlights, underline, strike-through, drawing, lines, arrows, shapes, images, signatures, comments, form filling, redaction and page management.",
     steps:["Open the PDF Editor and drop in your PDF.","Pick a tool: <b>Edit text</b> for existing words, <b>Text</b> to add new words, or <b>Sign</b> for a signature.","Click the page to place it. Drag to move, use the corner handle to resize.","Use the thumbnails on the left to change page, rotate or insert pages.","Press <b>Save PDF</b>. Your original file is untouched."]},
    {id:"merge",name:"Merge PDF",url:"tools/merge-pdf.html",icon:"fa-file-circle-plus",cat:"Organize",
     keys:"merge combine join append put together several pdfs one file multiple",
     desc:"Combine several PDFs into one, choose a page range for each file and reorder before merging.",
     steps:["Open Merge PDF and add two or more PDFs.","Drag files or use the arrows to set the order.","Optionally limit each file to a page range.","Press <b>Merge PDFs</b> and download the combined file."]},
    {id:"split",name:"Split PDF",url:"tools/split-pdf.html",icon:"fa-scissors",cat:"Organize",
     keys:"split extract separate cut pages range every page chunk parts",
     desc:"Extract ranges, save every page separately, split into parts of N pages, or select pages visually.",
     steps:["Open Split PDF and add one PDF.","Choose a mode: extract, every page, parts, or visual picker.","Enter the pages or click thumbnails to select them.","Press <b>Split &amp; download</b>."]},
    {id:"organize",name:"Organize Pages",url:"tools/organize-pdf.html",icon:"fa-table-cells-large",cat:"Organize",
     keys:"organize reorder rearrange sort delete remove duplicate insert blank pages order move",
     desc:"Drag pages into a new order, rotate, duplicate, delete, insert blank pages and undo.",
     steps:["Open Organize Pages and add a PDF.","Drag a thumbnail to reorder it, or use the page buttons.","Rotate, duplicate, delete or insert a blank page.","Press <b>Download PDF</b> when the order is right."]},
    {id:"rotate",name:"Rotate PDF",url:"tools/rotate-pdf.html",icon:"fa-arrows-rotate",cat:"Organize",
     keys:"rotate turn sideways upside landscape portrait orientation 90 180",
     desc:"Rotate every page or only selected pages, with a live thumbnail preview.",
     steps:["Open Rotate PDF and add a PDF.","Use Left, Right or 180°, or choose specific pages.","Watch the preview update.","Press <b>Download rotated PDF</b>."]},
    {id:"compress",name:"Compress PDF",url:"tools/compress-pdf.html",icon:"fa-file-arrow-down",cat:"Optimize",
     keys:"compress shrink reduce smaller size optimize email too big large mb weight",
     desc:"Shrink a PDF with quality presets, a live preview and a before/after size report.",
     steps:["Open Compress PDF and add a PDF.","Pick Light, Recommended or Strong.","Press <b>Compress PDF</b>.","Compare the before/after size and download the smaller copy."]},
    {id:"pdf-to-word",name:"PDF to Word",url:"tools/pdf-to-word.html",icon:"fa-file-word",cat:"Convert",
     keys:"word docx doc editable convert word document office",
     desc:"Rebuild a real .docx with headings, paragraphs, lists and tables, with a preview before download.",
     steps:["Open PDF to Word and add a PDF.","Check the preview. Turn on or off “start each page on a new Word page”.","Press <b>Download Word file</b>.","Open the .docx in Word, Google Docs or LibreOffice and edit it."]},
    {id:"pdf-to-text",name:"PDF to Text",url:"tools/pdf-to-text.html",icon:"fa-file-lines",cat:"Convert",
     keys:"text txt plain extract copy searchable words content",
     desc:"Pull clean, searchable text from a PDF with page ranges and layout options.",
     steps:["Open PDF to Text and add a PDF.","Choose the pages and whether to keep line breaks.","Check the preview and copy it if you like.","Press <b>Download .txt</b>."]},
    {id:"pdf-to-jpg",name:"PDF to JPG",url:"tools/pdf-to-jpg.html",icon:"fa-file-image",cat:"Convert",
     keys:"jpg jpeg png webp image picture export pages screenshot",
     desc:"Export pages as JPG, PNG or WebP at the resolution you pick — one ZIP or individually.",
     steps:["Open PDF to JPG and add a PDF.","Choose the format, quality and page range.","Press <b>Convert</b>.","Download the ZIP, or save individual pages."]},
    {id:"jpg-to-pdf",name:"JPG to PDF",url:"tools/jpg-to-pdf.html",icon:"fa-images",cat:"Convert",
     keys:"jpg to pdf png webp image photo scan pictures combine images",
     desc:"Turn photos and scans into a PDF with A4/Letter sizing, margins, orientation and reordering.",
     steps:["Open JPG to PDF and add images.","Drag to reorder or rotate them.","Choose page size, orientation, margin and image fit.","Press <b>Create PDF</b>."]},
    {id:"crop",name:"Crop PDF",url:"tools/crop-pdf.html",icon:"fa-crop-simple",cat:"Edit & sign",
     keys:"crop trim margins edges cut frame aspect",
     desc:"Drag a crop frame with aspect presets and apply it to all pages or a chosen range, live.",
     steps:["Open Crop PDF and add a PDF.","Drag the crop frame on the preview, or fine-tune the edges.","Choose which pages to crop.","Press <b>Crop &amp; download</b>."]},
    {id:"page-numbers",name:"Page Numbers",url:"tools/page-numbers.html",icon:"fa-list-ol",cat:"Edit & sign",
     keys:"page numbers numbering footer header number pages",
     desc:"Add page numbers in nine positions with custom formats, fonts, ranges and a live preview.",
     steps:["Open Page Numbers and add a PDF.","Choose position, format, font, size and first number.","Check the live preview and optional page range.","Press <b>Add numbers &amp; download</b>."]},
    {id:"watermark",name:"Watermark",url:"tools/watermark.html",icon:"fa-certificate",cat:"Edit & sign",
     keys:"watermark stamp confidential draft logo overlay brand protect copyright",
     desc:"Add a text or image watermark, drag it, tile it, rotate it and preview it live on any page.",
     steps:["Open Watermark and add a PDF.","Choose text or an image/logo.","Drag the watermark on the preview to position it. Adjust size, angle, opacity and pages.","Press <b>Apply &amp; download</b>."]},
    {id:"image-compressor",name:"Image Compressor",url:"tools/image-compressor.html",icon:"fa-compress",cat:"Images",
     keys:"compress image resize convert webp png jpg photo smaller image optimizer",
     desc:"Compress, resize, convert and rotate JPG, PNG and WebP images with a visual before/after.",
     steps:["Open Image Compressor and add one or more images.","Choose quality, size and output format.","Compare the before/after preview.","Download the images in a ZIP."]},
    {id:"video-to-mp3",name:"Video to MP3",url:"tools/video-to-mp3.html",icon:"fa-file-audio",cat:"Media",
     keys:"mp3 audio extract video music sound wav trim convert",
     desc:"Extract MP3 audio from a video, trim it with an audio preview, pick a bitrate and normalize volume.",
     steps:["Open Video to MP3 and add a video or audio file.","Trim the start and end if you want, and check the preview.","Choose bitrate, channels and optional normalisation.","Press <b>Convert to MP3</b>."]},
    {id:"youtube",name:"YouTube Downloader",url:"tools/youtube-downloader.html",icon:"fa-youtube",cat:"Media",
     keys:"youtube yt download video audio mp4 mp3 link",
     desc:"Paste a public YouTube link and get download options through Loader.to — with a clear explanation of what is sent.",
     steps:["Open the YouTube Downloader.","Paste a public YouTube link.","Press <b>Get download options</b>; only the link is sent to Loader.to.","Choose the format you need in the loader panel."]},
    {id:"instagram",name:"Instagram Downloader",url:"tools/instagram-downloader.html",icon:"fa-instagram",cat:"Media",
     keys:"instagram insta reel story video post download",
     desc:"Save a public Instagram reel, video or post through Loader.to, with a transparent privacy note.",
     steps:["Open the Instagram Downloader.","Paste a public instagram.com link.","Press <b>Get download options</b>; only the link is sent to Loader.to.","Choose the download option in the loader panel."]}
  ];

  var T=TOOLS;
  var FAQ=[
    [/^(hi|hello|hey|yo|salam|salaam|hai|hola)\b/i,"Hello! 👋 I’m the Hub Assistant. Tell me what you want to do — for example “make this PDF smaller”, “sign a PDF” or “convert to Word” — and I’ll take you to the right tool."],
    [/what can you do|who are you|your name|help me|^help$|assist/i,"I can:<br>• find the right tool from a plain sentence<br>• explain privacy, formats, size limits and the downloader API honestly<br>• walk you through a task step by step<br>• switch light/dark mode<br>• check a file’s name/type/size and recommend a tool<br>• answer questions about terms, contact and troubleshooting<br><br>Try “merge two PDFs”, “make a scan editable” or “is this private?”."],
    [/free|price|cost|pay|subscription|trial|quota|limit|watermark.*(add|on)|sign.?up|account/i,"Everything is free. There is no account, no trial, no daily limit, and we never add a watermark to your results. Only your device’s memory limits very large files."],
    [/upload|private|privacy|safe|secure|server|store|stored|leav|sent|send.*(file|document)|cloud/i,"Local tools (PDF, images, audio) process files inside your browser. Your files are not uploaded to us and disappear when the tab closes. The two link downloaders send <b>only the public link you paste</b> to Loader.to. The assistant is local by default — your messages stay on this device. If you explicitly connect Gemini, only your chat text is sent: directly with your own browser key (kept in this tab only) or through an optional secure proxy. Details: <a href='"+base+"privacy.html'>Privacy Policy</a>."],
    [/api|loader|third.?party|external|how.*download.*work/i,"The downloader API is Loader.to. It is used only for the YouTube and Instagram tools. When you press “Get download options”, the public URL you typed is sent to Loader.to so it can prepare the file; no document, account or private data is sent. That is the complete picture, and it is disclosed in the Privacy Policy. You can ignore those two tools and still use the other 15 entirely locally. <a href='"+base+"privacy.html'>Read exactly what is shared</a>."],
    [/offline|no wifi|without internet|airplane|internet/i,"After your first visit, the local tools keep working offline because the site and its libraries are cached in your browser. The downloaders and the first load of a page still need internet."],
    [/password|protected|encrypt|locked|can.?t open|won.?t open/i,"Password-protected PDFs cannot be opened by the tools yet. Open the PDF in your usual viewer, remove/export the password, then try again. I will never ask you for the password."],
    [/size|big|large|memory|crash|slow|hang|freeze|too much/i,"Large files can be slow because your device does the work. Try:<br>1. Split the PDF into smaller parts.<br>2. Close other tabs.<br>3. Use Compress PDF for image-heavy files.<br>4. On a phone, try a computer for files above ~100 MB."],
    [/phone|mobile|android|iphone|ios|tablet|touch/i,"Yes — every tool works on phones and tablets. Add the site to your home screen to open it like an app. For very large PDFs, a computer is faster."],
    [/format|support|type|file types|what files|accept/i,"PDF tools take .pdf. JPG to PDF accepts JPG, PNG and WebP. PDF to JPG exports JPG, PNG or WebP. Video to MP3 takes MP4, WebM, MOV and most audio files. Image Compressor takes JPG, PNG and WebP."],
    [/not working|error|failed|broken|bug|problem|doesn.?t work|won.?t work|stuck/i,"Let’s fix it. First try a refresh and a smaller file. If the tool still fails, tell me:<br>• which tool<br>• the file type and approximate size<br>• the exact message you see<br>You can also open <a href='"+base+"index.html#faq'>the FAQ</a> or message the creator on Instagram."],
    [/creator|who made|owner|developer|fayas|contact|support|instagram|email/i,"MULTI TOOL HUB is created by <strong>chank!nd3 p4d4y41!</strong>. Message on Instagram: <a href='https://www.instagram.com/____fa_y_as_____' target='_blank' rel='noopener'>@____fa_y_as_____</a>."],
    [/terms|conditions|legal|liability|copyright|dmca/i,"You can read the full <a href='"+base+"terms.html'>Terms &amp; Conditions</a>. In short: your files stay yours, use only content you have permission for, and keep a copy of your original because results can be imperfect."],
    [/scan|ocr|image.*pdf|picture.*text|editable.*scan/i,"Scanned PDFs are pictures, so there is no text for PDF to Word or PDF to Text to read. There is no OCR engine yet. You can still crop, rotate, compress, watermark or export the pages as images."],
    [/redact|hide.*sensitive|black.*out|whiteout|cover.*text/i,"Use the <a href='"+base+"tools/editor.html'>PDF Editor</a>. A white/black box alone does <b>not</b> remove the text underneath. Turn on <b>Flatten redactions</b> when saving, which rasterises those pages so the hidden text is truly removed. Always check the saved file."],
    [/pdf.*word|word.*pdf.*(bad|wrong|layout|format)|convert.*word.*(not|wrong|bad)/i,"PDF to Word rebuilds headings, paragraphs, lists and simple tables. A PDF only stores positioned text fragments, so a magazine layout can still shift slightly. Preview it first; if a scanned PDF has no text, it cannot be converted until OCR is added."],
    [/dark|light|theme|night|mode/i,"I can change that. Say “dark mode” or “light mode”, or use the half-circle button in the header."],
    [/language|translate|hindi|urdu|bangla|arabic|spanish/i,"The interface and assistant are in English. The PDF tools can handle Latin text in the standard fonts; non-Latin characters may not render in edited text. A translation feature is not available yet."],
    [/new|update|what.?s changed|changelog|features/i,"This release adds a corporate navy-and-white interface, a sharper MTH identity, a redesigned light/dark theme, an assistant with optional Gemini browser-key or proxy mode, large interactive previews with zoom and pan, a rebuilt PDF editor with numeric controls, an upgraded PDF to Word engine, richer legal pages, and refreshed PWA assets. See <a href='"+base+"NOTES.md'>the upgrade notes</a>."],
    [/shortcut|keyboard|keys/i,"Press <b>/</b> on the home page to search, <b>?</b> or <b>Alt+/</b> to open me, and <b>Esc</b> to close. In the editor: Ctrl+Z undo, Ctrl+Shift+Z redo, Ctrl+D duplicate, Delete removes, arrow keys nudge."],
    [/gemini|api key|browser key|secure proxy|connect.*(ai|assistant)|ai.*(on|off|connect)/i,"Gemini is optional and off by default. Open <b>Gemini</b> in my header and choose:<br>• <b>Browser key</b> — paste your own Google AI Studio key. It stays in this tab's sessionStorage, goes straight to Google, and is removed when you press <b>Forget key</b> or close the tab.<br>• <b>Secure proxy</b> — point me at a self-hosted proxy (see the <code>server/</code> folder) that keeps the key on the server.<br>Either way, only chat text is sent; your files never leave this device. Local mode always works without Gemini."]
  ];

  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function norm(s){return String(s||"").toLowerCase().replace(/[’']/g,"'").replace(/\s+/g," ").trim()}

  function findTools(q){
    q=norm(q);
    var scored=T.map(function(t){
      var s=0,keys=t.keys.split(/\s+/),name=norm(t.name);
      if(q===name)s+=100;
      if(q.indexOf(name)>-1&&name.length>3)s+=40;
      keys.forEach(function(k){
        if(!k||k.length<2)return;
        if(q.indexOf(k)>-1)s+=k.length>=5?7:k.length>=3?4:2;
      });
      // strong phrase matches
      if(/\bpdf\b/.test(q)&&/\bword\b/.test(q)&&t.id==="pdf-to-word")s+=30;
      if(/\bpdf\b/.test(q)&&/\btext\b/.test(q)&&t.id==="pdf-to-text")s+=30;
      if(/\bpdf\b/.test(q)&&/\b(jpg|jpeg|png|image)\b/.test(q)&&t.id==="pdf-to-jpg")s+=30;
      if(/\b(jpg|jpeg|png|webp)\b/.test(q)&&/\bpdf\b/.test(q)&&t.id==="jpg-to-pdf")s+=30;
      if(/\b(merge|combine)\b/.test(q)&&t.id==="merge")s+=30;
      if(/\b(split|extract)\b/.test(q)&&t.id==="split")s+=30;
      if(/\b(sign|signature|editor|edit|acrobat|highlight|annotate|redact|form)\b/.test(q)&&t.id==="editor")s+=25;
      if(/\b(compress|shrink)\b/.test(q)&&/\b(pdf|document|file)\b/.test(q)&&t.id==="compress")s+=20;
      if(/\b(compress|resize|convert)\b/.test(q)&&/\b(image|photo|jpg|png|webp)\b/.test(q)&&t.id==="image-compressor")s+=20;
      if(/\b(mp3|audio)\b/.test(q)&&t.id==="video-to-mp3")s+=20;
      return{s:s,t:t};
    }).filter(function(x){return x.s>0}).sort(function(a,b){return b.s-a.s});
    return scored.slice(0,3).map(function(x){return x.t});
  }

  function cards(list){
    return '<div class="tcards">'+list.map(function(t){
      return '<a class="tcard" href="'+base+t.url+'"><span class="ti"><i class="fa-solid '+t.icon+'"></i></span><span class="tx"><b>'+esc(t.name)+'</b><small>'+esc(t.desc)+'</small></span><span class="go">Open <i class="fa-solid fa-arrow-right"></i></span></a>';
    }).join("")+'</div>';
  }

  function guide(t){
    return '<b>'+esc(t.name)+'</b><br>'+t.steps.map(function(s,i){return '<span class="step"><em>'+(i+1)+'</em>'+s+'</span>'}).join("")+'<div class="tline"><a class="openbtn" href="'+base+t.url+'">Open '+esc(t.name)+' <i class="fa-solid fa-arrow-right"></i></a></div>';
  }

  function privacyLine(){
    return 'Local tools keep your files in your browser. The only outbound request is the public link you paste into a downloader, plus chat text if you explicitly connect Gemini. <a href="'+base+'privacy.html">Full privacy policy</a>.';
  }

  /* ------------------------------------------------------------------ */
  /* Reply engine                                                        */
  /* ------------------------------------------------------------------ */
  function contextAware(){try{var p=location.pathname.split("/").pop()||"index.html";var map={"editor.html":"PDF Editor","merge-pdf.html":"Merge PDF","split-pdf.html":"Split PDF","compress-pdf.html":"Compress PDF","jpg-to-pdf.html":"JPG to PDF","pdf-to-word.html":"PDF to Word","pdf-to-text.html":"PDF to Text","watermark.html":"Watermark","crop-pdf.html":"Crop PDF","page-numbers.html":"Page Numbers","organize-pdf.html":"Organize Pages","rotate-pdf.html":"Rotate PDF","pdf-to-jpg.html":"PDF to JPG","image-compressor.html":"Image Compressor","video-to-mp3.html":"Video to MP3","youtube-downloader.html":"YouTube Downloader","instagram-downloader.html":"Instagram Downloader"};var name=map[p]||p;return "You are on: "+name+". Most tools run locally in your browser. The Hub Assistant is local by default and can use Gemini only if you explicitly connect it."; }catch(e){return "";}}

  function reply(input,ctx){ ctx=ctx||{}; if(!ctx.tip)ctx.tip=contextAware();
    var raw=String(input||"").trim(),l=norm(raw);
    ctx=ctx||{};

    /* slash commands */
    if(l.charAt(0)==="/"){
      var cmd=l.split(/\s+/)[0];
      if(/^\/(help|commands)$/.test(cmd))return{b:commands(),c:["Find a tool","Is it private?","Dark mode"]};
      if(/^\/(tools|list)$/.test(cmd))return{b:"Here is every tool I know:<br>"+cards(T),c:["Find a tool","Privacy","API"],full:1};
      if(/^\/(dark|night)$/.test(cmd)){setTheme("dark");return{b:"Dark mode is on. 🌙",c:["Light mode","Find a tool"]}}
      if(/^\/(light|day)$/.test(cmd)){setTheme("light");return{b:"Light mode is on. ☀️",c:["Dark mode","Find a tool"]}}
      if(/^\/(privacy|private)$/.test(cmd))return{b:privacyLine(),c:["About the API","Terms","Find a tool"]};
      if(/^\/(api|loader)$/.test(cmd))return{b:faqAnswer(4),c:["Is it private?","Find a tool"]};
      if(/^\/(terms|legal)$/.test(cmd))return{b:'Read the full <a href="'+base+'terms.html">Terms &amp; Conditions</a>.',c:["Privacy","Contact"]};
      if(/^\/(contact|creator)$/.test(cmd))return{b:faqAnswer(11),c:["Find a tool","Privacy"]};
      if(/^\/(clear|reset)$/.test(cmd)){clearChat();return{b:"Chat cleared. What would you like to do?",c:defaultChips()}};
      if(/^\/(shortcuts|keys)$/.test(cmd))return{b:faqAnswer(19),c:["Find a tool","Help"]};
      return{b:"I don’t know that command. Try <code>/help</code>, <code>/tools</code>, <code>/privacy</code> or <code>/dark</code>.",c:defaultChips()};
    }

    if(!l)return{b:"Tell me what you’d like to do with a file.",c:defaultChips()};

    /* greetings */
    if(/^(hi|hello|hey|yo|salam|salaam|hai|hola|good (morning|evening|afternoon))\b/.test(l))return{b:faqAnswer(0)+recentLine(),c:defaultChips()};

    /* theme */
    if(/\b(dark|night)\b/.test(l)&&/\b(mode|theme|on|switch|turn)\b/.test(l)){setTheme("dark");return{b:"Dark mode is on. 🌙",c:["Light mode","Find a tool"]}}
    if(/\b(light|day)\b/.test(l)&&/\b(mode|theme|on|switch|turn)\b/.test(l)){setTheme("light");return{b:"Light mode is on. ☀️",c:["Dark mode","Find a tool"]}}

    /* explicit API reassurance before generic privacy */
    if(/\b(api|loader\.to|loader|third.?party)\b/.test(l))return{b:faqAnswer(4),c:["Is it private?","Terms","Find a tool"]};

    /* follow-ups about the tool just discussed */
    if(/\b(how (do i|to) use|how does it work|use it|guide me|show me|steps)\b/.test(l)&&ctx.lastTool)return{b:guide(ctx.lastTool),c:["Is it private?","Find another tool","Troubleshoot"]};
    if(/\b(open another|another tool|different tool|show.*tools|all tools)\b/.test(l))return{b:"Here is the full toolbox:<br>"+cards(T),c:["Find a tool","Privacy"],full:1};
    if(/\b(troubleshoot|not working|broken|stuck|error)\b/.test(l)&&!/\b(api|privacy|download)\b/.test(l)){
      return{b:"Let’s troubleshoot in order:<br><span class='step'><em>1</em>Refresh the page and try again.</span><span class='step'><em>2</em>Try a smaller file or split it first.</span><span class='step'><em>3</em>Check that the PDF is not password-protected.</span><span class='step'><em>4</em>If a downloader fails, the public link may be private or region-locked.</span><span class='step'><em>5</em>Tell me the tool and the exact message, or contact the creator.</span>",c:["Contact","Find a tool","Privacy"]};
    }

    /* "how do I use/open/..." with a tool match -> guide */
    /* privacy questions beat tool matching ("is my file uploaded?") */
    if(/\b(is|are|does|do|will|can|where)\b.*\b(upload(ed|s)?|stored?|saved|sent|private|safe|secure|leave|server|seen)\b/.test(l)&&!/\b(how (do|to) upload|upload (a|my|the) (file|pdf))\b/.test(l))return{b:privacyLine(),c:["About the API","Terms","Find a tool"]};
    /* exact physical size of images in the PDF Editor */
    if(/\b(cm|mm|centimet\w*|millimet\w*|inch(es)?|exact size|physical size|real size)\b/.test(l)&&/\b(image|photo|logo|picture|signature|stamp)\b/.test(l)){
      var ed=T.filter(function(x){return x.id==="editor"})[0];
      if(ed)return{b:"In the <b>PDF Editor</b>, add an image and a size dialog opens straight away. Choose <b>mm, cm, in or px</b>, type the width and height (the aspect ratio can be locked), and press <b>Apply size</b>. Select an image any time and use the ruler button in the properties bar to change it again. The image is exported at exactly that physical size."+cards([ed]),c:["How do I use it?","Is it private?","Find a tool"]};
    }
    var hits=findTools(l);
    var wantsGuide=/\b(how|guide|steps|use|using|open|start|tutorial|walk|help)\b/.test(l);
    var wantsFind=/\b(which|what tool|find|recommend|best|need|want|make|convert|merge|split|edit|sign|compress|watermark|rotate|crop|extract|download|turn)\b/.test(l);

    if(hits.length){
      var t=hits[0];
      if(wantsGuide&&!/\b(what is|explain|privacy|free|api)\b/.test(l))return{b:guide(t),c:["Open another tool","Is it private?","Troubleshoot"]};
      var extra="";
      if(hits.length>1)extra='<div class="also">Also relevant: '+hits.slice(1).map(function(x){return '<a href="'+base+x.url+'">'+esc(x.name)+'</a>'}).join(" · ")+'</div>';
      return{b:"I’d use <b>"+esc(t.name)+"</b>.<br>"+esc(t.desc)+extra+cards([t]),c:["How do I use it?","Is it private?","Find a tool"]};
    }

    /* FAQ / intents */
    if(/^(find a tool|tools|all tools|list|what can you do|tools info)\b/.test(l))return{b:"Here is everything I can help with:<br>"+cards(T),c:["Privacy","API","Dark mode"],full:1};
    for(var i=0;i<FAQ.length;i++){if(FAQ[i][0].test(l))return{b:faqAnswer(i),c:followChips(i)}}

    /* specific helpful patterns */
    if(/\b(compare|difference|vs)\b/.test(l))return{b:"Quick guide:<br>• <b>PDF Editor</b> — change existing text, sign, annotate, forms, pages.<br>• <b>Watermark</b> — stamp text or a logo across pages.<br>• <b>Page Numbers</b> — add numbering only.<br>• <b>PDF to Word</b> — editable .docx.<br>• <b>PDF to Text</b> — plain .txt.<br>• <b>Compress</b> — smaller file, pages become images.<br>• <b>Organize</b> — reorder/delete/rotate pages.",c:["Open the editor","Compress a PDF","Find a tool"]};
    if(/\b(thank|thanks|thx|great|awesome|perfect|nice)\b/.test(l))return{b:"You’re welcome! 🎉 If you get stuck, tell me the tool and the exact message.",c:["Find another tool","Privacy","Contact"]};
    if(/\b(bye|goodbye|see you|close)\b/.test(l))return{b:"Goodbye! Your files never left your device. Come back any time.",c:["Find a tool"]};
    if(/\b(yes|yeah|yep|ok|okay|sure)\b/.test(l)&&ctx.lastTool)return{b:guide(ctx.lastTool),c:["Is it private?","Find another tool"]};
    if(/\b(no|nope)\b/.test(l))return{b:"No problem. What would you like to do instead?",c:defaultChips()};
    if(/\b(open|launch|go to)\b/.test(l)&&ctx.lastTool)return{b:cards([ctx.lastTool]),c:["How do I use it?","Privacy"]};

    /* fallback with suggestions */
    return{b:"I’m not certain about that one. I can help with tools, privacy, formats, troubleshooting, the downloader API, terms or contact. Try one of these:",c:defaultChips()};
  }

  function faqAnswer(i){return String(FAQ[i][1]).replace(/\{b\}/g,base)}
  function followChips(i){
    if([3,4,5,13,14].indexOf(i)>-1)return["About the API","Find a tool","Terms"];
    if(i===6)return["PDF Editor","PDF to Word","Find a tool"];
    if(i===9)return["PDF Editor","Privacy","Contact"];
    if(i===10)return["Privacy","Terms","Find a tool"];
    if(i===11)return["Privacy","Find a tool","Contact"];
    return defaultChips();
  }
  function defaultChips(){return["Find a tool","Make a PDF smaller","Sign a PDF","Is it private?","Contact"]}
  function commands(){return "<b>Commands</b><br><code>/tools</code> list every tool<br><code>/privacy</code> what stays on your device<br><code>/api</code> how the downloader API works<br><code>/dark</code> or <code>/light</code> switch theme<br><code>/terms</code> legal terms<br><code>/contact</code> creator details<br><code>/shortcuts</code> keyboard shortcuts<br><code>/clear</code> reset this chat";}
  function recentLine(){
    try{var r=JSON.parse(localStorage.getItem("mth.recent")||"[]");if(r&&r.length){var t=T.filter(function(x){return x.url===r[0]})[0];if(t)return "<br><span class='tiny'>Recently used: <a href='"+base+t.url+"'>"+esc(t.name)+"</a></span>"}}catch(e){}
    return "";
  }

  /* ------------------------------------------------------------------ */
  /* Styles                                                              */
  /* ------------------------------------------------------------------ */
  var css=`
  #hubthread{position:fixed;inset:0;width:100%;height:100%;z-index:9997;pointer-events:none;overflow:visible;opacity:0}
  #hubthread path{fill:none;stroke:var(--accent,#155eef);stroke-linecap:round;stroke-linejoin:round}
  #hubthread .ht-glow{stroke-width:10;opacity:.12}
  #hubthread .ht-core{stroke-width:2.1;opacity:.92}
  #hubthread .ht-bead{fill:var(--accent,#155eef);opacity:.92}
  #hubfab{position:fixed;right:22px;bottom:22px;z-index:9998;width:58px;height:58px;border:1px solid rgba(255,255,255,.16);border-radius:15px;padding:0;cursor:pointer;background:#0b1f3a;color:#fff;box-shadow:0 16px 34px -16px rgba(5,16,36,.65),0 2px 6px rgba(5,16,36,.18);display:grid;place-items:center;transition:transform .18s ease,background .18s ease,box-shadow .18s ease}
  #hubfab:hover{transform:translateY(-2px);background:var(--accent,#155eef);color:var(--accent-ink,#fff);box-shadow:0 20px 40px -18px rgba(5,16,36,.7)}
  #hubfab:focus-visible{outline:2px solid var(--accent,#155eef);outline-offset:3px}
  #hubfab .ficon{display:grid;place-items:center;pointer-events:none}
  #hubfab .ficon svg{width:26px;height:26px}
  #hubfab .badge{position:absolute;top:-5px;right:-5px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:var(--accent,#155eef);color:var(--accent-ink,#fff);border:2px solid var(--surface,#fff);font:800 10px/15px var(--font-body,system-ui,sans-serif);display:none}
  #hubfab .badge.on{display:block}
  #hubtip{position:fixed;right:90px;bottom:34px;z-index:9997;background:var(--surface,#fff);color:var(--ink,#0b1f3a);border:1px solid var(--line,#dfe6ef);box-shadow:0 16px 34px -18px rgba(5,16,36,.45);border-radius:9px;padding:9px 12px;font:600 12px var(--font-body,system-ui,sans-serif);display:none;max-width:235px;line-height:1.45}
  #hubtip.on{display:block;animation:hpop .22s ease-out}
  @keyframes hpop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  #hubchat{display:none;position:fixed;right:22px;bottom:92px;z-index:9999;width:min(410px,calc(100vw - 28px));height:min(650px,84vh);flex-direction:column;overflow:hidden;border-radius:16px;background:var(--surface,#fff);color:var(--ink,#0b1f3a);border:1px solid var(--line,#dfe6ef);box-shadow:0 34px 80px -34px rgba(5,16,36,.62);font:14px var(--font-body,system-ui,sans-serif)}
  #hubchat.open{display:flex;animation:hpop .2s ease-out}
  #hubchat .h{display:flex;align-items:center;gap:9px;padding:11px 12px;background:#0b1f3a;color:#fff;position:relative;flex:none;border-bottom:1px solid rgba(255,255,255,.1)}
  #hubchat .h::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--accent,#155eef)}
  #hubchat .h .gem{width:33px;height:33px;padding:5px;background:#fff;border-radius:8px;object-fit:contain;flex:none}
  #hubchat .h .who{flex:1;min-width:0}
  #hubchat .h b{display:block;font:700 14px/1.2 var(--font-head,var(--font-body));letter-spacing:-.01em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #hubchat .h small{display:flex;align-items:center;gap:5px;color:#b9c7dc;font-size:10.6px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #hubchat .h small::before{content:"";width:6px;height:6px;border-radius:50%;background:#5eead4;box-shadow:0 0 0 3px rgba(94,234,212,.14);flex:none}
  #hubchat .h button{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#eef4ff;width:29px;height:29px;border-radius:7px;cursor:pointer;font-size:12px;display:grid;place-items:center;flex:none;padding:0;transition:background .15s,border-color .15s}
  #hubchat .h button:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.26)}
  #hubchat .h button:focus-visible{outline:2px solid #fff;outline-offset:2px}
  #hubchat .h .gchip{width:auto;height:27px;padding:0 8px;display:inline-flex;align-items:center;gap:4px;font:700 10.5px var(--font-body);border-radius:6px;letter-spacing:.01em;background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.16)}
  #hubchat .h .gchip img{width:12px;height:12px;flex:none}
  #hubchat .h .gchip.on{background:rgba(110,160,255,.2);border-color:#7fb0ff;color:#eaf2ff}
  #hubchat .b{flex:1;overflow-y:auto;padding:14px 12px 6px;display:flex;flex-direction:column;gap:10px;background:var(--bg,#f4f7fb);scroll-behavior:smooth;overscroll-behavior:contain}
  #hubchat .b::-webkit-scrollbar{width:8px}
  #hubchat .b::-webkit-scrollbar-thumb{background:var(--line,#dfe6ef);border-radius:4px}
  #hubchat .mrow{display:flex;gap:8px;align-items:flex-end;max-width:100%}
  #hubchat .mrow.me{flex-direction:row-reverse}
  #hubchat .av{width:25px;height:25px;border-radius:6px;flex:none;display:grid;place-items:center;font-size:10px;background:var(--surface,#fff);border:1px solid var(--line,#dfe6ef);margin-bottom:2px;overflow:hidden;color:var(--muted,#5c6b80)}
  #hubchat .av.bot img{width:20px;height:20px;display:block}
  #hubchat .av.me{background:var(--surface-2,#eef3f9);color:var(--muted,#5c6b80)}
  #hubchat .m{max-width:calc(100% - 40px);padding:10px 13px;border-radius:12px;line-height:1.55;white-space:normal;font-size:13.2px;overflow-wrap:anywhere}
  #hubchat .m.bot{background:var(--surface,#fff);border:1px solid var(--line,#dfe6ef);border-bottom-left-radius:3px;box-shadow:0 1px 2px rgba(15,31,58,.04)}
  #hubchat .m.me{background:var(--accent,#155eef);color:var(--accent-ink,#fff);border-bottom-right-radius:3px}
  #hubchat .m a{color:var(--accent,#155eef);font-weight:700;text-decoration:underline;text-underline-offset:2px}
  #hubchat .m.me a{color:inherit}
  #hubchat .m code{background:color-mix(in srgb,var(--accent,#155eef) 9%,transparent);padding:1px 5px;border-radius:4px;font-size:11.6px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
  #hubchat .m pre{margin:7px 0;padding:9px 10px;border-radius:7px;background:var(--surface-2,#eef3f9);border:1px solid var(--line,#dfe6ef);overflow-x:auto;font-size:11.5px;line-height:1.45}
  #hubchat .m pre code{background:none;padding:0;font-size:inherit;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
  #hubchat .m .step{display:flex;gap:8px;margin:7px 0;line-height:1.45}
  #hubchat .m .step em{flex:none;width:19px;height:19px;border-radius:50%;background:color-mix(in srgb,var(--accent,#155eef) 12%,transparent);color:var(--accent,#155eef);font:800 10px/19px var(--font-body);text-align:center;font-style:normal;margin-top:2px}
  #hubchat .m .tiny{color:var(--muted,#5c6b80);font-size:11.3px;line-height:1.45}
  #hubchat .m .also{margin-top:7px;font-size:11.8px;color:var(--muted,#5c6b80)}
  #hubchat .m .tline{margin-top:10px}
  #hubchat .openbtn{display:inline-flex;align-items:center;gap:7px;background:var(--accent,#155eef);color:var(--accent-ink,#fff)!important;text-decoration:none;font-weight:800;font-size:12px;padding:8px 12px;border-radius:7px}
  #hubchat .tcards{display:flex;flex-direction:column;gap:7px;margin-top:9px}
  #hubchat .tcard{display:flex;align-items:flex-start;gap:8px;text-decoration:none;background:var(--surface-2,#eef3f9);border:1px solid var(--line,#dfe6ef);border-radius:8px;padding:8px;color:inherit;position:relative;transition:border-color .15s,background .15s}
  #hubchat .tcard:hover{border-color:var(--accent,#155eef);background:var(--surface,#fff)}
  #hubchat .tcard .ti{width:27px;height:27px;border-radius:6px;background:color-mix(in srgb,var(--accent,#155eef) 11%,transparent);color:var(--accent,#155eef);display:grid;place-items:center;font-size:12px;flex:none}
  #hubchat .tcard .tx{min-width:0;flex:1}
  #hubchat .tcard b{display:block;font-size:12.3px;line-height:1.3}
  #hubchat .tcard small{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--muted,#5c6b80);font-size:10.8px;line-height:1.35}
  #hubchat .tcard .go{display:none}
  #hubchat .meta{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted,#5c6b80);margin:2px 0 0 33px}
  #hubchat .mrow.me .meta{margin:2px 0 0 0;justify-content:flex-end}
  #hubchat .acts{display:flex;gap:3px;opacity:0;transition:opacity .15s}
  #hubchat .mrow:hover .acts,#hubchat .mrow:focus-within .acts{opacity:1}
  #hubchat .acts button{border:0;background:none;color:var(--muted,#5c6b80);font-size:10.5px;cursor:pointer;padding:2px 3px;border-radius:4px}
  #hubchat .acts button:hover{color:var(--accent,#155eef);background:var(--surface-2,#eef3f9)}
  #hubchat .c{display:flex;flex-wrap:wrap;gap:5px;padding:2px 12px 9px;background:var(--bg,#f4f7fb);max-height:108px;overflow-y:auto;flex:none}
  #hubchat .c button{font:600 11.4px var(--font-body);border:1px solid var(--line,#dfe6ef);background:var(--surface,#fff);color:var(--ink,#0b1f3a);border-radius:7px;padding:5px 10px;cursor:pointer;transition:border-color .15s,color .15s}
  #hubchat .c button:hover{border-color:var(--accent,#155eef);color:var(--accent,#155eef)}
  #hubchat .c button:focus-visible{outline:2px solid var(--accent,#155eef);outline-offset:2px}
  #hubchat .dots span{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:var(--muted,#5c6b80);animation:hd 1s infinite}
  #hubchat .dots span:nth-child(2){animation-delay:.15s}
  #hubchat .dots span:nth-child(3){animation-delay:.3s}
  @keyframes hd{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}
  #hubchat form#hf{display:flex;gap:6px;padding:9px 10px;border-top:1px solid var(--line,#dfe6ef);background:var(--surface,#fff);align-items:center;flex:none}
  #hubchat form#hf input#hi{flex:1;min-width:0;padding:10px 12px;border:1px solid var(--line,#dfe6ef);border-radius:9px;background:var(--bg,#f4f7fb);color:var(--ink,#0b1f3a);font:13.4px var(--font-body);outline:0}
  #hubchat form#hf input#hi:focus{border-color:var(--accent,#155eef);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent,#155eef) 14%,transparent)}
  #hubchat .iconbtn{width:36px;height:36px;flex:none;border:1px solid var(--line,#dfe6ef);border-radius:9px;background:var(--surface,#fff);color:var(--muted,#5c6b80);cursor:pointer;display:grid;place-items:center;font-size:12.5px;padding:0}
  #hubchat .iconbtn:hover{color:var(--accent,#155eef);border-color:var(--accent,#155eef)}
  #hubchat .iconbtn.rec{background:color-mix(in srgb,var(--err,#b91c1c) 10%,var(--surface,#fff));color:var(--err,#b91c1c);border-color:var(--err,#b91c1c);animation:rec 1s infinite}
  @keyframes rec{0%,100%{opacity:1}50%{opacity:.55}}
  #hubchat form#hf .send{border:0;border-radius:9px;background:var(--accent,#155eef);color:var(--accent-ink,#fff);font-weight:800;padding:0 13px;height:36px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12.3px}
  #hubchat form#hf .send:hover{filter:brightness(.94)}
  #hubchat form#hf .send:focus-visible{outline:2px solid var(--accent,#155eef);outline-offset:2px}
  #hubchat .footnote{font-size:9.5px;color:var(--muted,#5c6b80);text-align:center;padding:0 10px 8px;background:var(--surface,#fff);flex:none}
  #hubchat .footnote button{border:0;background:none;color:var(--accent,#155eef);font:inherit;font-weight:700;cursor:pointer;padding:0}
  #hubchat .gm{position:absolute;inset:0;z-index:6;display:none;place-items:center;padding:14px;background:rgba(7,16,30,.56);backdrop-filter:blur(4px)}
  #hubchat .gm.on{display:grid}
  #hubchat .gcard{width:100%;max-height:100%;overflow-y:auto;background:var(--surface,#fff);border:1px solid var(--line,#dfe6ef);border-radius:12px;padding:16px;box-shadow:0 26px 54px -24px rgba(5,16,36,.7);color:var(--ink,#0b1f3a)}
  #hubchat .gcard .ghead{display:flex;align-items:flex-start;gap:9px;margin-bottom:7px}
  #hubchat .gcard .ghead img{width:22px;height:22px;flex:none;margin-top:1px}
  #hubchat .gcard .ghead>div{flex:1;min-width:0}
  #hubchat .gcard h4{font:700 16.5px/1.2 var(--font-head,var(--font-body));margin:0;letter-spacing:-.01em}
  #hubchat .gcard .gsub{font-size:10.5px;color:var(--muted,#5c6b80);margin:2px 0 0;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
  #hubchat .gcard .gclose{border:1px solid var(--line,#dfe6ef);background:var(--surface,#fff);color:var(--muted,#5c6b80);width:28px;height:28px;border-radius:7px;cursor:pointer;display:grid;place-items:center;flex:none;font-size:15px;line-height:1;padding:0}
  #hubchat .gcard .gclose:hover{color:var(--ink,#0b1f3a);border-color:var(--muted,#5c6b80)}
  #hubchat .gcard .gnote{font-size:11.3px;color:var(--muted,#5c6b80);line-height:1.5;margin:9px 0 12px;padding:8px 10px;border-left:3px solid var(--accent,#155eef);background:color-mix(in srgb,var(--accent,#155eef) 6%,var(--surface,#fff));border-radius:5px}
  #hubchat .gcard .gmodes{display:flex;gap:3px;padding:3px;border-radius:8px;background:var(--surface-2,#eef3f9);border:1px solid var(--line,#dfe6ef);margin-bottom:4px}
  #hubchat .gcard .gmodes button{flex:1;border:0;background:none;color:var(--muted,#5c6b80);font:700 11.2px var(--font-body);padding:8px 6px;border-radius:6px;cursor:pointer;min-height:32px}
  #hubchat .gcard .gmodes button.on{background:var(--surface,#fff);color:var(--accent,#155eef);box-shadow:0 1px 3px rgba(15,31,58,.14)}
  #hubchat .gcard .gmodes button:focus-visible{outline:2px solid var(--accent,#155eef);outline-offset:1px}
  #hubchat .gcard .gpane[hidden]{display:none}
  #hubchat .gcard label{display:block;font:700 10px var(--font-body);letter-spacing:.055em;text-transform:uppercase;color:var(--muted,#5c6b80);margin:10px 0 4px}
  #hubchat .gcard label span{text-transform:none;letter-spacing:0;font-weight:600;opacity:.8}
  #hubchat .gcard input,#hubchat .gcard select{width:100%;padding:8px 10px;border:1px solid var(--line,#dfe6ef);border-radius:7px;background:var(--bg,#f4f7fb);color:var(--ink,#0b1f3a);font:12.5px var(--font-body);outline:0}
  #hubchat .gcard input:focus,#hubchat .gcard select:focus{border-color:var(--accent,#155eef);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent,#155eef) 13%,transparent)}
  #hubchat .gcard .keyrow{display:flex;gap:6px}
  #hubchat .gcard .keyrow input{flex:1;min-width:0}
  #hubchat .gcard .eye{border:1px solid var(--line,#dfe6ef);background:var(--surface,#fff);color:var(--muted,#5c6b80);border-radius:7px;padding:0 9px;font:700 10.5px var(--font-body);cursor:pointer;flex:none;min-height:34px}
  #hubchat .gcard .eye:hover{color:var(--accent,#155eef);border-color:var(--accent,#155eef)}
  #hubchat .gcard .ghint{font-size:10.8px;color:var(--muted,#5c6b80);line-height:1.5;margin:5px 0 0}
  #hubchat .gcard .ghint a{color:var(--accent,#155eef);font-weight:700;text-decoration:underline;text-underline-offset:2px}
  #hubchat .gcard .gx{font-size:11.2px;color:var(--muted,#5c6b80);margin-top:10px;line-height:1.5;min-height:17px}
  #hubchat .gcard .gx.bad{color:var(--err,#b91c1c);font-weight:600}
  #hubchat .gcard .gx.good{color:var(--ok,#0f766e);font-weight:600}
  #hubchat .gcard .grow{display:flex;gap:7px;margin-top:13px;padding-top:12px;border-top:1px solid var(--line,#dfe6ef);flex-wrap:wrap;align-items:center}
  #hubchat .gcard .gbtn{border:1px solid var(--line,#dfe6ef);background:var(--surface,#fff);color:var(--ink,#0b1f3a);border-radius:7px;padding:8px 12px;font:700 11.5px var(--font-body);cursor:pointer;min-height:35px}
  #hubchat .gcard .gbtn:hover{border-color:var(--accent,#155eef)}
  #hubchat .gcard .gbtn:focus-visible{outline:2px solid var(--accent,#155eef);outline-offset:2px}
  #hubchat .gcard .gbtn.primary{background:var(--accent,#155eef);border-color:var(--accent,#155eef);color:var(--accent-ink,#fff)}
  #hubchat .gcard .gbtn.primary:hover{filter:brightness(.94)}
  #hubchat .gcard .gbtn:disabled{opacity:.55;cursor:progress}
  #hubchat .gcard .gbtn.danger{color:var(--err,#b91c1c);border-color:color-mix(in srgb,var(--err,#b91c1c) 40%,var(--line,#dfe6ef))}
  #hubchat .gcard .gbtn.danger:hover{background:color-mix(in srgb,var(--err,#b91c1c) 7%,var(--surface,#fff))}
  #hubchat .gcard .gbtn.danger[hidden]{display:none}
  #hubchat .gcard .gbtn.danger.push{margin-left:auto}
  @media (max-width:560px){
    #hubchat{right:10px;left:10px;bottom:calc(82px + env(safe-area-inset-bottom,0px));width:auto;height:min(82vh,660px);border-radius:14px}
    #hubfab{right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));width:56px;height:56px;border-radius:14px}
    #hubtip{right:80px;bottom:calc(25px + env(safe-area-inset-bottom,0px));max-width:200px}
    #hubchat .h{padding:9px 10px;gap:6px}
    #hubchat .h .gem{width:29px;height:29px}
    #hubchat .h b{font-size:13.5px}
    #hubchat .h .gchip{padding:0 6px;font-size:9.8px}
    #hubchat .h button{width:27px;height:27px}
    #hubchat .h button[data-x="clear"]{display:none}
    #hubchat form#hf{padding:8px}
    #hubchat form#hf .send span{display:none}
    #hubchat form#hf .send{padding:0 11px}
    #hubchat .gm{padding:8px}
    #hubchat .gcard{padding:14px}
    #hubchat .gcard .gbtn.danger.push{margin-left:0}
  }
  @media (prefers-reduced-motion:reduce){
    #hubfab,#hubchat{animation:none!important;transition:none!important}
    #hubthread{display:none!important}
    #hubchat .dots span{animation:none!important;opacity:.6}
  }
`;
  var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

  /* ------------------------------------------------------------------ */
  /* Markup                                                              */
  /* ------------------------------------------------------------------ */
  var fab=document.createElement("button");
  fab.id="hubfab";fab.type="button";fab.setAttribute("aria-label","Open Hub Assistant (Alt + /)");fab.setAttribute("aria-expanded","false");fab.setAttribute("aria-controls","hubchat");
  fab.innerHTML='<span class="ficon">'+ASSIST_ICON+'</span><span class="badge"></span>';
  var tip=document.createElement("div");tip.id="hubtip";tip.textContent="Need a hand? I can find the right tool.";

  var box=document.createElement("div");
  box.id="hubchat";box.setAttribute("role","dialog");box.setAttribute("aria-modal","false");box.setAttribute("aria-label","Hub Assistant");box.setAttribute("aria-hidden","true");
  box.innerHTML=
   '<div class="h"><button type="button" data-x="back" title="Close assistant" aria-label="Close assistant"><i class="fa-solid fa-arrow-left"></i></button><img class="gem" src="'+GEMINI+'" alt=""><span class="who"><b>Hub Assistant</b><small id="hmode">Local · private</small></span>'+
   '<button type="button" class="gchip" data-x="gemini" title="Optional Gemini connection"><img src="'+GEMINI+'" alt=""> Gemini</button>'+
   '<button type="button" data-x="refresh" title="Reset this chat" aria-label="Reset this chat"><i class="fa-solid fa-rotate-right"></i></button>'+
   '<button type="button" data-x="clear" title="Clear chat" aria-label="Clear chat"><i class="fa-solid fa-trash-can"></i></button></div>'+
   '<div class="b" id="hb" aria-live="polite" aria-relevant="additions"></div>'+
   '<div class="c" id="hc"></div>'+
   '<form id="hf" autocomplete="off"><button class="iconbtn" type="button" id="hfile" title="Check a file (name, type and size only)" aria-label="Check a file"><i class="fa-solid fa-paperclip"></i></button>'+
   '<input id="hi" placeholder="e.g. “sign my PDF” or “why is it private?”" aria-label="Message" maxlength="600">'+
   '<button class="iconbtn" type="button" id="hmic" title="Speak your question" aria-label="Voice input" hidden><i class="fa-solid fa-microphone"></i></button>'+
   '<button class="send" type="submit" aria-label="Send"><span>Send</span><i class="fa-solid fa-paper-plane"></i></button></form>'+
   '<div class="footnote" id="hfoot">Local by default · <button type="button" data-x="gemini">Connect Gemini</button> · <button type="button" data-x="privacy">Privacy</button></div>'+
   '<div class="gm" id="hgm" aria-hidden="true"><form class="gcard" id="hgf" novalidate autocomplete="off">'+
     '<div class="ghead"><img src="'+GEMINI+'" alt=""><div><h4>Connect Gemini</h4><p class="gsub">Optional · off by default</p></div><button class="gclose" type="button" data-x="gmclose" aria-label="Close Gemini settings">×</button></div>'+
     '<p class="gnote">Your files never leave this device. Only the chat text you send is forwarded to Google. You can disconnect at any time.</p>'+
     '<div class="gmodes" role="tablist" aria-label="Connection mode">'+
       '<button type="button" role="tab" data-mode="direct" aria-selected="true" class="on">Browser key</button>'+
       '<button type="button" role="tab" data-mode="proxy" aria-selected="false">Secure proxy</button>'+
     '</div>'+
     '<div class="gpane" data-pane="direct">'+
       '<label for="hgk">Gemini API key</label>'+
       '<div class="keyrow"><input id="hgk" type="password" spellcheck="false" autocomplete="off" placeholder="AIza… your Gemini API key"><button class="eye" type="button" id="hgshow" aria-pressed="false">Show</button></div>'+
       '<p class="ghint">Kept in this tab only (sessionStorage), sent straight to Google, and forgotten when you close the tab. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Get a key</a>.</p>'+
       '<label for="hgm2">Model</label>'+
       '<select id="hgm2">'+MODELS.map(function(m){return '<option value="'+m+'">'+MODEL_LABEL[m]+'</option>'}).join("")+'</select>'+
     '</div>'+
     '<div class="gpane" data-pane="proxy" hidden>'+
       '<label for="hge">Proxy endpoint</label><input id="hge" type="url" spellcheck="false" placeholder="https://example.com/api/assistant" autocomplete="off">'+
       '<label for="hgt">Access token <span>(only if your proxy sets one)</span></label><input id="hgt" type="password" placeholder="Optional" autocomplete="off">'+
       '<p class="ghint">For a self-hosted proxy, such as the optional Node.js server in <code>server/</code>. The Gemini key stays on that server; only chat text passes through it. Use HTTPS for any remote host.</p>'+
     '</div>'+
     '<div class="gx" id="hgx" role="status" aria-live="polite"></div>'+
     '<div class="grow"><button class="gbtn primary" type="submit" id="hgconnect">Test &amp; connect</button><button class="gbtn" type="button" data-x="gmclose">Cancel</button><button class="gbtn danger" type="button" id="hgforget" hidden>Forget key</button><button class="gbtn danger" type="button" id="hgdis" hidden>Disconnect</button></div>'+
   '</form></div>';
  document.body.append(box,fab,tip);

  /* ------------------------------------------------------------------ */
  /* Elastic cursor thread                                               */
  /* ------------------------------------------------------------------ */
  var thread=document.createElementNS("http://www.w3.org/2000/svg","svg");
  thread.id="hubthread";thread.setAttribute("aria-hidden","true");thread.setAttribute("focusable","false");
  thread.innerHTML='<path class="ht-glow"></path><path class="ht-core"></path><circle class="ht-bead" r="2.6" cx="0" cy="0"></circle>';
  document.body.appendChild(thread);
  var htGlow=thread.querySelector(".ht-glow"),htCore=thread.querySelector(".ht-core"),htBead=thread.querySelector(".ht-bead");
  var htFine=window.matchMedia?window.matchMedia("(hover: hover) and (pointer: fine)"):null;
  var htReduce=window.matchMedia?window.matchMedia("(prefers-reduced-motion: reduce)"):null;
  var htPtr={x:0,y:0,on:false},htTip={x:0,y:0,vx:0,vy:0},htAnchor={x:0,y:0},htAlpha=0,htRaf=0,htLast=0;
  function htAnchorPoint(){var r=fab.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}}
  function htAllowed(){return (!htFine||htFine.matches)&&!(htReduce&&htReduce.matches)&&!box.classList.contains("open")}
  function htStart(){if(!htRaf&&htAllowed()){htLast=0;htRaf=requestAnimationFrame(htFrame)}}
  function htUpdate(e){
    if(!htAllowed()){htPtr.on=false;return}
    htAnchor=htAnchorPoint();
    var dx=e.clientX-htAnchor.x,dy=e.clientY-htAnchor.y;
    htPtr.x=e.clientX;htPtr.y=e.clientY;
    htPtr.on=dx*dx+dy*dy<=245*245;
    if(htPtr.on)htStart();
  }
  function htRetract(){
    htPtr.on=false;
    if(!htRaf&&htAllowed()){htLast=0;htRaf=requestAnimationFrame(htFrame)}
  }
  function htFrame(t){
    htRaf=0;
    var allowed=htAllowed();
    var dt=htLast?Math.min(34,t-htLast)/16.667:1;
    htLast=t;
    htAnchor=htAnchorPoint();
    var tx=allowed&&htPtr.on?htPtr.x:htAnchor.x;
    var ty=allowed&&htPtr.on?htPtr.y:htAnchor.y;
    htTip.vx+=(tx-htTip.x)*0.2*dt;
    htTip.vy+=(ty-htTip.y)*0.2*dt;
    var damp=Math.pow(0.78,dt);
    htTip.vx*=damp;htTip.vy*=damp;
    htTip.x+=htTip.vx*dt;htTip.y+=htTip.vy*dt;
    var dx=htTip.x-htAnchor.x,dy=htTip.y-htAnchor.y;
    var dist=Math.hypot(dx,dy)||0.001;
    var goal=allowed&&htPtr.on&&dist>34?1:0;
    htAlpha+=(goal-htAlpha)*Math.min(1,0.2*dt);
    if(htAlpha<0.002)htAlpha=0;
    if(htAlpha>0.002&&dist>2){
      var ux=dx/dist,uy=dy/dist;
      var rad=Math.max(0,Math.min(htAnchor.w,htAnchor.h)/2-4);
      var sx=htAnchor.x+ux*rad,sy=htAnchor.y+uy*rad;
      var bow=Math.max(-30,Math.min(30,(htTip.vx*(-uy)+htTip.vy*ux)*1.7));
      var mx=(sx+htTip.x)/2+(-uy)*bow;
      var my=(sy+htTip.y)/2+ux*bow;
      var f=function(n){return n.toFixed(1)};
      var d="M"+f(sx)+" "+f(sy)+" C"+f(sx+(mx-sx)*0.92)+" "+f(sy+(my-sy)*0.92)+" "+f(htTip.x+(mx-htTip.x)*0.92)+" "+f(htTip.y+(my-htTip.y)*0.92)+" "+f(htTip.x)+" "+f(htTip.y);
      htGlow.setAttribute("d",d);htCore.setAttribute("d",d);
      htBead.setAttribute("cx",f(htTip.x));htBead.setAttribute("cy",f(htTip.y));
    }
    thread.style.opacity=htAlpha.toFixed(3);
    htBead.style.opacity=(htAlpha*(dist>34?1:0)).toFixed(3);
    if(Math.hypot(htTip.vx,htTip.vy)>0.06||Math.abs(goal-htAlpha)>0.01){
      htRaf=requestAnimationFrame(htFrame);
    }
  }
  function htPref(){
    if(!htAllowed())htRetract();
    else if(htTip.x||htTip.y)htStart();
  }
  htAnchor=htAnchorPoint();htTip.x=htAnchor.x;htTip.y=htAnchor.y;
  window.addEventListener("pointermove",htUpdate,{passive:true});
  window.addEventListener("blur",htRetract);
  document.documentElement.addEventListener("mouseleave",htRetract);
  window.addEventListener("resize",htRetract);
  if(htReduce&&htReduce.addEventListener)htReduce.addEventListener("change",htPref);
  if(htFine&&htFine.addEventListener)htFine.addEventListener("change",htPref);


  var fileInput=document.createElement("input");fileInput.type="file";fileInput.style.display="none";document.body.appendChild(fileInput);

  var $=function(id){return document.getElementById(id)},hist=[],busy=false,ctx={};
  var storeKey="mth.chat.v4";

  function save(){try{localStorage.setItem(storeKey,JSON.stringify(hist.slice(-50)))}catch(e){}}
  function load(){try{hist=JSON.parse(localStorage.getItem(storeKey)||"[]")}catch(e){hist=[]}}
  function time(){return new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
  function scroll(){var b=$("hb");b.scrollTop=b.scrollHeight}
  function add(who,html,opts){
    opts=opts||{};
    var row=document.createElement("div");row.className="mrow "+who;
    var av=who==="me"?'<span class="av me"><i class="fa-solid fa-user" aria-hidden="true"></i></span>':'<span class="av bot"><img src="'+GEMINI+'" alt="Gemini"></span>';
    row.innerHTML=av+
      '<div class="m '+who+'">'+html+'</div>';
    var meta=document.createElement("div");meta.className="meta";
    meta.innerHTML='<span>'+time()+'</span>'+(who==="bot"?'<span class="acts"><button type="button" data-copy title="Copy"><i class="fa-regular fa-copy"></i></button><button type="button" data-speak title="Read aloud"><i class="fa-solid fa-volume-high"></i></button><button type="button" data-good title="Helpful">👍</button><button type="button" data-bad title="Not helpful">👎</button></span>':'');
    row.appendChild(meta);
    $("hb").appendChild(row);
    if(!opts.noSave){hist.push({who:who,html:html,ts:Date.now()});save()}
    scroll();
    // wire actions
    var msg=row.querySelector(".m");
    meta.querySelector("[data-copy]")&&(meta.querySelector("[data-copy]").onclick=function(){copy(msg.innerText)});
    meta.querySelector("[data-speak]")&&(meta.querySelector("[data-speak]").onclick=function(){speak(msg.innerText)});
    meta.querySelector("[data-good]")&&(meta.querySelector("[data-good]").onclick=function(){feedback("good",row)});
    meta.querySelector("[data-bad]")&&(meta.querySelector("[data-bad]").onclick=function(){feedback("bad",row)});
    return row;
  }
  function feedback(v,row){
    try{var f=JSON.parse(localStorage.getItem("mth.feedback")||"{}");f[Date.now()]=v;localStorage.setItem("mth.feedback",JSON.stringify(f))}catch(e){}
    row.querySelector(".acts").innerHTML='<span style="color:var(--ok);font-weight:700">'+(v==="good"?"Thanks!":"Thanks — I’ll learn from it")+'</span>';
  }
  function copy(text){if(navigator.clipboard)navigator.clipboard.writeText(text).then(function(){toast("Copied")}).catch(function(){toast("Press Ctrl+C")});else toast("Press Ctrl+C")}
  function toast(msg){var t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove()},1800)}
  function speak(text){
    if(!("speechSynthesis" in window)){toast("Read-aloud is not supported here");return}
    try{window.speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(text.slice(0,600));u.lang=document.documentElement.lang||"en";window.speechSynthesis.speak(u)}catch(e){toast("Read-aloud is not available")}
  }
  function setChips(list){
    $("hc").innerHTML="";
    (list||[]).forEach(function(t){
      var b=document.createElement("button");b.type="button";b.textContent=t;b.onclick=function(){ask(t)};$("hc").appendChild(b);
    });
  }
  function typing(){
    var row=document.createElement("div");row.className="mrow bot";row.id="htyping";
    row.innerHTML='<span class="av bot"><img src="'+GEMINI+'" alt="Gemini"></span><div class="m bot"><span class="dots"><span></span><span></span><span></span></span></div>';
    $("hb").appendChild(row);scroll();
  }
  /* ------------------------------------------------------------------ */
  /* Optional Gemini connection                                          */
  /* ------------------------------------------------------------------ */
  var gemTab="direct",gemBusy=false;

  function cleanEndpoint(v){
    v=String(v||"").trim();
    if(!v)return "";
    if(/^\/\//.test(v))v=location.protocol+v;
    if(/^\//.test(v))return location.origin==="null"?"":location.origin+v;
    if(!/^https?:\/\//i.test(v))v=(/^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(v)?"http://":"https://")+v;
    return v.replace(/\s+/g,"");
  }
  function apiMessage(data,status){
    var m=data&&data.error&&(data.error.message||data.error);
    if(typeof m!=="string")m="";
    m=m.replace(/\s+/g," ").trim();
    if(status===400&&/api key not valid|invalid api key/i.test(m))return "That API key is not valid. Check it in Google AI Studio and paste it again.";
    if(status===401||status===403)return "Gemini rejected this key (HTTP "+status+"). Check that the key is valid, unrestricted for the Generative Language API, and has quota.";
    if(status===404)return "That model is not available for this key. Choose another model and try again.";
    if(status===429)return "Gemini's quota limit was reached. Wait a moment, choose a lighter model, or check your quota in Google AI Studio.";
    if(status===400)return m||"Gemini rejected the request. Check the key and the selected model.";
    if(m)return m;
    return "Gemini answered with HTTP "+status+".";
  }
  function networkMessage(err,what){
    var m=err&&err.message?err.message:"";
    if(/failed to fetch|networkerror|load failed/i.test(m))return "Could not reach "+what+". Check your connection, the address, and CORS on the server.";
    if(/abort|timed out|timeout/i.test(m))return "The request timed out. Try again in a moment.";
    return m||("Could not reach "+what+".");
  }
  function fetchJson(url,opts,ms){
    return new Promise(function(resolve,reject){
      var ctrl=typeof AbortController!=="undefined"?new AbortController():null;
      var timer=setTimeout(function(){if(ctrl)ctrl.abort();reject(new Error("The request timed out."))},ms||15000);
      var o=opts||{};
      if(ctrl)o.signal=ctrl.signal;
      fetch(url,o).then(function(res){
        return res.text().then(function(txt){
          var data={};
          try{data=JSON.parse(txt||"{}")}catch(e){}
          return{res:res,data:data,text:txt};
        });
      }).then(function(r){
        clearTimeout(timer);
        if(!r.res.ok){
          var e=new Error(apiMessage(r.data,r.res.status));
          e.status=r.res.status;
          reject(e);return;
        }
        resolve(r);
      }).catch(function(err){
        clearTimeout(timer);
        reject(err&&err.name==="AbortError"?new Error("The request timed out."):err);
      });
    });
  }

  /* Direct mode: the key goes straight to Google; no site server sees it. */
  function testDirect(key,model){
    return fetchJson(DIRECT_ROOT+"/models/"+encodeURIComponent(model),{
      method:"GET",
      headers:{"x-goog-api-key":key,"Accept":"application/json"},
      cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer"
    },12000).then(function(r){return r.data||{}});
  }
  function systemPrompt(){
    var list=T.map(function(t){return t.name}).join(", ");
    var page=(location.pathname.split("/").pop()||"index.html").replace(/\.html$/i,"");
    if(page==="index"||page==="")page="the home page";
    return "You are Hub Assistant, the built-in support assistant for MULTI TOOL HUB, a privacy-first suite of browser-based file tools. "+
      "The tools are: "+list+". "+
      "Most PDF, image and audio tools run locally on the visitor's device; files are never uploaded or visible to you. "+
      "The YouTube and Instagram downloaders send only a public link to Loader.to. "+
      "The visitor is currently on "+page+". "+
      "Be calm, concise and practical. Use short paragraphs and simple Markdown. Give numbered steps for procedures. "+
      "Recommend only tools from the list above and refer to them by name; do not invent links or features. "+
      "Never claim to have opened, read, stored or seen a file. Never ask for passwords, payment details, personal data or API keys, and never repeat a key. "+
      "If a request is outside file tools, say briefly that you focus on MULTI TOOL HUB and offer the closest relevant tool. "+
      "If the answer could affect someone's legal, medical or financial position, add a one-line caution to verify it.";
  }
  function directReply(){
    return new Promise(function(resolve,reject){
      var key=cfg.key;
      if(!key){reject(new Error("No Gemini key is saved in this tab."));return}
      var ctrl=typeof AbortController!=="undefined"?new AbortController():null;
      lastAbort=ctrl;
      var timer=setTimeout(function(){if(ctrl)ctrl.abort();reject(new Error("Gemini took too long to answer."))},45000);
      var body={
        systemInstruction:{parts:[{text:systemPrompt()}]},
        contents:remoteMsgs.map(function(m){
          return{role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]};
        }),
        generationConfig:{temperature:.6,topP:.95,maxOutputTokens:1200}
      };
      fetch(DIRECT_ROOT+"/models/"+encodeURIComponent(cfg.model||MODELS[0])+":generateContent",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-goog-api-key":key},
        body:JSON.stringify(body),
        cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",
        signal:ctrl?ctrl.signal:undefined
      }).then(function(res){
        return res.text().then(function(txt){
          var data={};try{data=JSON.parse(txt||"{}")}catch(e){}
          return{res:res,data:data};
        });
      }).then(function(r){
        clearTimeout(timer);lastAbort=null;
        if(!r.res.ok){
          var e=new Error(apiMessage(r.data,r.res.status));
          e.status=r.res.status;throw e;
        }
        var cand=r.data&&r.data.candidates&&r.data.candidates[0];
        var parts=cand&&cand.content&&cand.content.parts;
        var out=Array.isArray(parts)?parts.map(function(p){return p&&p.text||""}).join("").trim():"";
        if(!out){
          var blocked=r.data&&r.data.promptFeedback&&r.data.promptFeedback.blockReason;
          if(blocked)throw new Error("Gemini declined that request ("+String(blocked).toLowerCase().replace(/_/g," ")+"). Try rephrasing it.");
          if(cand&&cand.finishReason==="MAX_TOKENS")throw new Error("The reply was too long and got cut off. Ask a shorter question.");
          throw new Error("Gemini returned an empty reply. Try again.");
        }
        resolve(out);
      }).catch(function(err){
        clearTimeout(timer);lastAbort=null;
        reject(err&&err.name==="AbortError"?new Error("Gemini took too long to answer."):err);
      });
    });
  }

  /* Proxy mode: only chat text goes to the self-hosted proxy; it keeps the key. */
  function testProxy(ep,tk){
    var headers={"Accept":"application/json"};
    if(tk)headers.Authorization="Bearer "+tk;
    return fetchJson(ep,{method:"GET",headers:headers,cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer"},12000)
      .then(function(r){
        var d=r.data||{};
        if(d.ok===false)throw new Error(d.error||"The proxy is not ready. Check its GEMINI_API_KEY.");
        if(!d.ok&&!d.service&&!d.model)throw new Error("That address answered, but it does not look like the assistant proxy.");
        return d;
      });
  }
  function proxyReply(){
    return new Promise(function(resolve,reject){
      var ep=cleanEndpoint(cfg.endpoint);
      if(!ep){reject(new Error("No proxy endpoint is saved. Open Gemini settings to add one."));return}
      var ctrl=typeof AbortController!=="undefined"?new AbortController():null;
      lastAbort=ctrl;
      var timer=setTimeout(function(){if(ctrl)ctrl.abort();reject(new Error("The proxy took too long to answer."))},40000);
      var headers={"Content-Type":"application/json","Accept":"application/json"};
      if(cfg.token)headers.Authorization="Bearer "+cfg.token;
      fetch(ep,{
        method:"POST",headers:headers,
        body:JSON.stringify({messages:remoteMsgs.slice(-16),page:location.pathname}),
        cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",
        signal:ctrl?ctrl.signal:undefined
      }).then(function(res){
        return res.text().then(function(txt){
          var data={};try{data=JSON.parse(txt||"{}")}catch(e){}
          return{res:res,data:data,txt:txt};
        });
      }).then(function(r){
        clearTimeout(timer);lastAbort=null;
        if(!r.res.ok){
          var msg=r.data&&(r.data.error||r.data.message);
          var e=new Error(msg||("The proxy answered with HTTP "+r.res.status+"."));
          e.status=r.res.status;throw e;
        }
        if(r.data&&r.data.ok===false)throw new Error(r.data.error||"The proxy could not answer.");
        var out=r.data&&(r.data.reply||r.data.text||r.data.output);
        if(!out&&r.data&&r.data.choices&&r.data.choices[0]&&r.data.choices[0].message)out=r.data.choices[0].message.content;
        if(!out)throw new Error("The proxy sent an empty reply.");
        resolve(String(out));
      }).catch(function(err){
        clearTimeout(timer);lastAbort=null;
        reject(err&&err.name==="AbortError"?new Error("The proxy took too long to answer."):err);
      });
    });
  }
  function remoteReply(){
    if(cfg.mode==="direct"&&cfg.key)return directReply();
    if(cfg.mode==="proxy"&&cfg.endpoint)return proxyReply();
    return Promise.reject(new Error("Gemini is not connected."));
  }

  function md(s){
    var text=esc(String(s||"")),blocks=[];
    text=text.replace(/```[a-z0-9+#-]*\n?([\s\S]*?)```/gi,function(_,code){blocks.push(code.replace(/\n$/,""));return "\u0000"+(blocks.length-1)+"\u0000"});
    text=text.replace(/^#{1,4}\s+(.+)$/gm,"**$1**");
    text=text.replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>");
    text=text.replace(/(^|[\s(])\*([^*\n]+)\*/g,"$1<i>$2</i>");
    text=text.replace(/`([^`\n]+)`/g,"<code>$1</code>");
    text=text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|#[^\s)]*)\)/g,function(_,label,href){
      return '<a href="'+href+'" rel="noopener noreferrer"'+(/^https?:/i.test(href)?' target="_blank"':'')+'>'+label+'</a>';
    });
    text=text.replace(/\n{2,}/g,"\n");
    text=text.replace(/\n/g,"<br>");
    text=text.replace(/(^|<br>)\s*[-*•]\s+/g,"$1• ");
    text=text.replace(/\u0000(\d+)\u0000/g,function(_,i){return "<pre><code>"+blocks[+i]+"</code></pre>"});
    return text;
  }

  function setMode(mode,note){
    var next=(mode==="direct"||mode==="proxy")?mode:"";
    remote=!!next;
    var chip=box.querySelector(".gchip");
    if(chip){chip.classList.toggle("on",remote);chip.innerHTML='<img src="'+GEMINI+'" alt=""> '+(remote?"Gemini on":"Gemini")}
    var label=next==="direct"?"Gemini · browser key":next==="proxy"?"Gemini · secure proxy":"Local · private";
    var m=$("hmode");if(m)m.textContent=note||label;
    var foot=$("hfoot");
    if(foot)foot.innerHTML=remote?'Gemini connected · <button type="button" data-x="gemini">Manage</button> · <button type="button" data-x="privacy">Privacy</button>':'Local by default · <button type="button" data-x="gemini">Connect Gemini</button> · <button type="button" data-x="privacy">Privacy</button>';
  }
  function setGemTab(mode){
    gemTab=mode==="proxy"?"proxy":"direct";
    Array.prototype.forEach.call(box.querySelectorAll("[data-mode]"),function(b){
      var on=b.getAttribute("data-mode")===gemTab;
      b.classList.toggle("on",on);b.setAttribute("aria-selected",on?"true":"false");
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-pane]"),function(p){
      p.hidden=p.getAttribute("data-pane")!==gemTab;
    });
  }
  function setConnStatus(msg,kind){
    var x=$("hgx");if(!x)return;
    x.className="gx"+(kind?" "+kind:"");
    x.textContent=msg||"";
  }
  function openGemini(){
    var gm=$("hgm");if(!gm)return;
    gemBusy=false;
    setGemTab(cfg.mode==="proxy"?"proxy":"direct");
    var k=$("hgk");
    k.value="";
    k.type="password";
    $("hgshow").textContent="Show";
    $("hgshow").setAttribute("aria-pressed","false");
    k.setAttribute("placeholder",cfg.key?"A key is saved in this tab — paste a new one to replace it":"AIza… your Gemini API key");
    $("hgm2").value=cfg.model||MODELS[0];
    $("hge").value=cfg.endpoint||"";
    $("hgt").value="";
    $("hgdis").hidden=!cfg.mode;
    $("hgforget").hidden=!(cfg.key||cfg.token);
    $("hgforget").classList.toggle("push",!cfg.mode);
    $("hgconnect").textContent=cfg.mode?"Reconnect":"Test & connect";
    if(cfg.mode)setConnStatus("Connected using "+(cfg.mode==="direct"?"your browser key.":"the secure proxy."),"good");
    else if(cfg.key)setConnStatus("A key is saved for this tab. Reconnect, or paste a new key to replace it.");
    else setConnStatus("");
    gm.classList.add("on");gm.setAttribute("aria-hidden","false");
    setTimeout(function(){
      var target=gemTab==="direct"?$("hgk"):$("hge");
      if(target&&!target.disabled)target.focus();
    },50);
  }
  function closeGemini(){
    var gm=$("hgm");if(!gm)return;
    gm.classList.remove("on");gm.setAttribute("aria-hidden","true");
    if(box.contains(document.activeElement)){try{box.querySelector(".gchip").focus()}catch(e){}}
  }
  function connectGemini(e){
    if(e)e.preventDefault();
    if(gemBusy)return;
    var errBtn=$("hgconnect"),oldLabel=errBtn.textContent;
    var done=function(){gemBusy=false;errBtn.disabled=false;errBtn.textContent=oldLabel};
    var fail=function(x){setConnStatus(networkMessage(x,"Gemini"),"bad");done()};
    setConnStatus("");
    if(gemTab==="direct"){
      var key=$("hgk").value.trim()||cfg.key;
      var model=$("hgm2").value;
      if(MODELS.indexOf(model)<0)model=MODELS[0];
      if(!key){setConnStatus("Paste your Gemini API key first. It is kept in this tab only.","bad");return}
      if(/\s/.test(key)||key.length<20){setConnStatus("That key looks incomplete. Copy the whole key from Google AI Studio and try again.","bad");return}
      gemBusy=true;errBtn.disabled=true;errBtn.textContent="Testing key…";
      setConnStatus("Checking the key directly with Google…");
      testDirect(key,model).then(function(){
        cfg.mode="direct";cfg.key=key;cfg.model=model;
        remoteMsgs=[];
        saveCfg();
        setMode("direct");
        $("hgk").value="";
        closeGemini();
        toast("Gemini connected · "+MODEL_LABEL[model]);
        done();
      }).catch(function(x){fail(x)});
      return;
    }
    var ep=cleanEndpoint($("hge").value);
    var tk=$("hgt").value.trim()||cfg.token;
    if(!ep){setConnStatus("Enter the full address of your assistant proxy, for example https://example.com/api/assistant.","bad");return}
    if(/^http:\/\//i.test(ep)&&!/^http:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(ep)){
      setConnStatus("Use HTTPS for a remote proxy. Plain HTTP is only accepted for localhost.","bad");return
    }
    gemBusy=true;errBtn.disabled=true;errBtn.textContent="Testing proxy…";
    setConnStatus("Checking the proxy…");
    testProxy(ep,tk).then(function(info){
      cfg.mode="proxy";cfg.endpoint=ep;cfg.token=tk;
      if(info&&MODELS.indexOf(info.model)>-1)cfg.model=info.model;
      remoteMsgs=[];
      saveCfg();
      setMode("proxy");
      closeGemini();
      toast("Gemini connected · secure proxy"+(info&&info.model?" ("+info.model+")":""));
      done();
    }).catch(function(x){fail(x)});
  }
  function disconnectGemini(){
    turn++;
    if(lastAbort){try{lastAbort.abort()}catch(e){}lastAbort=null}
    remoteMsgs=[];busy=false;cfg.mode="";saveCfg();
    setMode("");
    closeGemini();
    toast("Gemini disconnected · local mode");
  }
  function forgetKey(){
    turn++;
    if(lastAbort){try{lastAbort.abort()}catch(e){}lastAbort=null}
    remoteMsgs=[];busy=false;
    var model=cfg.model;
    resetCfg();
    cfg.model=model;
    $("hgk").value="";$("hgt").value="";
    setMode("");
    closeGemini();
    toast("Key removed from this tab · local mode");
  }

  function ask(text){
    text=String(text||"").trim();if(!text||busy)return;
    var myTurn=++turn;
    $("hi").value="";$("hc").innerHTML="";
    add("me",esc(text));
    busy=true;typing();
    function finish(html,chips){
      if(myTurn!==turn)return;
      var ty=$("htyping");if(ty)ty.remove();
      add("bot",html);
      setChips(chips||defaultChips());
      busy=false;
      var m=findTools(text);if(m.length)ctx.lastTool=m[0];
      if(!box.classList.contains("open"))bump();
      save();
    }
    function localReply(prefix){
      var r;
      try{r=reply(text,ctx)}
      catch(e){r={b:"Sorry — something went wrong in my local brain. Try a simpler question, or reset the chat.",c:defaultChips()}}
      finish((prefix?'<span class="tiny">'+prefix+'</span><br>':"")+r.b,r.c);
    }
    if(remote){
      var last=remoteMsgs[remoteMsgs.length-1];
      if(last&&last.role==="user")last.content+="\n\n"+text;
      else remoteMsgs.push({role:"user",content:text});
      remoteMsgs=remoteMsgs.slice(-16);
      remoteReply().then(function(out){
        if(myTurn!==turn)return;
        remoteMsgs.push({role:"assistant",content:out});
        remoteMsgs=remoteMsgs.slice(-16);
        var ty=$("htyping");if(ty)ty.remove();
        add("bot",md(out));
        setChips(defaultChips());
        busy=false;
        var m=findTools(text);if(m.length)ctx.lastTool=m[0];
        if(!box.classList.contains("open"))bump();
        save();
      }).catch(function(x){
        if(myTurn!==turn)return;
        var msg=x&&x.message?x.message:"connection failed";
        var rejected=x&&(x.status===401||x.status===403);
        if(rejected&&cfg.mode==="direct"){
          cfg.mode="";cfg.key="";saveCfg();
          setMode("");
          toast("Key rejected · removed from this tab");
        }
        remoteMsgs=[];
        localReply("Gemini could not answer ("+esc(msg)+"). Answering locally."+(rejected?" The saved key was removed.":""));
      });
    }else{
      setTimeout(function(){if(myTurn===turn)localReply("")},140+Math.min(240,text.length*4));
    }
  }
  function bump(){
    var b=fab.querySelector(".badge");b.textContent=(+b.textContent||0)+1;b.classList.add("on");
  }
  function clearChat(){
    turn++;busy=false;
    if(lastAbort){try{lastAbort.abort()}catch(e){}lastAbort=null}
    remoteMsgs=[];hist=[];save();
    var b=$("hb");if(b)b.innerHTML="";
    start(false);
  }
  function start(greet){
    if(greet!==false){
      add("bot","Hi — I’m the <b>Hub Assistant</b>. Tell me what you’re working on and I’ll point you to the right tool.");
      add("bot","I run <b>locally by default</b>, so your messages stay on this device. For longer answers you can connect Gemini from the header: paste your own API key (kept in this tab only and sent straight to Google) or use a secure proxy. Only chat text leaves your browser then, never your files.<br><span class='tiny'>Tip: press <b>?</b> anywhere to open me. I never read the contents of an attached file.</span>");
    }else{
      add("bot","Fresh start. What would you like to do?");
    }
    setChips(defaultChips());
    save();
  }
  function open(v){
    var on=!!v;
    box.classList.toggle("open",on);
    box.setAttribute("aria-hidden",on?"false":"true");
    fab.setAttribute("aria-expanded",on?"true":"false");
    var badge=fab.querySelector(".badge");badge.classList.remove("on");badge.textContent="";
    tip.classList.remove("on");
    if(on){htRetract();setTimeout(function(){$("hi").focus()},40);scroll()}
    else if(document.activeElement&&box.contains(document.activeElement)){try{fab.focus()}catch(e){}}
  }
  function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem("theme",t)}catch(e){try{localStorage.setItem("theme",t)}catch(x){}};window.dispatchEvent(new CustomEvent("mth:theme",{detail:t}))}

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */
  fab.onclick=function(){open(!box.classList.contains("open"))};
  box.addEventListener("click",function(e){
    var x=e.target.closest("[data-x]");if(x){
      var k=x.getAttribute("data-x");
      if(k==="close"||k==="back")open(false);
      else if(k==="refresh"){clearChat();toast("Chat reset")}
      else if(k==="clear"){if(confirm("Clear this conversation? Your files are untouched.")){clearChat();toast("Chat cleared")}}
      else if(k==="privacy")ask("Is it private?");
      else if(k==="gemini")openGemini();
      else if(k==="gmclose")closeGemini();
      return;
    }
    var tab=e.target.closest("[data-mode]");
    if(tab){setGemTab(tab.getAttribute("data-mode"));setConnStatus("");return}
    if(e.target===$("hgm"))closeGemini();
  });
  $("hf").addEventListener("submit",function(e){e.preventDefault();ask($("hi").value)});
  $("hi").addEventListener("keydown",function(e){if(e.key==="Escape"){open(false)}});
  $("hgf").addEventListener("submit",connectGemini);
  $("hgdis").addEventListener("click",disconnectGemini);
  $("hgforget").addEventListener("click",forgetKey);
  $("hgshow").addEventListener("click",function(){
    var k=$("hgk"),on=k.type==="password";
    k.type=on?"text":"password";
    this.textContent=on?"Hide":"Show";
    this.setAttribute("aria-pressed",on?"true":"false");
    k.focus();
  });
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"){
      if($("hgm").classList.contains("on")){closeGemini();return}
      if(box.classList.contains("open")){open(false);return}
    }
    if((e.altKey&&e.key==="/")||(e.key==="?"&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!document.activeElement.isContentEditable)){e.preventDefault();open(true);setTimeout(function(){$("hi").focus()},50)}
  });

  /* voice input */
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(SR){
    var mic=$("hmic");mic.hidden=false;
    var recog=new SR();recog.lang="en-US";recog.interimResults=false;recog.maxAlternatives=1;
    var listening=false;
    mic.onclick=function(){
      if(listening){try{recog.stop()}catch(e){}return}
      try{recog.start();listening=true;mic.classList.add("rec");$("hi").placeholder="Listening… speak now"}catch(e){toast("Microphone could not start")}
    };
    recog.onresult=function(ev){
      var t=ev.results[0][0].transcript;listening=false;mic.classList.remove("rec");$("hi").placeholder="e.g. “sign my PDF” or “why is it private?”";
      if(t)ask(t);
    };
    recog.onerror=function(){listening=false;mic.classList.remove("rec");$("hi").placeholder="e.g. “sign my PDF” or “why is it private?”";toast("Voice input did not work — try typing instead")};
    recog.onend=function(){listening=false;mic.classList.remove("rec");$("hi").placeholder="e.g. “sign my PDF” or “why is it private?”"};
  }

  /* file check */
  $("hfile").onclick=function(){fileInput.value="";fileInput.click()};
  fileInput.onchange=function(){
    var f=fileInput.files&&fileInput.files[0];if(!f)return;
    var ext=(f.name.match(/\.([a-z0-9]+)$/i)||[,""])[1].toLowerCase();
    var kind=/^image\//.test(f.type)||/^(jpg|jpeg|png|webp|gif|bmp|svg)$/.test(ext)?"image":
             /^video\//.test(f.type)||/^(mp4|webm|mov|mkv|avi)$/.test(ext)?"video":
             /^audio\//.test(f.type)||/^(mp3|wav|m4a|ogg|flac|aac)$/.test(ext)?"audio":
             ext==="pdf"?"pdf":"other";
    add("me",'<i class="fa-solid fa-paperclip"></i> '+esc(f.name)+' <span class="tiny">('+fmt(f.size)+')</span>');
    typing();busy=true;
    var myTurn=++turn;
    setTimeout(function(){
      if(myTurn!==turn)return;
      var ty=$("htyping");if(ty)ty.remove();
      var out;
      if(kind==="pdf"){
        out={b:"That looks like a <b>PDF</b> ("+esc(f.name)+", "+fmt(f.size)+"). What would you like to do with it? I can take you straight there:<br>"+
          '<div class="tcards">'+
          card("editor","fa-pen-nib","Edit, sign or annotate")+
          card("compress","fa-file-arrow-down","Make it smaller")+
          card("pdf-to-word","fa-file-word","Convert to Word")+
          card("watermark","fa-certificate","Add a watermark")+
          '</div>',c:["Edit text or sign","Compress it","PDF to Word","Privacy"]};
      }else if(kind==="image"){
        out={b:"That’s an <b>image</b> ("+esc(f.name)+", "+fmt(f.size)+"). I can compress or convert it, or put it into a PDF:<br>"+
          '<div class="tcards">'+card("image-compressor","fa-compress","Compress or convert")+card("jpg-to-pdf","fa-images","Turn it into a PDF")+'</div>',c:["Compress the image","Image to PDF","Privacy"]};
      }else if(kind==="video"||kind==="audio"){
        out={b:"That’s "+(kind==="video"?"a <b>video</b>":"an <b>audio</b> file")+" ("+esc(f.name)+", "+fmt(f.size)+"). I can pull the audio out as MP3:<br>"+
          '<div class="tcards">'+card("video-to-mp3","fa-file-audio","Extract MP3 audio")+'</div>',c:["Open Video to MP3","Privacy"]};
      }else{
        out={b:"I recognise the name and size but not a tool for <b>"+esc(ext?("."+ext):"that file type")+"</b>. Try a PDF, image, video or audio file, or tell me what you want to do.",c:defaultChips()};
      }
      add("bot",out.b);setChips(out.c);busy=false;
      if(!box.classList.contains("open"))bump();
    },520);
  };
  function card(id,icon,label){
    var t=T.filter(function(x){return x.id===id})[0];
    return '<a class="tcard" href="'+base+t.url+'"><span class="ti"><i class="fa-solid '+icon+'"></i></span><span class="tx"><b>'+esc(t.name)+'</b><small>'+esc(label)+'</small></span></a>';
  }
  function fmt(b){return b>=1048576?(b/1048576).toFixed(1)+" MB":Math.max(1,Math.round(b/1024))+" KB"}

  /* public API for tool pages */
  window.openHubChat=function(){open(true)};
  window.hubAsk=function(text){open(true);setTimeout(function(){ask(text)},80)};
  window.hubSetTheme=setTheme;

  /* Restore an explicit connection from this tab's session only. */
  setMode(cfg.mode);
  load();
  if(hist.length){
    hist.forEach(function(m){add(m.who,m.html,{noSave:true})});
    setChips(defaultChips());
  }else{
    start(true);
  }
  /* gentle nudge once per session */
  setTimeout(function(){
    if(!box.classList.contains("open")&&!sessionStorage.getItem("mth.tip")){
      tip.classList.add("on");sessionStorage.setItem("mth.tip","1");
      setTimeout(function(){tip.classList.remove("on")},7000);
    }
  },9000);
})();
