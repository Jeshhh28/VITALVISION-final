/**
 * VitalVision — Professional PDF Report Generator
 * Generates a clinical-style session report using jsPDF.
 */

export async function generatePDFReport(results = {}) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const page = {
    width: 210,
    height: 297,
    margin: 16,
  };

  const colors = {
    navy: [18, 37, 63],
    darkNavy: [9, 22, 39],
    blue: [37, 99, 235],
    cyan: [14, 165, 233],
    teal: [20, 184, 166],
    green: [22, 163, 74],
    amber: [217, 119, 6],
    red: [220, 38, 38],
    purple: [124, 58, 237],
    text: [31, 41, 55],
    muted: [107, 114, 128],
    light: [243, 246, 250],
    border: [209, 213, 219],
    white: [255, 255, 255],
  };

  let y = 18;

  const today = new Date();
  const generatedDate = today.toLocaleString();
  const fileDate = today.toISOString().slice(0, 10);

  const safe = (value, fallback = 'Not available') => {
    if (value === null || value === undefined || value === '') return fallback;
    return value;
  };

  const clamp = (value, min = 0, max = 100) => {
    const n = Number(value);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  };

  const addText = (text, x, yy, options = {}) => {
    const {
      size = 10,
      color = colors.text,
      style = 'normal',
      align = 'left',
      maxWidth,
    } = options;

    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);

    if (maxWidth) {
      const lines = doc.splitTextToSize(String(text), maxWidth);
      doc.text(lines, x, yy, { align });
      return lines.length * (size * 0.38);
    }

    doc.text(String(text), x, yy, { align });
    return size * 0.38;
  };

  const ensureSpace = (neededHeight = 30) => {
    if (y + neededHeight < page.height - 22) return;

    addFooter();
    doc.addPage();
    y = 18;
    addPageHeaderSmall();
  };

  const addFooter = () => {
    doc.setDrawColor(...colors.border);
    doc.line(page.margin, page.height - 18, page.width - page.margin, page.height - 18);

    addText(
      'VitalVision | CMC Vellore Internship Project | Informational use only. Not for clinical diagnosis.',
      page.width / 2,
      page.height - 10,
      {
        size: 7,
        color: colors.muted,
        align: 'center',
      }
    );
  };

  const addPageHeaderSmall = () => {
    addText('VitalVision Report', page.margin, 11, {
      size: 9,
      color: colors.muted,
      style: 'bold',
    });

    addText(fileDate, page.width - page.margin, 11, {
      size: 8,
      color: colors.muted,
      align: 'right',
    });

    doc.setDrawColor(...colors.border);
    doc.line(page.margin, 15, page.width - page.margin, 15);
  };

  const addSectionTitle = (title) => {
    ensureSpace(18);
    addText(title.toUpperCase(), page.margin, y, {
      size: 10,
      color: colors.navy,
      style: 'bold',
    });

    doc.setDrawColor(...colors.blue);
    doc.setLineWidth(0.6);
    doc.line(page.margin, y + 3, page.margin + 28, y + 3);

    y += 10;
  };

  const addInfoRow = (label, value, x, yy, width) => {
    addText(label, x, yy, {
      size: 7,
      color: colors.muted,
      style: 'bold',
    });

    addText(value, x, yy + 5, {
      size: 9,
      color: colors.text,
      maxWidth: width,
    });
  };

  const drawMetricCard = ({ label, value, unit, confidence, color }, x, yy, w, h) => {
    doc.setFillColor(...colors.white);
    doc.roundedRect(x, yy, w, h, 2, 2, 'F');

    doc.setDrawColor(...colors.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, yy, w, h, 2, 2, 'S');

    doc.setFillColor(...color);
    doc.roundedRect(x, yy, 3, h, 2, 2, 'F');

    addText(label, x + 7, yy + 8, {
      size: 8,
      color: colors.muted,
      style: 'bold',
    });

    addText(value, x + 7, yy + 19, {
      size: 18,
      color: colors.text,
      style: 'bold',
    });

    if (unit) {
      addText(unit, x + 7 + doc.getTextWidth(String(value)) + 3, yy + 19, {
        size: 8,
        color: colors.muted,
        style: 'bold',
      });
    }

    const conf = clamp(confidence || 0);
    addText(`Confidence: ${conf}%`, x + 7, yy + 29, {
      size: 7,
      color: colors.muted,
    });

    doc.setFillColor(229, 231, 235);
    doc.roundedRect(x + 7, yy + 33, w - 14, 3, 1.5, 1.5, 'F');

    doc.setFillColor(...color);
    doc.roundedRect(x + 7, yy + 33, (w - 14) * (conf / 100), 3, 1.5, 1.5, 'F');
  };

  // Header
  doc.setFillColor(...colors.navy);
  doc.rect(0, 0, page.width, 44, 'F');

  addText('VITALVISION', page.margin, 18, {
    size: 22,
    color: colors.white,
    style: 'bold',
  });

  addText('Video-Based Vital Signs Assessment Report', page.margin, 28, {
    size: 10,
    color: [205, 213, 224],
  });

  addText('CMC Vellore | Internship Project', page.margin, 36, {
    size: 8,
    color: [205, 213, 224],
  });

  addText(`Generated: ${generatedDate}`, page.width - page.margin, 36, {
    size: 8,
    color: [205, 213, 224],
    align: 'right',
  });

  y = 56;

  // Report Details
  addSectionTitle('Report Details');

  doc.setFillColor(...colors.light);
  doc.roundedRect(page.margin, y, page.width - page.margin * 2, 26, 2, 2, 'F');

  const detailW = (page.width - page.margin * 2 - 12) / 3;
  addInfoRow('REPORT TYPE', 'Video-based vital signs screening', page.margin + 5, y + 8, detailW);
  addInfoRow('SESSION STATUS', safe(results.status, 'Completed'), page.margin + 7 + detailW, y + 8, detailW);
  addInfoRow('CLINICAL USE', 'Screening support only', page.margin + 9 + detailW * 2, y + 8, detailW);

  y += 38;

  // Disclaimer
  ensureSpace(30);

  doc.setFillColor(255, 247, 237);
  doc.roundedRect(page.margin, y, page.width - page.margin * 2, 24, 2, 2, 'F');

  doc.setDrawColor(...colors.amber);
  doc.setLineWidth(0.4);
  doc.roundedRect(page.margin, y, page.width - page.margin * 2, 24, 2, 2, 'S');

  addText('Medical Disclaimer', page.margin + 5, y + 8, {
    size: 9,
    color: colors.amber,
    style: 'bold',
  });

  addText(
    'These readings are indicative only and are not a substitute for clinical examination, certified medical devices, diagnosis, or treatment. Please consult a qualified healthcare professional before making medical decisions.',
    page.margin + 5,
    y + 14,
    {
      size: 8,
      color: colors.text,
      maxWidth: page.width - page.margin * 2 - 10,
    }
  );

  y += 36;

  // Vital Signs
  addSectionTitle('Vital Signs Summary');

  const baseConfidence = clamp(results.confidence || 70);

  const metrics = [
    {
      label: 'Heart Rate',
      value: safe(results.hr, '--'),
      unit: 'bpm',
      confidence: baseConfidence,
      color: colors.teal,
    },
    {
      label: 'SpO2 Estimate',
      value: safe(results.spo2, '--'),
      unit: '%',
      confidence: baseConfidence - 5,
      color: colors.blue,
    },
    {
      label: 'Temperature Proxy',
      value: safe(results.temp?.label, '--'),
      unit: '',
      confidence: 60,
      color: colors.amber,
    },
    {
      label: 'Stress Level',
      value: safe(results.stress?.level, '--'),
      unit: '',
      confidence: baseConfidence - 10,
      color: colors.purple,
    },
  ];

  const cardGap = 8;
  const cardW = (page.width - page.margin * 2 - cardGap) / 2;
  const cardH = 40;

  metrics.forEach((metric, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = page.margin + col * (cardW + cardGap);
    const yy = y + row * (cardH + 8);

    drawMetricCard(metric, x, yy, cardW, cardH);
  });

  y += cardH * 2 + 20;

  // Alerts
  if (Array.isArray(results.alerts) && results.alerts.length > 0) {
    addSectionTitle('Clinical Alerts');

    results.alerts.forEach((alert) => {
      ensureSpace(18);

      const severity = String(alert.severity || 'info').toLowerCase();

      const color =
        severity === 'critical'
          ? colors.red
          : severity === 'warning'
            ? colors.amber
            : colors.blue;

      doc.setFillColor(...colors.white);
      doc.roundedRect(page.margin, y, page.width - page.margin * 2, 14, 2, 2, 'F');

      doc.setDrawColor(...colors.border);
      doc.roundedRect(page.margin, y, page.width - page.margin * 2, 14, 2, 2, 'S');

      doc.setFillColor(...color);
      doc.roundedRect(page.margin, y, 3, 14, 2, 2, 'F');

      addText(severity.toUpperCase(), page.margin + 7, y + 8.5, {
        size: 7,
        color,
        style: 'bold',
      });

      addText(safe(alert.msg, 'Alert message unavailable'), page.margin + 32, y + 8.5, {
        size: 8,
        color: colors.text,
        maxWidth: 105,
      });

      addText(safe(alert.time, ''), page.width - page.margin - 4, y + 8.5, {
        size: 7,
        color: colors.muted,
        align: 'right',
      });

      y += 18;
    });

    y += 4;
  }

  // Emotion Distribution
  if (results.emotionDistrib && typeof results.emotionDistrib === 'object') {
    addSectionTitle('Emotion Distribution');

    const emotions = Object.entries(results.emotionDistrib)
      .map(([emotion, percentage]) => [emotion, clamp(percentage)])
      .sort((a, b) => b[1] - a[1]);

    emotions.forEach(([emotion, percentage]) => {
      ensureSpace(12);

      const label = emotion.charAt(0).toUpperCase() + emotion.slice(1);
      const barX = page.margin + 42;
      const barW = page.width - page.margin * 2 - 58;

      addText(label, page.margin, y + 5, {
        size: 8,
        color: colors.text,
      });

      doc.setFillColor(229, 231, 235);
      doc.roundedRect(barX, y, barW, 6, 2, 2, 'F');

      doc.setFillColor(...colors.teal);
      if (percentage > 0) {
        doc.roundedRect(barX, y, barW * (percentage / 100), 6, 2, 2, 'F');
      }

      addText(`${percentage}%`, page.width - page.margin, y + 5, {
        size: 8,
        color: colors.muted,
        align: 'right',
      });

      y += 10;
    });

    y += 4;
  }

  // Notes
  ensureSpace(34);
  addSectionTitle('Interpretation Notes');

  const notes = [
    'Values are derived from video-based signal estimation and may vary with lighting, movement, camera quality, and facial visibility.',
    'SpO2 and temperature proxy values are estimates and should not be treated as certified clinical measurements.',
    'Abnormal or concerning readings should be verified using approved medical equipment.',
  ];

  notes.forEach((note) => {
    ensureSpace(10);
    doc.setFillColor(...colors.blue);
    doc.circle(page.margin + 2, y + 2.5, 1, 'F');

    addText(note, page.margin + 7, y + 4, {
      size: 8,
      color: colors.text,
      maxWidth: page.width - page.margin * 2 - 8,
    });

    y += 9;
  });

  addFooter();

  doc.save(`VitalVision_Report_${fileDate}.pdf`);
}