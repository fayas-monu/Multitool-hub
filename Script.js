// Credit: (hank!nd3 p4d4y41!

let currentPdfBytes = null;

// Handle PDF Selection & Live Preview
document.getElementById('pdf-input').addEventListener('change', async function(e) {
  const file = e.target.files[0];
  const status = document.getElementById('status');

  if (!file) return;

  status.style.color = "#d35400";
  status.innerText = "Loading PDF preview...";

  try {
    currentPdfBytes = await file.arrayBuffer();
    
    // Show Preview using Blob URL
    const blob = new Blob([currentPdfBytes], { type: 'application/pdf' });
    const previewUrl = URL.createObjectURL(blob);
    
    const previewContainer = document.getElementById('pdf-preview-container');
    previewContainer.innerHTML = `<iframe src="${previewUrl}" width="100%" height="500px" style="border:none;"></iframe>`;

    status.style.color = "#27ae60";
    status.innerText = "PDF Loaded Successfully!";
  } catch (err) {
    console.error(err);
    status.style.color = "#c0392b";
    status.innerText = "Failed to load PDF file.";
  }
});

// Process Changes & Download Modified PDF
async function applyAndDownload() {
  const status = document.getElementById('status');
  const textInput = document.getElementById('text-input').value;
  const imgInput = document.getElementById('img-input').files[0];

  if (!currentPdfBytes) {
    alert("Please select a PDF file first!");
    return;
  }

  status.style.color = "#d35400";
  status.innerText = "Generating updated PDF...";

  try {
    const pdfDoc = await PDFLib.PDFDocument.load(currentPdfBytes);
    const firstPage = pdfDoc.getPages()[0];

    // Overlay Text
    if (textInput) {
      firstPage.drawText(textInput, {
        x: 50,
        y: 700,
        size: 20,
        color: PDFLib.rgb(0, 0, 0)
      });
    }

    // Embed Image/Photo
    if (imgInput) {
      const imgBytes = await imgInput.arrayBuffer();
      let img;
      if (imgInput.type === 'image/jpeg') {
        img = await pdfDoc.embedJpg(imgBytes);
      } else if (imgInput.type === 'image/png') {
        img = await pdfDoc.embedPng(imgBytes);
      }

      if (img) {
        firstPage.drawImage(img, {
          x: 400,
          y: 650,
          width: 100,
          height: 100
        });
      }
    }

    const modifiedBytes = await pdfDoc.save();
    
    // Update live preview iframe with new PDF
    const updatedBlob = new Blob([modifiedBytes], { type: 'application/pdf' });
    const updatedUrl = URL.createObjectURL(updatedBlob);
    
    const previewContainer = document.getElementById('pdf-preview-container');
    previewContainer.innerHTML = `<iframe src="${updatedUrl}" width="100%" height="500px" style="border:none;"></iframe>`;

    // Trigger Download
    downloadBlob(modifiedBytes, 'edited_document.pdf');
    status.style.color = "#27ae60";
    status.innerText = "Exported & Downloaded Successfully!";

  } catch (err) {
    console.error(err);
    status.style.color = "#c0392b";
    status.innerText = "Error exporting PDF.";
  }
}

// File Download Helper
function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
