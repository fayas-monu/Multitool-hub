/* ==========================================================================
   MULTI TOOL HUB — tool registry
   ========================================================================== */
(function () {
  "use strict";
  var MTH = window.MTH = window.MTH || {};

  MTH.categories = [
    { id: "pdf", name: "PDF Studio", kicker: "01", href: "index.html#pdf", desc: "Read, annotate, assemble, secure and convert documents." },
    { id: "image", name: "Image Lab", kicker: "02", href: "index.html#image", desc: "Compress, convert and clean up images locally." },
    { id: "media", name: "Media Desk", kicker: "03", href: "index.html#media", desc: "Re-encode video and extract audio in the browser." },
    { id: "download", name: "Downloaders", kicker: "04", href: "index.html#download", desc: "Check a public YouTube or Instagram link, then open the partner download card." },
    { id: "focus", name: "After Hours", kicker: "05", href: "index.html#focus", desc: "Optional, high-craft downtime: ambient soundscapes, colour studies and calm focus rituals." }
  ];

  MTH.tools = [
    {
      id: "viewer", title: "PDF Viewer & Editor", short: "Viewer & Editor", cat: "pdf", icon: "viewer",
      href: "tools/viewer.html", badge: "Flagship",
      desc: "Read every page, annotate, rotate, reorder and export a clean assembled PDF — with a smooth infinite canvas.",
      tags: ["PDF", "Annotate", "Reorder"],
      aliases: "view pdf edit pdf annotate sign reorder pages rotate pages assemble document markup comment infinite scroll zoom"
    },
    {
      id: "crop", title: "Crop PDF", short: "Crop PDF", cat: "pdf", icon: "crop",
      href: "tools/crop.html",
      desc: "Draw a precise crop box with eight handles, auto-trim margins, and apply it to one page or a whole range.",
      tags: ["PDF", "Crop", "Margins"],
      aliases: "crop pdf trim margins cut page borders white space cropbox"
    },
    {
      id: "merge", title: "Merge PDF", short: "Merge PDF", cat: "pdf", icon: "merge",
      href: "tools/merge.html",
      desc: "Combine PDFs in exactly the order you choose. Page order is preserved and the result opens everywhere.",
      tags: ["PDF", "Combine", "Order"],
      aliases: "merge pdf combine pdf join pdf append pdf multiple documents"
    },
    {
      id: "split", title: "Split PDF", short: "Split PDF", cat: "pdf", icon: "split",
      href: "tools/split.html",
      desc: "Extract selected pages, split every page, or create fixed-size chunks and download the set as a ZIP.",
      tags: ["PDF", "Extract", "ZIP"],
      aliases: "split pdf extract pages separate pdf cut pdf page ranges chunks"
    },
    {
      id: "organize", title: "Organize Pages", short: "Organize Pages", cat: "pdf", icon: "organize",
      href: "tools/organize.html",
      desc: "Drag pages into a new sequence, rotate, duplicate, delete or insert blanks, then export the reassembled file.",
      tags: ["PDF", "Reorder", "Pages"],
      aliases: "organize pdf reorder pages move delete rotate duplicate page arrange document"
    },
    {
      id: "rotate", title: "Rotate PDF", short: "Rotate PDF", cat: "pdf", icon: "rotate",
      href: "tools/rotate.html",
      desc: "Turn selected pages or the whole document by 90°, 180° or 270° without re-rendering the content.",
      tags: ["PDF", "Rotate", "Pages"],
      aliases: "rotate pdf turn page landscape portrait orientation fix sideways"
    },
    {
      id: "compress", title: "Compress PDF", short: "Compress PDF", cat: "pdf", icon: "compress",
      href: "tools/compress.html",
      desc: "Clean up the file structure losslessly or rebuild pages at a lower resolution for a dramatic size reduction.",
      tags: ["PDF", "Size", "Optimise"],
      aliases: "compress pdf reduce pdf size shrink pdf optimise pdf smaller file"
    },
    {
      id: "watermark", title: "Watermark PDF", short: "Watermark PDF", cat: "pdf", icon: "watermark",
      href: "tools/watermark.html",
      desc: "Stamp text or an image across a page, tile it, set opacity and angle, and preview the result live.",
      tags: ["PDF", "Watermark", "Brand"],
      aliases: "watermark pdf stamp text logo brand protect draft confidential overlay"
    },
    {
      id: "page-numbers", title: "Page Numbers", short: "Page Numbers", cat: "pdf", icon: "hash",
      href: "tools/page-numbers.html",
      desc: "Add polished page numbers at any edge, choose the format, size, margin and starting number.",
      tags: ["PDF", "Numbers", "Layout"],
      aliases: "page numbers pdf pagination number pages footer header bates numbering"
    },
    {
      id: "unlock", title: "Unlock PDF", short: "Unlock PDF", cat: "pdf", icon: "lock",
      href: "tools/unlock.html",
      desc: "Remove protection from a PDF when you know the current password. Nothing is guessed, cracked or uploaded.",
      tags: ["PDF", "Password", "Access"],
      aliases: "unlock pdf remove password decrypt pdf protected open password known"
    },
    {
      id: "pdf-to-images", title: "PDF to Images", short: "PDF to Images", cat: "pdf", icon: "image",
      href: "tools/pdf-to-images.html",
      desc: "Render PDF pages as crisp JPG, PNG or WebP files at your chosen resolution, then save one page or the full ZIP.",
      tags: ["PDF", "JPG", "PNG"],
      aliases: "pdf to jpg pdf to png pdf to webp export pages images render screenshot"
    },
    {
      id: "images-to-pdf", title: "Images to PDF", short: "Images to PDF", cat: "pdf", icon: "images",
      href: "tools/images-to-pdf.html",
      desc: "Turn a batch of JPG, PNG or WebP images into one clean PDF, with page size, margins and image order under control.",
      tags: ["JPG", "PDF", "Batch"],
      aliases: "jpg to pdf png to pdf photos to pdf images to pdf scan combine pictures"
    },
    {
      id: "pdf-to-text", title: "PDF to Text", short: "PDF to Text", cat: "pdf", icon: "text",
      href: "tools/pdf-to-text.html",
      desc: "Extract the document's real text layer, reconstruct sensible lines and paragraphs, and copy or save as .txt.",
      tags: ["PDF", "Text", "Extract"],
      aliases: "pdf to text extract text from pdf copy text txt content"
    },
    {
      id: "pdf-to-word", title: "PDF to Word", short: "PDF to Word", cat: "pdf", icon: "word",
      href: "tools/pdf-to-word.html",
      desc: "Build a real .docx from the PDF text layer with headings, paragraphs and page breaks — ready for Word or LibreOffice.",
      tags: ["PDF", "DOCX", "Text"],
      aliases: "pdf to word pdf to docx convert pdf document editable word"
    },
    {
      id: "pdf-to-excel", title: "PDF to Excel & CSV", short: "PDF to Excel", cat: "pdf", icon: "table",
      href: "tools/pdf-to-excel.html", badge: "New",
      desc: "Detect rows and columns from a PDF text layer, preview the grid, and export a tidy .xlsx workbook or CSV.",
      tags: ["PDF", "XLSX", "CSV"],
      aliases: "pdf to excel pdf to xlsx pdf to csv extract table spreadsheet rows columns data"
    },
    {
      id: "image-compress", title: "Image Compressor", short: "Image Compressor", cat: "image", icon: "compress",
      href: "tools/image-compress.html",
      desc: "Batch-compress JPG, PNG and WebP images to a quality level or target file size, with live before-and-after stats.",
      tags: ["JPG", "PNG", "WebP"],
      aliases: "compress image reduce image size optimise photo shrink jpg png webp target size batch"
    },
    {
      id: "image-convert", title: "Image Converter", short: "Image Converter", cat: "image", icon: "convert",
      href: "tools/image-convert.html",
      desc: "Switch formats instantly, resize while converting and strip hidden metadata as part of the same local pass.",
      tags: ["Convert", "Resize", "Privacy"],
      aliases: "convert image png to jpg jpg to webp webp to png format change resize metadata strip"
    },
    {
      id: "background-remove", title: "Background Remover", short: "Background Remover", cat: "image", icon: "eraser",
      href: "tools/background-remove.html", badge: "New",
      desc: "Remove a flat or near-flat background using an edge-aware Canvas algorithm, then replace it with transparency or a colour.",
      tags: ["PNG", "Alpha", "Canvas"],
      aliases: "remove background transparent png cut out product photo chroma key white background"
    },
    {
      id: "video-compress", title: "Video Compressor", short: "Video Compressor", cat: "media", icon: "video",
      href: "tools/video-compress.html",
      desc: "Re-encode a video in the browser with MediaRecorder, choosing resolution, bitrate, trim range and mute.",
      tags: ["Video", "WebM", "Size"],
      aliases: "compress video reduce video size re-encode webm trim video mute resolution bitrate"
    },
    {
      id: "video-to-audio", title: "Video to Audio", short: "Video to Audio", cat: "media", icon: "audio",
      href: "tools/video-to-audio.html",
      desc: "Extract the audio track, trim it, add fades and export a clean WAV or MP3 — encoding happens locally.",
      tags: ["Audio", "WAV", "MP3"],
      aliases: "video to mp3 video to audio extract audio wav mp3 sound track trim fade"
    },
    {
      id: "youtube-downloader", title: "YouTube Downloader", short: "YouTube", cat: "download", icon: "youtube",
      href: "tools/youtube-downloader.html", badge: "Partner API",
      desc: "Paste a public YouTube link, confirm the exact video, then open the Loader.to download card in a new tab.",
      tags: ["YouTube", "Video", "Audio"],
      aliases: "youtube downloader download video audio shorts mp4 mp3 save youtu.be live replay"
    },
    {
      id: "instagram-downloader", title: "Instagram Downloader", short: "Instagram", cat: "download", icon: "instagram",
      href: "tools/instagram-downloader.html",
      desc: "Save a public reel, video or photo post you have permission to keep, through the same explained Loader.to workflow.",
      tags: ["Instagram", "Reels", "Photos"],
      aliases: "instagram downloader reels ig video photo post save tv share public"
    },
    {
      id: "focus-studio", title: "Focus Studio", short: "Focus Studio", cat: "focus", icon: "timer",
      href: "tools/focus-studio.html", badge: "Updated",
      desc: "A quiet Pomodoro timer and a persistent task checklist, paired with a direct path into Ambient Studio for your break.",
      tags: ["Timer", "Tasks", "Ritual"],
      aliases: "focus timer pomodoro productivity checklist tasks break habit deep work"
    },
    {
      id: "ambient-studio", title: "Ambient Studio", short: "Ambient Studio", cat: "focus", icon: "audio",
      href: "entertainment.html#ambient", badge: "New",
      desc: "Generate rain, ocean, forest and deep-focus soundscapes with Web Audio, a live visualiser and a fade-out sleep timer.",
      tags: ["Audio", "Focus", "Local"],
      aliases: "ambient sound rain ocean forest noise soundscape relax sleep timer focus music background"
    },
    {
      id: "chromatic", title: "Chromatic Lab", short: "Chromatic Lab", cat: "focus", icon: "wand",
      href: "entertainment.html#chromatic",
      desc: "Build polished palettes and gradients from any seed colour, then copy the CSS or export a presentation-ready PNG board.",
      tags: ["Colour", "Palette", "Export"],
      aliases: "colour color palette gradient generator design brand hex css png moodboard swatch harmony"
    }
  ];

  MTH.toolById = function (id) {
    return (MTH.tools || []).filter(function (t) { return t.id === id; })[0] || null;
  };
})();
