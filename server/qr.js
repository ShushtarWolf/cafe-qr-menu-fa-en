// Local QR generation (qrcode npm — no external APIs) + printable
// table-tent PDF built with pdf-lib (pure JS).
const QRCode = require('qrcode');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');

async function menuQrPng(url, size = 512) {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' }
  });
}

// US-Letter table tent: fold along the horizontal center line.
// Bottom panel upright, top panel rotated 180° so both sides read
// correctly once the sheet is folded into a tent.
async function tableTentPdf(venueName, url) {
  const qrPng = await menuQrPng(url, 600);

  const doc = await PDFDocument.create();
  doc.setTitle(`${venueName} — QR menu table tent`);
  const page = doc.addPage([612, 792]); // US Letter, points
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const qrImage = await doc.embedPng(qrPng);

  const W = 612;
  const H = 792;
  const mid = H / 2;
  const qrSize = 210;

  // fold line (dashed)
  page.drawLine({
    start: { x: 24, y: mid },
    end: { x: W - 24, y: mid },
    thickness: 0.75,
    color: rgb(0.65, 0.65, 0.65),
    dashArray: [6, 6]
  });

  const fitTitle = (text, maxWidth, startSize) => {
    let size = startSize;
    while (size > 12 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
    return size;
  };
  const titleSize = fitTitle(venueName, W - 96, 34);
  const sub = 'Scan for our menu';
  const subSize = 16;

  const drawPanel = (flipped) => {
    // Panel-local layout (y measured from panel bottom, panel height = mid).
    const titleY = mid - 92;
    const subY = titleY - 30;
    const qrY = subY - 24 - qrSize;
    const titleW = font.widthOfTextAtSize(venueName, titleSize);
    const subW = fontReg.widthOfTextAtSize(sub, subSize);

    if (!flipped) {
      page.drawText(venueName, { x: (W - titleW) / 2, y: titleY, size: titleSize, font, color: rgb(0.1, 0.09, 0.08) });
      page.drawText(sub, { x: (W - subW) / 2, y: subY, size: subSize, font: fontReg, color: rgb(0.45, 0.42, 0.4) });
      page.drawImage(qrImage, { x: (W - qrSize) / 2, y: qrY, width: qrSize, height: qrSize });
    } else {
      // Rotate 180° into the top half: (x, y) → (W - x, H - y).
      page.drawText(venueName, {
        x: (W + titleW) / 2, y: H - titleY, size: titleSize, font,
        color: rgb(0.1, 0.09, 0.08), rotate: degrees(180)
      });
      page.drawText(sub, {
        x: (W + subW) / 2, y: H - subY, size: subSize, font: fontReg,
        color: rgb(0.45, 0.42, 0.4), rotate: degrees(180)
      });
      page.drawImage(qrImage, {
        x: (W + qrSize) / 2, y: H - qrY, width: qrSize, height: qrSize, rotate: degrees(180)
      });
    }
  };

  drawPanel(false);
  drawPanel(true);

  return Buffer.from(await doc.save());
}

module.exports = { menuQrPng, tableTentPdf };
