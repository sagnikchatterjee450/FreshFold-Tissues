import fs from 'fs';
import path from 'path';
const { jsPDF } = await import('jspdf');

(async function(){
  try {
    const projectRoot = path.resolve('.');
    const publicLogoPath = path.join(projectRoot, 'public', 'freshfold-logo.png');

    if (!fs.existsSync(publicLogoPath)) {
      console.error('Logo not found at', publicLogoPath);
      process.exit(1);
    }

    const imgBuf = fs.readFileSync(publicLogoPath);
    const imgBase64 = imgBuf.toString('base64');
    const dataUrl = `data:image/png;base64,${imgBase64}`;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;

    // Logo
    const logoSize = 80; // larger for A4 pts
    const logoX = pageWidth - margin - logoSize;
    const logoY = 20;
    doc.addImage(dataUrl, 'PNG', logoX, logoY, logoSize, logoSize);

    // Invoice meta below logo
    const invoiceMetaStartY = logoY + logoSize + 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice No: INV-000123', margin, invoiceMetaStartY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, invoiceMetaStartY + 16);

    // Simple line
    doc.setDrawColor(200);
    doc.line(margin, invoiceMetaStartY + 24, pageWidth - margin, invoiceMetaStartY + 24);

    const outPath = path.join(projectRoot, 'sample-invoice.pdf');
    const arrayBuffer = doc.output('arraybuffer');
    fs.writeFileSync(outPath, Buffer.from(arrayBuffer));

    console.log('Sample PDF generated at', outPath);
  } catch (e) {
    console.error('Error generating sample PDF', e);
    process.exit(1);
  }
})();
