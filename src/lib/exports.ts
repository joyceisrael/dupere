// Helpers d'export PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToPdf(
  filename: string,
  title: string,
  sections: { heading: string; head: string[]; body: (string | number)[][] }[]
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setTextColor(255, 122, 0);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Les Rachetés du Père · ${new Date().toLocaleDateString("fr-FR")}`, 14, 25);

  let y = 32;
  sections.forEach((s, i) => {
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(s.heading, 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [s.head],
      body: s.body.length ? s.body : [["—"].concat(Array(s.head.length - 1).fill(""))],
      theme: "striped",
      headStyles: { fillColor: [255, 122, 0] },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 260 && i < sections.length - 1) { doc.addPage(); y = 20; }
  });

  doc.save(`${filename}.pdf`);
}
