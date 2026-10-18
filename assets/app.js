/* PDF EDIT TOOL — shared helpers. Credit: (hank!nd3 p4d4y41! | FAYAS MONU */
(function(){
  try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t;}catch(e){}
  var PE=window.PE={};
  PE.$=function(id){return document.getElementById(id)};
  PE.esc=function(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML};
  PE.fmt=function(b){return b>=1048576?(b/1048576).toFixed(2)+" MB":Math.max(1,Math.round(b/1024))+" KB"};
  PE.baseName=function(n){return n.replace(/\.[^.]+$/,"")};
  PE.download=function(data,name,type){
    var blob=data instanceof Blob?data:new Blob([data],{type:type||"application/octet-stream"});
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
  };
  PE.toast=function(msg){
    var t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;
    document.body.appendChild(t);setTimeout(function(){t.remove()},2600);
  };
  PE.status=function(msg,kind){var s=PE.$("status");s.textContent=msg;s.className="status"+(kind?" "+kind:"")};
  PE.progress=function(p){var w=PE.$("prog");if(!w)return;w.style.display=p==null?"none":"block";if(p!=null)w.firstElementChild.style.width=Math.round(p*100)+"%"};
  PE.drop=function(zone,input,accept,onFiles){
    function take(list){
      var ok=[].filter.call(list,function(f){return accept.test(f.type)||accept.test(f.name)});
      if(!ok.length){PE.status("That file type isn’t supported here.","err");return}
      onFiles(ok);
    }
    input.addEventListener("change",function(){take(input.files);input.value=""});
    ["dragenter","dragover"].forEach(function(e){zone.addEventListener(e,function(ev){ev.preventDefault();zone.classList.add("over")})});
    ["dragleave","drop"].forEach(function(e){zone.addEventListener(e,function(){zone.classList.remove("over")})});
    zone.addEventListener("drop",function(ev){ev.preventDefault();take(ev.dataTransfer.files)});
  };
  PE.readPdf=async function(file){
    try{return await PDFLib.PDFDocument.load(await file.arrayBuffer())}
    catch(e){
      if(/encrypt/i.test(e.message))throw new Error(file.name+" is password-protected. Remove the password first.");
      throw new Error(file.name+" couldn’t be read. It may be damaged or not a PDF.");
    }
  };
})();
