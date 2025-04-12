import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const ExcelToFormattedPDF = () => {
  const [excelData, setExcelData] = useState([]);
  const [fileName, setFileName] = useState("");
  const [pdfSize, setPdfSize] = useState("a4"); // Default size
  const [customWidth, setCustomWidth] = useState(300);
  const [customHeight, setCustomHeight] = useState(300);
  const [tempWidth, setTempWidth] = useState(customWidth);
  const [tempHeight, setTempHeight] = useState(customHeight);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [numPages, setNumPages] = useState(0);

  // Standard page sizes
  const pageSizes = {
    a4: [210, 297],
    a3: [297, 420],
    letter: [216, 279],
    custom: [customWidth, customHeight],
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0]; // Read first sheet
      const sheet = workbook.Sheets[sheetName];

      const parsedData = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      if (parsedData.length > 0) {
        setExcelData(parsedData);
      } else {
        alert("No data found in the Excel file.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const generatePDF = () => {
    if (excelData.length === 0) {
      alert("Please upload an Excel file first.");
      return;
    }

    // Determine selected page size
    let [pageWidth, pageHeight] = pageSizes[pdfSize];

    const headers = excelData[0];
    const body = excelData.slice(1);
    const columnCount = headers.length;

    // Switch to landscape if columns > 6
    const orientation = columnCount > 6 ? "landscape" : "portrait";
    if (orientation === "landscape") {
      [pageWidth, pageHeight] = [pageHeight, pageWidth]; // Swap dimensions
    }

    // Step 1: Calculate column widths
    let columnWidths = headers.map((_, colIndex) => {
      const maxLength = Math.max(
        headers[colIndex]?.toString().length || 0,
        ...body.map((row) =>
          row[colIndex] ? row[colIndex].toString().length : 0
        )
      );

      // Convert max length to approximate width in mm (1 char ≈ 2.5 mm)
      return Math.min(maxLength * 2.5, 40); // Cap max width at 40mm per column
    });

    // Step 2: Scale column widths if they exceed page width
    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const availableWidth = pageWidth - 20; // Account for margins

    if (totalWidth > availableWidth) {
      const scaleFactor = availableWidth / totalWidth;
      columnWidths = columnWidths.map((width) => width * scaleFactor);
    }

    // Step 3: Generate columnStyles dynamically
    const columnStyles = {};
    columnWidths.forEach((width, index) => {
      columnStyles[index] = { cellWidth: width };
    });

    // Step 4: Generate PDF
    const doc = new jsPDF({
      orientation,
      unit: "mm",
      format: [pageWidth, pageHeight],
    });

    // Invoice Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("INVOICE", pageWidth / 2 - 10, 15);
    // setNumPages(doc.getNumberOfPages());

    // Generate Table
   try{
    autoTable(doc, {
      head: [headers],
      body: body,
      startY: 25,
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fillColor: [52, 152, 219], textColor: 255 },
      columnStyles: columnStyles,
      pageBreak: 'auto',
    });
   }catch(error){
    alert("PDF generation failed. Consider increasing the height or width.");
    return; 
   }

    // Generate PDF Blob for Preview
    const pdfBlob = doc.output("blob");
    setPdfBlob(URL.createObjectURL(pdfBlob));
    
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (tempWidth > 100 && tempHeight > 100) {
        setCustomWidth(tempWidth);
        setCustomHeight(tempHeight);
      } else {
        alert("Please enter values above 100mm.");
      }
    }
  };
  
  // Re-generate PDF when page size changes
  useEffect(() => {
    if (fileName) generatePDF();
  }, [pdfSize, customWidth, customHeight]);

  return (
    <div className="p-4 flex flex-col items-center">
      <h2 className="text-lg font-bold mb-2">Excel to PDF Converter</h2>

      {/* File Upload */}
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />

      {/* Page Size Selection */}
      <div className="mt-4">
        <label className="mr-2">Select Page Size:</label>
        <select
          value={pdfSize}
          onChange={(e) => setPdfSize(e.target.value)}
          className="p-1 border"
        >
          <option value="a4">A4 (210x297 mm)</option>
          <option value="a3">A3 (297x420 mm)</option>
          <option value="letter">Letter (216x279 mm)</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Custom Size Inputs */}
      {pdfSize === "custom" && (
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            value={tempWidth}
            onChange={(e) => setTempWidth(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            placeholder="Width (mm)"
            className="p-1 border w-20"
            min="1"
          />
          <input
            type="number"
            value={tempHeight}
            onChange={(e) => setTempHeight(Number(e.target.value))}
            onKeyDown={handleKeyDown}

            placeholder="Height (mm)"
            className="p-1 border w-20"
            min="1"

          />
        </div>
      )}

      {/* Generate PDF Button */}
      {fileName && (
        <button
          onClick={generatePDF}
          className="mt-4 p-2 bg-blue-500 text-white rounded"
        >
          Convert {fileName} to PDF
        </button>
      )}

      {/* PDF Preview */}
      {pdfBlob && (
        <div className="mt-6">
          <h3 className="text-md font-bold mb-2">Preview</h3>
          <div className="border p-2">
            <Document file={pdfBlob}
              onLoadSuccess={({numPages}) => {
                setNumPages(numPages)
                console.log(numPages);
              }}

            >
              {[...Array(numPages)].map((_, index) => (
                
                <Page
                  key={index}
                  pageNumber={index + 1}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              ))}
              {/* <Page pageNumber={1} renderTextLayer={false} renderAnnotationLayer={false} /> */}
            </Document>
          </div>
          <button
            onClick={() => {
              if (tempWidth > 100 && tempHeight > 100) {
                setCustomWidth(tempWidth);
                setCustomHeight(tempHeight);
              } else {
                alert("Please enter values above 100mm.");
              }
            }}
            className="p-1 bg-green-500 text-white rounded"
          >
            Set Dimensions
          </button>
        </div>
      )}

      {(fileName && pdfBlob) && (
        <button
          onClick={() => {
            const a = document.createElement("a");
            a.href = pdfBlob;
            a.download = `${fileName}.pdf`;
            a.click();
          }
          }
        >

          Download PDF
        </button>
      )
      }


    </div>
  );
};

export default ExcelToFormattedPDF;
