import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Output } from "@bitauth/libauth";
import JsPDF from "jspdf";
import { DateTime } from "luxon";

import LogService from "@/kernel/app/LogService";
import TransactionManagerService, {
  TransactionEntity,
} from "@/kernel/bch/TransactionManagerService";

import { binToHex } from "@/util/hex";

import common from "@/translations/common";
import { translate } from "@/util/translations";

const Log = LogService("TransactionExport");

/**
 * Formats satoshis to BCH
 */
function formatBch(satoshis: number): string {
  return (satoshis / 100000000).toFixed(8);
}

const getNftIdentifier = (tokenLabel: string, categoryId: string) =>
  tokenLabel === categoryId ? tokenLabel : `${tokenLabel} (${categoryId})`;

/**
 * Escapes CSV field value
 */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports transaction history as CSV
 * @param transactions Array of transaction data prepared for export
 * @param filename Base filename without extension
 */
export async function exportHistoryAsCsv(
  transactions: TransactionData[],
  filename: string = "transaction-history"
): Promise<void> {
  try {
    // CSV headers
    const headers = [
      "Date",
      "Transaction ID",
      "Status",
      "Confirmations",
      "Height",
      "Memo",
      "Total Input (BCH)",
      "Total Output (BCH)",
      "Net Amount (BCH)",
    ];

    // Build CSV rows
    const rows = transactions.map((tx) => {
      const totalInput = tx.vin.reduce((sum, input) => {
        const value = input.value ? BigInt(input.value) : 0n;
        return sum + value;
      }, 0n);

      const totalOutput = tx.vout.reduce((sum, output) => {
        let value = 0n;
        if (typeof output.value === "string") {
          value = BigInt(output.value);
        } else if (output.valueSatoshis !== undefined) {
          value = BigInt(output.valueSatoshis);
        }
        return sum + value;
      }, 0n);

      const netAmount =
        tx.walletAmount !== undefined
          ? tx.walletAmount
          : totalOutput - totalInput;

      const status = tx.blockhash ? "Confirmed" : "Pending";

      return [
        escapeCsvField(tx.date),
        escapeCsvField(tx.tx_hash),
        escapeCsvField(status),
        escapeCsvField(tx.confirmations),
        escapeCsvField(tx.height),
        escapeCsvField(tx.memo || ""),
        escapeCsvField(formatBch(Number(totalInput))),
        escapeCsvField(formatBch(Number(totalOutput))),
        escapeCsvField(formatBch(Number(netAmount))),
      ].join(",");
    });

    // Combine headers and rows
    const csvContent = [headers.join(","), ...rows].join("\n");

    // Create blob and download
    if (Capacitor.isNativePlatform()) {
      const base64Data = btoa(unescape(encodeURIComponent(csvContent)));
      const fileName = `${filename}.csv`;

      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
      });

      await Share.share({
        title: "Transaction History",
        text: translate(common.exportedAsCsv),
        url: result.uri,
        dialogTitle: "Share Transaction History",
      });
    } else {
      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    // eslint-disable-next-line
    console.error("Error exporting as CSV:", error);
    throw new Error("Failed to export transaction history as CSV");
  }
}

/**
 * Prepares transaction data for export by resolving input values
 */
export async function prepareTransactionExportData(
  tx: TransactionEntity & { time_seen: string },
  chaintip: { height: number },
  memo?: string,
  walletHash?: string,
  walletAmount?: bigint
): Promise<TransactionData> {
  const isConfirmed = tx.blockhash !== null;
  const confirmations = isConfirmed ? chaintip.height - tx.height : 0;
  const txDate = (
    isConfirmed ? DateTime.fromSeconds(tx.time) : DateTime.fromISO(tx.time_seen)
  ).toLocaleString(DateTime.DATETIME_FULL);

  // Resolve input values from previous transactions
  const resolvedVin = await Promise.all(
    tx.vin.map(async (input) => {
      const resolvedTx = await TransactionManagerService().resolveTransaction(
        input.tx_hash
      );
      const output = resolvedTx.vout.find((out) => out.n === input.vout);
      return {
        ...input,
        value: output?.valueSatoshis?.toString(),
        address: output?.scriptPubKey?.addresses?.[0],
      };
    })
  );

  let voutWithTokens = tx.vout;
  if (walletHash) {
    const TokenManagerService = (
      await import("@/kernel/wallet/TokenManagerService")
    ).default;
    const TokenManager = TokenManagerService(walletHash);

    voutWithTokens = tx.vout.map((output) => {
      if (output.token) {
        try {
          const categoryHex = binToHex(output.token.category);
          const tokenInfo = TokenManager.getToken(categoryHex);
          return {
            ...output,
            token: {
              ...output.token,
              symbol: tokenInfo.symbol,
              name: tokenInfo.name,
              color: tokenInfo.color || `#${categoryHex.slice(0, 6)}`,
            },
          };
        } catch (error) {
          // If token info not found, use default color from category
          const categoryHex = binToHex(output.token.category);
          return {
            ...output,
            token: {
              ...output.token,
              color: `#${categoryHex.slice(0, 6)}`,
            },
          };
        }
      }
      return output;
    });
  }

  return {
    tx_hash: tx.tx_hash,
    blockhash: tx.blockhash,
    height: tx.height,
    time: tx.time,
    time_seen: tx.time_seen,
    confirmations,
    memo,
    date: txDate,
    vout: voutWithTokens,
    vin: resolvedVin,
    walletAmount,
  };
}

interface TransactionData {
  tx_hash: string;
  blockhash: string | null;
  height: number;
  time: number;
  time_seen: string;
  confirmations: number;
  memo?: string;
  date: string;
  vout: Array<{
    n: number;
    value?: string;
    valueSatoshis?: bigint;
    scriptPubKey: {
      addresses?: string[] | undefined;
      asm: string;
    };
    token?: {
      amount: bigint;
      category: Uint8Array;
      symbol?: string;
      name?: string;
      color?: string;
      nft?: NonNullable<Output["token"]>["nft"];
    };
  }>;
  vin: Array<{
    tx_hash: string;
    vout: number;
    value?: string;
    address?: string;
  }>;
  walletAmount?: bigint;
}

/**
 * Service for exporting transaction details as PDF or PNG programmatically
 */
class TransactionExportService {
  private logoDataUrl: string | null = null;
  private fontBase64: string | null = null;

  // Color palette from Tailwind config
  private readonly _colors = {
    black: { r: 0, g: 0, b: 0 },
    neutral400: { r: 104, g: 103, b: 96 }, // Slated gray for labels
    white: { r: 255, g: 255, b: 255 },
  };

  /**
   * Loads the logo and converts SVG to PNG data URL for embedding
   */
  private async _loadLogo(): Promise<string> {
    if (this.logoDataUrl) {
      return this.logoDataUrl;
    }

    try {
      const response = await fetch("/src/assets/selene-logo.svg");
      const svgText = await response.text();

      // Create an image element and load the SVG
      const img = new Image();
      const svgBlob = new Blob([svgText], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      return await new Promise((resolve, reject) => {
        img.onload = () => {
          // Create canvas and draw the SVG
          const canvas = document.createElement("canvas");
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error("Could not create canvas context"));
            return;
          }

          ctx.drawImage(img, 0, 0, 200, 200);
          URL.revokeObjectURL(url);

          // Convert to PNG data URL
          this.logoDataUrl = canvas.toDataURL("image/png");
          resolve(this.logoDataUrl);
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load SVG image"));
        };

        img.src = url;
      });
    } catch (error) {
      return "";
    }
  }

  /**
   * Loads the Chivo Mono font as base64 for embedding in PDF
   */
  private async _loadFont(): Promise<string> {
    if (this.fontBase64) {
      return this.fontBase64;
    }

    try {
      const response = await fetch(
        "/src/assets/ChivoMono-VariableFont_wght.ttf"
      );
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      this.fontBase64 = btoa(binary);
      return this.fontBase64;
    } catch (error) {
      Log.error("Failed to load Chivo Mono font:", error);
      return "";
    }
  }

  /**
   * Creates a jsPDF document with transaction content
   */
  private async _createPdfDocument(
    transactionData: TransactionData
  ): Promise<JsPDF> {
    const pdf = new JsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Use Tailwind colors
    const labelColor = this._colors.neutral400;
    const valueColor = this._colors.black;

    // Load logo and font
    const logoDataUrl = await this._loadLogo();
    const fontBase64 = await this._loadFont();

    // Add custom font to PDF
    if (fontBase64) {
      try {
        pdf.addFileToVFS("ChivoMono.ttf", fontBase64);
        pdf.addFont("ChivoMono.ttf", "ChivoMono", "normal");
      } catch (error) {
        Log.error("Failed to add Chivo Mono font to PDF:", error);
      }
    }

    const checkPageBreak = (neededSpace: number) => {
      if (yPosition + neededSpace > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Add logo if available
    if (logoDataUrl) {
      try {
        pdf.addImage(logoDataUrl, "PNG", margin, yPosition, 12, 12);
        yPosition += 24;
      } catch (error) {
        Log.error("Failed to add logo to PDF:", error);
      }
    }

    // Header - TRANSACTION STATEMENT
    pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
    pdf.setFontSize(24);
    pdf.setFont("ChivoMono");
    pdf.text("TRANSACTION STATEMENT", margin, yPosition);

    yPosition += 10;

    // Generated at date/time
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toISOString().split("T")[1].split(".")[0];
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.setFontSize(9);
    pdf.setFont("ChivoMono", "normal");
    pdf.text(`Generated at ${dateStr} ${timeStr} UTC`, margin, yPosition);

    yPosition += 15;

    // Table-like section with transaction details
    const addRow = (label: string, value: string, wrap: boolean = false) => {
      pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
      pdf.setFontSize(9);
      pdf.setFont("ChivoMono", "normal");
      pdf.text(label, margin, yPosition);

      pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      pdf.setFont("ChivoMono", "normal");

      if (wrap) {
        // Wrap long text for transaction IDs
        const maxWidth = contentWidth - 60;
        const lines = pdf.splitTextToSize(value, maxWidth);
        pdf.text(lines, margin + 60, yPosition);
        yPosition += 6 * lines.length;
      } else {
        pdf.text(value, margin + 60, yPosition);
        yPosition += 6;
      }
    };

    addRow("Transaction ID", transactionData.tx_hash, true);
    addRow("Date & Time", transactionData.date);

    const statusText = transactionData.blockhash
      ? `Confirmed in block #${transactionData.height} (${transactionData.confirmations} confirmations)`
      : translate(common.pendingConfirmation);
    addRow("Status", statusText);

    yPosition += 10;
    checkPageBreak(40);

    // Outputs Section
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.setFontSize(11);
    pdf.setFont("ChivoMono");
    pdf.text("OUTPUTS", margin, yPosition);
    yPosition += 8;

    // Outputs table header
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.setFontSize(8);
    pdf.setFont("ChivoMono", "normal");
    pdf.text("#", margin, yPosition);
    pdf.text("Address", margin + 10, yPosition);
    const outputAmountHeader = "Amount (BCH)";
    const outputAmountHeaderWidth = pdf.getTextWidth(outputAmountHeader);
    pdf.text(
      outputAmountHeader,
      pageWidth - margin - outputAmountHeaderWidth,
      yPosition
    );
    yPosition += 2;

    // Header separator
    pdf.setDrawColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.setLineWidth(0.1);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    // Outputs data
    transactionData.vout.forEach((output, i) => {
      checkPageBreak(12);

      pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      pdf.setFont("ChivoMono", "normal");
      pdf.setFontSize(8);
      pdf.text(`${output.n}`, margin, yPosition);

      const asmParts = output.scriptPubKey.asm.split(" ");
      const isOpReturn = asmParts[0] === "OP_RETURN";

      if (isOpReturn) {
        pdf.text("OP_RETURN", margin + 10, yPosition);
      } else if (
        output.scriptPubKey.addresses &&
        output.scriptPubKey.addresses[0]
      ) {
        pdf.text(output.scriptPubKey.addresses[0], margin + 10, yPosition);
      }

      const outputAmount = formatBch(
        Number(output.valueSatoshis || output.value || 0)
      );
      const outputAmountWidth = pdf.getTextWidth(outputAmount);
      pdf.text(outputAmount, pageWidth - margin - outputAmountWidth, yPosition);

      yPosition += 3;

      if (output.token) {
        pdf.setFontSize(7);

        let tokenColor = labelColor;
        const categoryHex = binToHex(output.token.category);
        const categoryId = categoryHex.slice(0, 6);

        if (output.token.color) {
          const hex = output.token.color.replace("#", "");
          tokenColor = {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16),
          };
        }

        pdf.setTextColor(tokenColor.r, tokenColor.g, tokenColor.b);
        const tokenLabel = output.token.symbol || output.token.name || "Token";

        Log.log("output", output.token);

        const isNft = output.token.nft;
        if (isNft) {
          const identifier = getNftIdentifier(tokenLabel, categoryId);
          pdf.text(`${identifier}: NFT`, margin + 10, yPosition);
        } else {
          pdf.text(
            `${tokenLabel} (${categoryId}): ${output.token.amount}`,
            margin + 10,
            yPosition
          );
        }
        yPosition += 4;
      }

      // Horizontal border between items
      if (i < transactionData.vout.length - 1) {
        pdf.setDrawColor(labelColor.r, labelColor.g, labelColor.b);
        pdf.setLineWidth(0.1);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      }
    });

    yPosition += 10;
    checkPageBreak(40);

    // Inputs Section
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.setFontSize(11);
    pdf.setFont("ChivoMono");
    pdf.text("INPUTS", margin, yPosition);
    yPosition += 8;

    // Inputs table header
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.setFontSize(8);
    pdf.setFont("ChivoMono", "normal");
    pdf.text("#", margin, yPosition);
    pdf.text("Address", margin + 10, yPosition);
    const amountHeader = "Amount (BCH)";
    const amountHeaderWidth = pdf.getTextWidth(amountHeader);
    pdf.text(amountHeader, pageWidth - margin - amountHeaderWidth, yPosition);
    yPosition += 2;

    // Header separator
    pdf.setDrawColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.setLineWidth(0.1);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    // Inputs data
    pdf.setFont("ChivoMono", "normal");
    transactionData.vin.forEach((input, i) => {
      checkPageBreak(8);

      pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      pdf.text(`${i}`, margin, yPosition);

      // Display address if available, otherwise show source transaction reference
      const address = input.address || `${input.tx_hash}:${input.vout}`;
      pdf.text(address, margin + 10, yPosition);

      const amount = input.value
        ? formatBch(parseFloat(input.value))
        : "Unknown";
      const amountWidth = pdf.getTextWidth(amount);
      pdf.text(amount, pageWidth - margin - amountWidth, yPosition);

      yPosition += 3;

      // Horizontal border between items
      if (i < transactionData.vin.length - 1) {
        pdf.setDrawColor(labelColor.r, labelColor.g, labelColor.b);
        pdf.setLineWidth(0.1);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 5;
      }
    });

    // Footer
    const footerY = pageHeight - 15;
    pdf.setFontSize(7);
    pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    pdf.setFont("ChivoMono", "normal");
    pdf.text(translate(common.autoGeneratedStatement), pageWidth / 2, footerY, {
      align: "center",
    });
    pdf.text(
      `Document generated on ${new Date().toLocaleString()}`,
      pageWidth / 2,
      footerY + 4,
      { align: "center" }
    );

    return pdf;
  }

  /**
   * Exports transaction as PDF with actual text (not bitmap)
   */
  async exportAsPDF(
    transactionData: TransactionData,
    filename: string = "transaction"
  ): Promise<void> {
    try {
      const pdf = await this._createPdfDocument(transactionData);

      // Save or share
      if (Capacitor.isNativePlatform()) {
        const pdfOutput = pdf.output("datauristring");
        const base64Data = pdfOutput.split(",")[1];
        const fileName = `${filename}.pdf`;

        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
        });

        await Share.share({
          title: "Transaction Statement",
          text: translate(common.exportedAsPdf),
          url: result.uri,
          dialogTitle: "Share Transaction",
        });
      } else {
        pdf.save(`${filename}.pdf`);
      }
    } catch (error) {
      Log.error("Error exporting as PDF:", error);
      throw new Error("Failed to export transaction as PDF");
    }
  }

  /**
   * Exports transaction as PNG by rendering directly to canvas
   */
  async exportAsPNG(
    transactionData: TransactionData,
    filename: string = "transaction"
  ): Promise<void> {
    try {
      // Create a canvas to render the document
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not create canvas context");
      }

      // Set canvas size for receipt-style narrow width (3x for quality)
      // Height is calculated dynamically based on content
      const scale = 3;
      const pageWidth = 80; // Receipt width in mm (narrow like thermal printer)
      const mmToPx = 3.7795275591; // 96 DPI conversion

      // Estimate height based on content - more per item for narrow layout with wrapping
      const baseHeight = 100; // Base height for header and details
      const inputHeight = transactionData.vin.length * 25; // More height per input for address wrapping
      const outputHeight = transactionData.vout.length * 25; // More height per output for address wrapping
      const estimatedHeight = baseHeight + inputHeight + outputHeight + 40; // Add padding for footer

      canvas.width = pageWidth * mmToPx * scale;
      canvas.height = estimatedHeight * mmToPx * scale;

      // Scale context for high DPI
      ctx.scale(scale, scale);

      // Fill with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render the content using the same logic as PDF
      const margin = 8 * mmToPx; // Smaller margins for receipt
      let yPosition = margin;

      const labelColor = `rgb(${this._colors.neutral400.r}, ${this._colors.neutral400.g}, ${this._colors.neutral400.b})`;
      const valueColor = `rgb(${this._colors.black.r}, ${this._colors.black.g}, ${this._colors.black.b})`;

      // Load logo and font (we'll just use monospace for canvas)
      const logoDataUrl = await this._loadLogo();

      // Add logo if available - centered
      if (logoDataUrl) {
        try {
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = logoDataUrl;
          });
          const logoSize = 12 * mmToPx;
          ctx.drawImage(
            img,
            (pageWidth * mmToPx) / 2 - logoSize / 2,
            yPosition,
            logoSize,
            logoSize
          );
          yPosition += 18 * mmToPx;
        } catch (error) {
          Log.error("Failed to add logo to PNG:", error);
        }
      }

      // Set font - smaller for narrow receipt
      ctx.font = "bold 14px 'Chivo Mono', monospace";
      ctx.fillStyle = valueColor;
      ctx.textAlign = "center";
      ctx.fillText("TRANSACTION", (pageWidth * mmToPx) / 2, yPosition);
      yPosition += 5 * mmToPx;
      ctx.fillText("STATEMENT", (pageWidth * mmToPx) / 2, yPosition);
      ctx.textAlign = "left";
      yPosition += 8 * mmToPx;

      // Generated at date/time
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toISOString().split("T")[1].split(".")[0];
      ctx.font = "8px 'Chivo Mono', monospace";
      ctx.fillStyle = labelColor;
      ctx.textAlign = "center";
      ctx.fillText(`Generated at`, (pageWidth * mmToPx) / 2, yPosition);
      yPosition += 4 * mmToPx;
      ctx.fillText(
        `${dateStr} ${timeStr} UTC`,
        (pageWidth * mmToPx) / 2,
        yPosition
      );
      ctx.textAlign = "left";
      yPosition += 10 * mmToPx;

      // Transaction details - stacked layout for narrow width
      ctx.font = "8px 'Chivo Mono', monospace";
      const addRow = (label: string, value: string, wrap: boolean = false) => {
        ctx.fillStyle = labelColor;
        ctx.fillText(label, margin, yPosition);
        yPosition += 3 * mmToPx;
        ctx.fillStyle = valueColor;

        if (wrap && value.length > 32) {
          // Wrap long text (like transaction IDs)
          const maxWidth = pageWidth * mmToPx - 2 * margin;
          const chars = value.split("");
          let line = "";

          for (let i = 0; i < chars.length; i += 1) {
            const testLine = line + chars[i];
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && line.length > 0) {
              ctx.fillText(line, margin, yPosition);
              yPosition += 3 * mmToPx;
              line = chars[i];
            } else {
              line = testLine;
            }
          }
          if (line.length > 0) {
            ctx.fillText(line, margin, yPosition);
            yPosition += 5 * mmToPx;
          }
        } else {
          ctx.fillText(value, margin, yPosition);
          yPosition += 5 * mmToPx;
        }
      };

      addRow("Transaction ID", transactionData.tx_hash, true);
      addRow("Date & Time", transactionData.date);
      const statusText = transactionData.blockhash
        ? `Block #${transactionData.height} (${transactionData.confirmations} conf.)`
        : translate(common.pendingConfirmation);
      addRow("Status", statusText);

      yPosition += 10 * mmToPx;

      // OUTPUTS Section
      ctx.font = "bold 10px 'Chivo Mono', monospace";
      ctx.fillStyle = valueColor;
      ctx.textAlign = "center";
      ctx.fillText("OUTPUTS", (pageWidth * mmToPx) / 2, yPosition);
      ctx.textAlign = "left";
      yPosition += 5 * mmToPx;

      // Header separator
      ctx.strokeStyle = labelColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(margin, yPosition);
      ctx.lineTo(pageWidth * mmToPx - margin, yPosition);
      ctx.stroke();
      yPosition += 4 * mmToPx;

      // Outputs data - stacked layout
      ctx.font = "7px 'Chivo Mono', monospace";
      transactionData.vout.forEach((output, i) => {
        ctx.fillStyle = labelColor;
        ctx.fillText(`#${output.n}`, margin, yPosition);
        yPosition += 3 * mmToPx;

        ctx.fillStyle = valueColor;
        const asmParts = output.scriptPubKey.asm.split(" ");
        const isOpReturn = asmParts[0] === "OP_RETURN";

        if (isOpReturn) {
          ctx.fillText("OP_RETURN", margin, yPosition);
          yPosition += 3 * mmToPx;
        } else if (
          output.scriptPubKey.addresses &&
          output.scriptPubKey.addresses[0]
        ) {
          const outputAddress = output.scriptPubKey.addresses[0];

          // Wrap long addresses
          const maxWidth = pageWidth * mmToPx - 2 * margin;
          const chars = outputAddress.split("");
          let line = "";

          for (let j = 0; j < chars.length; j += 1) {
            const testLine = line + chars[j];
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && line.length > 0) {
              ctx.fillText(line, margin, yPosition);
              yPosition += 3 * mmToPx;
              line = chars[j];
            } else {
              line = testLine;
            }
          }
          if (line.length > 0) {
            ctx.fillText(line, margin, yPosition);
            yPosition += 3 * mmToPx;
          }
        }

        const amount = formatBch(
          Number(output.valueSatoshis || output.value || 0)
        );
        ctx.fillText(`${amount} BCH`, margin, yPosition);
        yPosition += 3 * mmToPx;

        if (output.token) {
          ctx.font = "6px 'Chivo Mono', monospace";

          ctx.fillStyle = output.token.color || labelColor;

          const categoryHex = binToHex(output.token.category);
          const categoryId = categoryHex.slice(0, 6);
          const tokenLabel =
            output.token.symbol || output.token.name || "Token";

          const isNft = output.token.nft;
          if (isNft) {
            const identifier = getNftIdentifier(tokenLabel, categoryId);
            ctx.fillText(`${identifier}: NFT`, margin, yPosition);
          } else {
            ctx.fillText(
              `${tokenLabel} (${categoryId}): ${output.token.amount}`,
              margin,
              yPosition
            );
          }
          ctx.font = "7px 'Chivo Mono', monospace";
          yPosition += 3 * mmToPx;
        }

        yPosition += 1 * mmToPx;

        // Horizontal border between items
        if (i < transactionData.vout.length - 1) {
          ctx.strokeStyle = labelColor;
          ctx.lineWidth = 0.2;
          ctx.beginPath();
          ctx.moveTo(margin, yPosition);
          ctx.lineTo(pageWidth * mmToPx - margin, yPosition);
          ctx.stroke();
          yPosition += 3 * mmToPx;
        }
      });

      yPosition += 10 * mmToPx;

      // INPUTS Section
      ctx.font = "bold 10px 'Chivo Mono', monospace";
      ctx.fillStyle = valueColor;
      ctx.textAlign = "center";
      ctx.fillText("INPUTS", (pageWidth * mmToPx) / 2, yPosition);
      ctx.textAlign = "left";
      yPosition += 5 * mmToPx;

      // Header separator
      ctx.strokeStyle = labelColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(margin, yPosition);
      ctx.lineTo(pageWidth * mmToPx - margin, yPosition);
      ctx.stroke();
      yPosition += 4 * mmToPx;

      // Inputs data - stacked layout
      ctx.font = "7px 'Chivo Mono', monospace";
      transactionData.vin.forEach((input, i) => {
        ctx.fillStyle = labelColor;
        ctx.fillText(`#${i}`, margin, yPosition);
        yPosition += 3 * mmToPx;

        ctx.fillStyle = valueColor;
        const address = input.address || `${input.tx_hash}:${input.vout}`;

        // Wrap long addresses
        const maxWidth = pageWidth * mmToPx - 2 * margin;
        const chars = address.split("");
        let line = "";

        for (let j = 0; j < chars.length; j += 1) {
          const testLine = line + chars[j];
          const metrics = ctx.measureText(testLine);

          if (metrics.width > maxWidth && line.length > 0) {
            ctx.fillText(line, margin, yPosition);
            yPosition += 3 * mmToPx;
            line = chars[j];
          } else {
            line = testLine;
          }
        }
        if (line.length > 0) {
          ctx.fillText(line, margin, yPosition);
          yPosition += 3 * mmToPx;
        }

        const amount = input.value
          ? formatBch(parseFloat(input.value))
          : "Unknown";
        ctx.fillText(`${amount} BCH`, margin, yPosition);
        yPosition += 4 * mmToPx;

        // Horizontal border between items
        if (i < transactionData.vin.length - 1) {
          ctx.strokeStyle = labelColor;
          ctx.lineWidth = 0.2;
          ctx.beginPath();
          ctx.moveTo(margin, yPosition);
          ctx.lineTo(pageWidth * mmToPx - margin, yPosition);
          ctx.stroke();
          yPosition += 3 * mmToPx;
        }
      });

      yPosition += 10 * mmToPx;

      // Footer
      ctx.font = "6px 'Chivo Mono', monospace";
      ctx.fillStyle = labelColor;
      ctx.textAlign = "center";
      ctx.fillText(
        translate(common.automaticallyGenerated),
        (pageWidth * mmToPx) / 2,
        yPosition
      );
      yPosition += 3 * mmToPx;
      ctx.fillText(
        "transaction statement",
        (pageWidth * mmToPx) / 2,
        yPosition
      );
      yPosition += 3 * mmToPx;
      ctx.fillText(
        "Bitcoin Cash blockchain",
        (pageWidth * mmToPx) / 2,
        yPosition
      );
      yPosition += 4 * mmToPx;
      ctx.fillText(
        `${new Date().toLocaleString()}`,
        (pageWidth * mmToPx) / 2,
        yPosition
      );
      ctx.textAlign = "left";

      // Convert canvas to PNG
      const dataUrl = canvas.toDataURL("image/png");

      if (Capacitor.isNativePlatform()) {
        const base64Data = dataUrl.split(",")[1];
        const fileName = `${filename}.png`;

        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
        });

        await Share.share({
          title: "Transaction Statement",
          text: translate(common.exportedAsPng),
          url: result.uri,
          dialogTitle: "Share Transaction",
        });
      } else {
        // Download file
        const link = document.createElement("a");
        link.download = `${filename}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      Log.error("Error exporting as PNG:", error);
      throw new Error("Failed to export transaction as PNG");
    }
  }
}

export default new TransactionExportService();
