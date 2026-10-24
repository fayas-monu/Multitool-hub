/* MULTI TOOL HUB — Hub Assistant v4.
   Runs fully in the browser. No message ever leaves the device.
   Credit: (hank!nd3 p4d4y41! | FAYAS MONU */
(function(){
  "use strict";
  var script=document.currentScript,base=new URL("../",script.src).href;
  var LOGO=base+"assets/logo.svg";

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
    [/upload|private|privacy|safe|secure|server|store|stored|leav|sent|send.*(file|document)|cloud/i,"Local tools (PDF, images, audio) process files inside your browser. Your files are not uploaded to us and disappear when the tab closes. The two link downloaders send <b>only the public link you paste</b> to Loader.to. The assistant runs locally too — your messages are never sent anywhere. Details: <a href='"+base+"privacy.html'>Privacy Policy</a>."],
    [/api|loader|third.?party|external|how.*download.*work/i,"The downloader API is Loader.to. It is used only for the YouTube and Instagram tools. When you press “Get download options”, the public URL you typed is sent to Loader.to so it can prepare the file; no document, account or private data is sent. That is the complete picture, and it is disclosed in the Privacy Policy. You can ignore those two tools and still use the other 15 entirely locally. <a href='"+base+"privacy.html'>Read exactly what is shared</a>."],
    [/offline|no wifi|without internet|airplane|internet/i,"After your first visit, the local tools keep working offline because the site and its libraries are cached in your browser. The downloaders and the first load of a page still need internet."],
    [/password|protected|encrypt|locked|can.?t open|won.?t open/i,"Password-protected PDFs cannot be opened by the tools yet. Open the PDF in your usual viewer, remove/export the password, then try again. I will never ask you for the password."],
    [/size|big|large|memory|crash|slow|hang|freeze|too much/i,"Large files can be slow because your device does the work. Try:<br>1. Split the PDF into smaller parts.<br>2. Close other tabs.<br>3. Use Compress PDF for image-heavy files.<br>4. On a phone, try a computer for files above ~100 MB."],
    [/phone|mobile|android|iphone|ios|tablet|touch/i,"Yes — every tool works on phones and tablets. Add the site to your home screen to open it like an app. For very large PDFs, a computer is faster."],
    [/format|support|type|file types|what files|accept/i,"PDF tools take .pdf. JPG to PDF accepts JPG, PNG and WebP. PDF to JPG exports JPG, PNG or WebP. Video to MP3 takes MP4, WebM, MOV and most audio files. Image Compressor takes JPG, PNG and WebP."],
    [/not working|error|failed|broken|bug|problem|doesn.?t work|won.?t work|stuck/i,"Let’s fix it. First try a refresh and a smaller file. If the tool still fails, tell me:<br>• which tool<br>• the file type and approximate size<br>• the exact message you see<br>You can also open <a href='"+base+"index.html#faq'>the FAQ</a> or message the creator on Instagram."],
    [/creator|who made|owner|developer|fayas|contact|support|instagram|email/i,"MULTI TOOL HUB is created by <strong>(hank!nd3 p4d4y41! | FAYAS MONU</strong>. Message on Instagram: <a href='https://www.instagram.com/____fa_y_as_____' target='_blank' rel='noopener'>@____fa_y_as_____</a>."],
    [/terms|conditions|legal|liability|copyright|dmca/i,"You can read the full <a href='"+base+"terms.html'>Terms &amp; Conditions</a>. In short: your files stay yours, use only content you have permission for, and keep a copy of your original because results can be imperfect."],
    [/scan|ocr|image.*pdf|picture.*text|editable.*scan/i,"Scanned PDFs are pictures, so there is no text for PDF to Word or PDF to Text to read. There is no OCR engine yet. You can still crop, rotate, compress, watermark or export the pages as images."],
    [/redact|hide.*sensitive|black.*out|whiteout|cover.*text/i,"Use the <a href='"+base+"tools/editor.html'>PDF Editor</a>. A white/black box alone does <b>not</b> remove the text underneath. Turn on <b>Flatten redactions</b> when saving, which rasterises those pages so the hidden text is truly removed. Always check the saved file."],
    [/pdf.*word|word.*pdf.*(bad|wrong|layout|format)|convert.*word.*(not|wrong|bad)/i,"PDF to Word rebuilds headings, paragraphs, lists and simple tables. A PDF only stores positioned text fragments, so a magazine layout can still shift slightly. Preview it first; if a scanned PDF has no text, it cannot be converted until OCR is added."],
    [/dark|light|theme|night|mode/i,"I can change that. Say “dark mode” or “light mode”, or use the half-circle button in the header."],
    [/language|translate|hindi|urdu|bangla|arabic|spanish/i,"The interface and assistant are in English. The PDF tools can handle Latin text in the standard fonts; non-Latin characters may not render in edited text. A translation feature is not available yet."],
    [/new|update|what.?s changed|changelog|features/i,"This upgrade added: a new 3D identity, a redesigned theme, a smarter local assistant, live previews with page navigation, a rebuilt PDF editor (text, sign, shapes, forms, comments, page tools, rotated pages), a much better PDF to Word engine, new PDF to Text and Image Compressor tools, richer legal pages, and PWA icons. See <a href='"+base+"NOTES.md'>the upgrade notes</a>."],
    [/shortcut|keyboard|keys/i,"Press <b>/</b> on the home page to search, <b>?</b> or <b>Alt+/</b> to open me, and <b>Esc</b> to close. In the editor: Ctrl+Z undo, Ctrl+Shift+Z redo, Ctrl+D duplicate, Delete removes, arrow keys nudge."]
  ];

  function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML}
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
    return 'Local tools keep your files in your browser. The only outbound request is the public link you paste into a downloader. <a href="'+base+'privacy.html">Full privacy policy</a>.';
  }

  /* ------------------------------------------------------------------ */
  /* Reply engine                                                        */
  /* ------------------------------------------------------------------ */
  function contextAware(){try{var p=location.pathname.split("/").pop()||"index.html";var map={"editor.html":"PDF Editor","merge-pdf.html":"Merge PDF","split-pdf.html":"Split PDF","compress-pdf.html":"Compress PDF","jpg-to-pdf.html":"JPG to PDF","pdf-to-word.html":"PDF to Word","pdf-to-text.html":"PDF to Text","watermark.html":"Watermark","crop-pdf.html":"Crop PDF","page-numbers.html":"Page Numbers","organize-pdf.html":"Organize Pages","rotate-pdf.html":"Rotate PDF","pdf-to-jpg.html":"PDF to JPG","image-compressor.html":"Image Compressor","video-to-mp3.html":"Video to MP3","youtube-downloader.html":"YouTube Downloader","instagram-downloader.html":"Instagram Downloader"};var name=map[p]||p;return "You are on: "+name+". Most tools run locally in your browser. The Hub Assistant runs entirely in your browser with no external AI/API."; }catch(e){return "";}}`n`n  function reply(input,ctx){ ctx=ctx||{}; if(!ctx.tip)ctx.tip=contextAware();
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
  #hubfab{position:fixed;right:20px;bottom:20px;z-index:9998;width:62px;height:62px;border:0;border-radius:19px;padding:0;cursor:pointer;background:none;filter:drop-shadow(0 12px 22px rgba(24,24,90,.42));transition:transform .18s}
  #hubfab:hover{transform:translateY(-4px) rotate(-3deg)}
  #hubfab img{width:62px;height:62px;display:block}
  #hubfab .ring{position:absolute;inset:-5px;border-radius:23px;border:2px solid color-mix(in srgb,var(--accent,#3d3bf3) 55%,transparent);animation:hr 2.8s ease-out infinite;pointer-events:none}
  @keyframes hr{0%{transform:scale(.92);opacity:.75}70%,100%{transform:scale(1.18);opacity:0}}
  #hubfab .badge{position:absolute;top:-5px;right:-5px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:#ef4444;color:#fff;border:2px solid var(--surface,#fff);font:800 10px/15px 'Plus Jakarta Sans',sans-serif;display:none}
  #hubfab .badge.on{display:block}
  #hubtip{position:fixed;right:92px;bottom:33px;z-index:9997;background:var(--surface,#fff);color:var(--ink,#11162b);border:1px solid var(--line,#d9deea);box-shadow:0 14px 30px -12px rgba(10,12,40,.35);border-radius:12px;padding:10px 13px;font:600 12.5px 'Plus Jakarta Sans',sans-serif;display:none;max-width:220px;line-height:1.4}
  #hubtip.on{display:block;animation:hpop .25s ease-out}
  @keyframes hpop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  #hubchat{display:none;position:fixed;right:20px;bottom:92px;z-index:9999;width:min(400px,calc(100vw - 24px));height:min(620px,80vh);flex-direction:column;overflow:hidden;border-radius:22px;background:var(--surface,#fff);color:var(--ink,#11162b);border:1px solid var(--line,#d9deea);box-shadow:0 34px 70px -18px rgba(8,10,34,.55);font:14px 'Plus Jakarta Sans',system-ui,sans-serif}
  #hubchat.open{display:flex;animation:hpop .2s ease-out}
  #hubchat .h{display:flex;align-items:center;gap:11px;padding:13px 14px;background:linear-gradient(135deg,#151a3d 0%,#2b2a8c 55%,#4a3bd6 100%);color:#fff;position:relative;overflow:hidden}
  #hubchat .h::after{content:"";position:absolute;right:-30px;top:-40px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.1)}
  #hubchat .h img{width:40px;height:40px;filter:drop-shadow(0 4px 7px rgba(0,0,0,.4));position:relative}
  #hubchat .h .who{flex:1;min-width:0;position:relative}
  #hubchat .h b{display:block;font-size:14.5px;letter-spacing:-.2px}
  #hubchat .h small{display:flex;align-items:center;gap:5px;opacity:.82;font-size:11.5px}
  #hubchat .h small::before{content:"";width:6px;height:6px;border-radius:50%;background:#52e0a4;box-shadow:0 0 0 3px rgba(82,224,164,.22)}
  #hubchat .h button{background:rgba(255,255,255,.14);border:0;color:#fff;width:31px;height:31px;border-radius:9px;cursor:pointer;font-size:14px;display:grid;place-items:center;position:relative}
  #hubchat .h button:hover{background:rgba(255,255,255,.26)}
  #hubchat .b{flex:1;overflow-y:auto;padding:14px 13px 6px;display:flex;flex-direction:column;gap:10px;background:var(--bg,#f2f4f9);scroll-behavior:smooth}
  #hubchat .b::-webkit-scrollbar{width:8px}#hubchat .b::-webkit-scrollbar-thumb{background:var(--line);border-radius:4px}
  #hubchat .mrow{display:flex;gap:8px;align-items:flex-end;max-width:100%}
  #hubchat .mrow.me{flex-direction:row-reverse}
  #hubchat .av{width:26px;height:26px;border-radius:8px;flex:none;display:grid;place-items:center;font-size:11px;background:linear-gradient(135deg,#3d3bf3,#7c3aed);color:#fff;margin-bottom:2px}
  #hubchat .mrow.me .av{background:var(--line);color:var(--muted)}
  #hubchat .m{max-width:calc(100% - 42px);padding:10px 13px;border-radius:15px;line-height:1.55;white-space:normal;font-size:13.3px;box-shadow:0 2px 8px -6px rgba(10,12,30,.4)}
  #hubchat .m.bot{background:var(--surface,#fff);border:1px solid var(--line,#d9deea);border-bottom-left-radius:5px}
  #hubchat .m.me{background:linear-gradient(135deg,var(--accent,#3d3bf3),color-mix(in srgb,var(--accent,#3d3bf3) 70%,#7c3aed));color:var(--accent-ink,#fff);border-bottom-right-radius:5px}
  #hubchat .m a{color:var(--accent,#3d3bf3);font-weight:700}
  #hubchat .m.me a{color:inherit;text-decoration:underline}
  #hubchat .m code{background:color-mix(in srgb,var(--accent) 12%,transparent);padding:1px 5px;border-radius:5px;font-size:12px}
  #hubchat .m .step{display:flex;gap:8px;margin:7px 0;line-height:1.45}
  #hubchat .m .step em{flex:none;width:19px;height:19px;border-radius:50%;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);font:800 10px/19px 'Plus Jakarta Sans',sans-serif;text-align:center;font-style:normal;margin-top:2px}
  #hubchat .m .tiny{color:var(--muted);font-size:11.5px}
  #hubchat .m .also{margin-top:7px;font-size:12px;color:var(--muted)}
  #hubchat .m .tline{margin-top:10px}
  #hubchat .openbtn{display:inline-flex;align-items:center;gap:7px;background:var(--accent);color:var(--accent-ink)!important;text-decoration:none;font-weight:800;font-size:12px;padding:8px 12px;border-radius:9px}
  #hubchat .tcards{display:flex;flex-direction:column;gap:7px;margin-top:9px}
  #hubchat .tcard{display:flex;align-items:flex-start;gap:8px;text-decoration:none;background:var(--bg);border:1px solid var(--line);border-radius:11px;padding:8px;color:inherit;position:relative}
  #hubchat .tcard:hover{border-color:var(--accent)}
  #hubchat .tcard .ti{width:27px;height:27px;border-radius:8px;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);display:grid;place-items:center;font-size:12px;flex:none}
  #hubchat .tcard .tx{min-width:0;flex:1}
  #hubchat .tcard b{display:block;font-size:12.3px;line-height:1.3}
  #hubchat .tcard small{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--muted);font-size:10.8px;line-height:1.35}
  #hubchat .tcard .go{display:none}
  #hubchat .meta{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--muted);margin:2px 0 0 34px}
  #hubchat .mrow.me .meta{margin:2px 0 0 0;justify-content:flex-end}
  #hubchat .acts{display:flex;gap:3px;opacity:0;transition:opacity .15s}
  #hubchat .mrow:hover .acts{opacity:1}
  #hubchat .acts button{border:0;background:none;color:var(--muted);font-size:10.5px;cursor:pointer;padding:2px 3px;border-radius:4px}
  #hubchat .acts button:hover{color:var(--accent);background:var(--surface)}
  #hubchat .c{display:flex;flex-wrap:wrap;gap:5px;padding:2px 13px 9px;background:var(--bg,#f2f4f9);max-height:104px;overflow-y:auto}
  #hubchat .c button{font:600 11.5px 'Plus Jakarta Sans',sans-serif;border:1px solid var(--line,#d9deea);background:var(--surface,#fff);color:var(--ink,#11162b);border-radius:15px;padding:5px 10px;cursor:pointer}
  #hubchat .c button:hover{border-color:var(--accent,#3d3bf3);color:var(--accent,#3d3bf3)}
  #hubchat .dots span{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:var(--muted,#59627c);animation:hd 1s infinite}
  #hubchat .dots span:nth-child(2){animation-delay:.15s}#hubchat .dots span:nth-child(3){animation-delay:.3s}
  @keyframes hd{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-2px)}}
  #hubchat form{display:flex;gap:7px;padding:10px;border-top:1px solid var(--line,#d9deea);background:var(--surface,#fff);align-items:center}
  #hubchat form input{flex:1;min-width:0;padding:10px 12px;border:1px solid var(--line,#d9deea);border-radius:12px;background:var(--bg,#f2f4f9);color:inherit;font:13.5px 'Plus Jakarta Sans',sans-serif;outline:0}
  #hubchat form input:focus{border-color:var(--accent)}
  #hubchat .iconbtn{width:37px;height:37px;flex:none;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--muted);cursor:pointer;display:grid;place-items:center;font-size:13px}
  #hubchat .iconbtn:hover{color:var(--accent);border-color:var(--accent)}
  #hubchat .iconbtn.rec{background:#fee2e2;color:#dc2626;border-color:#fca5a5;animation:rec 1s infinite}
  @keyframes rec{0%,100%{opacity:1}50%{opacity:.55}}
  #hubchat form .send{border:0;border-radius:12px;background:linear-gradient(135deg,var(--accent,#3d3bf3),#6d3ae0);color:#fff;font-weight:800;padding:0 15px;height:37px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:12.5px}
  #hubchat .footnote{font-size:9.5px;color:var(--muted);text-align:center;padding:0 10px 8px;background:var(--surface)}
  #hubchat .footnote button{border:0;background:none;color:var(--accent);font:inherit;cursor:pointer;padding:0}
  @media (max-width:520px){
    #hubchat{right:10px;left:10px;bottom:84px;width:auto;height:min(78vh,620px);border-radius:18px}
    #hubfab{right:14px;bottom:14px;width:56px;height:56px}#hubfab img{width:56px;height:56px}
    #hubtip{right:80px;bottom:26px}
  }
  @media (prefers-reduced-motion:reduce){#hubfab,#hubchat,.ring{animation:none!important;transition:none!important}}
  `;
  var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);

  /* ------------------------------------------------------------------ */
  /* Markup                                                              */
  /* ------------------------------------------------------------------ */
  var fab=document.createElement("button");
  fab.id="hubfab";fab.type="button";fab.setAttribute("aria-label","Open Hub Assistant (Alt + /)");
  fab.innerHTML='<img src="'+LOGO+'" alt=""><span class="ring"></span><span class="badge"></span>';
  var tip=document.createElement("div");tip.id="hubtip";tip.textContent="Need a hand? I can find the right tool.";

  var box=document.createElement("div");
  box.id="hubchat";box.setAttribute("role","dialog");box.setAttribute("aria-modal","false");box.setAttribute("aria-label","Hub Assistant");
  box.innerHTML=
   '<div class="h"><img src="'+LOGO+'" alt=""><span class="who"><b>Hub Assistant</b><small>Online · runs on this device</small></span>'+
   '<button type="button" data-x="clear" title="Clear chat" aria-label="Clear chat"><i class="fa-solid fa-rotate-left"></i></button>'+
   '<button type="button" data-x="close" title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>'+
   '<div class="b" id="hb" aria-live="polite" aria-relevant="additions"></div>'+
   '<div class="c" id="hc"></div>'+
   '<form id="hf" autocomplete="off"><button class="iconbtn" type="button" id="hfile" title="Check a file (name, type and size only)" aria-label="Check a file"><i class="fa-solid fa-paperclip"></i></button>'+
   '<input id="hi" placeholder="e.g. “sign my PDF” or “why is it private?”" aria-label="Message" maxlength="600">'+
   '<button class="iconbtn" type="button" id="hmic" title="Speak your question" aria-label="Voice input" hidden><i class="fa-solid fa-microphone"></i></button>'+
   '<button class="send" type="submit" aria-label="Send"><span>Send</span><i class="fa-solid fa-paper-plane"></i></button></form>'+
   '<div class="footnote">Runs locally · your messages never leave this device · <button type="button" data-x="privacy">Privacy</button></div>';
  document.body.append(box,fab,tip);

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
    row.innerHTML='<span class="av"><i class="fa-solid '+(who==="me"?"fa-user":"fa-wand-magic-sparkles")+'"></i></span>'+
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
    row.innerHTML='<span class="av"><i class="fa-solid fa-wand-magic-sparkles"></i></span><div class="m bot"><span class="dots"><span></span><span></span><span></span></span></div>';
    $("hb").appendChild(row);scroll();
  }
  function ask(text){
    text=String(text||"").trim();if(!text||busy)return;
    $("hi").value="";$("hc").innerHTML="";
    add("me",esc(text));
    busy=true;typing();
    var r;
    try{r=reply(text,ctx)}
    catch(e){r={b:"Sorry — something went wrong in my local brain. Try a simpler question, or refresh the page.",c:defaultChips()}}
    setTimeout(function(){
      var ty=$("htyping");if(ty)ty.remove();
      add("bot",r.b);
      setChips(r.c||defaultChips());
      busy=false;
      var m=findTools(text);if(m.length)ctx.lastTool=m[0];
      if(!box.classList.contains("open"))bump();
      save();
    }, 340+Math.min(500,text.length*10));
  }
  function bump(){
    var b=fab.querySelector(".badge");b.textContent=(+b.textContent||0)+1;b.classList.add("on");
  }
  function clearChat(){
    hist=[];save();$("hb").innerHTML="";start(false);
  }
  function start(greet){
    if(greet!==false)add("bot","Hi, I’m the <b>Hub Assistant</b>. 👋 I can find the right tool, explain privacy and the API honestly, or walk you through a job step by step.",{noSave:false});
    add("bot","What are you working on? You can type a sentence, pick a shortcut below, or attach a file so I can recommend a tool.<br><span class='tiny'>I only read the file’s name, type and size — never its contents.</span>",{noSave:false});
    setChips(defaultChips());
    save();
  }
  function open(v){
    box.classList.toggle("open",!!v);
    fab.querySelector(".badge").classList.remove("on");
    fab.querySelector(".badge").textContent="";
    tip.classList.remove("on");
    if(v){setTimeout(function(){$("hi").focus()},40);scroll()}
  }
  function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem("theme",t)}catch(e){try{localStorage.setItem("theme",t)}catch(x){}};window.dispatchEvent(new CustomEvent("mth:theme",{detail:t}))}

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */
  fab.onclick=function(){open(!box.classList.contains("open"))};
  box.addEventListener("click",function(e){
    var x=e.target.closest("[data-x]");if(x){
      var k=x.getAttribute("data-x");
      if(k==="close")open(false);
      else if(k==="clear"){if(confirm("Clear this conversation?"))clearChat()}
      else if(k==="privacy")ask("Is it private?");
      return;
    }
    if(e.target===box)return;
  });
  $("hf").addEventListener("submit",function(e){e.preventDefault();ask($("hi").value)});
  $("hi").addEventListener("keydown",function(e){if(e.key==="Escape"){open(false)}});
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"&&box.classList.contains("open"))open(false);
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
    setTimeout(function(){
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

  /* restore or start */
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
