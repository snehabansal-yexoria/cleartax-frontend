"use client";

/**
 * Download a built report as an A4 PDF.
 *
 * The report element is cloned into a detached stage that always uses the
 * light theme, so the PDF is the desktop layout on white whatever the screen
 * is (a phone, dark mode, the Graph view selected) — the stage's CSS shows the
 * chart and the month table together. The stage is never put in the page or
 * given a width: html2pdf.js clones it into its own invisible container, one
 * A4 printable width wide, and captures that container (see .cp-pdf-stage).
 * html2pdf.js is loaded only when someone downloads, so it never weighs on
 * the page.
 *
 * The PDF is an image of the report (html2canvas), so its text is not
 * selectable. If the library fails to load or render, the browser's print
 * dialog is the fallback; the print stylesheet lays the report out for A4 too.
 */
export async function downloadReportPdf(doc: HTMLElement, fileName: string): Promise<void> {
  const stage = document.createElement("div");
  stage.className = "cp-report cp-force-light cp-pdf-stage";
  stage.setAttribute("aria-hidden", "true");
  stage.appendChild(doc.cloneNode(true));

  try {
    const { default: html2pdf } = await import("html2pdf.js");
    const worker = html2pdf();
    // `pagebreak` is supported by html2pdf.js but missing from its typings.
    const options = {
      margin: [8, 8, 10, 8],
      filename: fileName,
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 1024, backgroundColor: "#F3F4FA" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: [".cp-sec", ".cp-kpis", ".cp-rhead", "tr", ".cp-explain"],
      },
    } as Parameters<typeof worker.set>[0];
    await worker.set(options).from(stage).save();
  } catch {
    window.print();
  }
}

/** "ClearPortfolio_Profit-and-Loss_Johnson-Family-Trust_FY2025-26.pdf" */
export function reportFileName(stem: string, scopeName: string, fyLabel: string): string {
  const part = (scopeName || "All-entities").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `ClearPortfolio_${stem}_${part || "Report"}_${fyLabel.replace(/\s+/g, "")}.pdf`;
}
