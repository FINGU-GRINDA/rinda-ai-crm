import * as XLSX from "xlsx"
import logger from "../logger"

/**
 * Extract text from Excel buffer using SheetJS (xlsx)
 * Supports xlsx, xls, and csv formats
 */
export function parseExcel(buffer: Buffer): string {
  const bufferSize = buffer.length
  logger.info({ bufferSize }, "Starting Excel parsing")

  try {
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheetCount = workbook.SheetNames.length
    logger.debug({ sheetCount, sheetNames: workbook.SheetNames }, "Excel workbook loaded")

    const results: string[] = []

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue

      // Convert to CSV for text extraction
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
      if (csv.trim()) {
        results.push(`[Sheet: ${sheetName}]\n${csv}`)
        logger.debug({ sheetName, csvLength: csv.length }, "Sheet extracted")
      }
    }

    const extractedText = results.join("\n\n")
    logger.info(
      { bufferSize, sheetCount, sheetsExtracted: results.length, textLength: extractedText.length },
      "Excel parsing completed successfully",
    )
    return extractedText
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error({ error: errorMsg }, "Excel parsing failed")
    throw new Error(`Excel parsing failed: ${errorMsg}`)
  }
}
