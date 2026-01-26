import { parseOffice } from "officeparser"
import logger from "../logger"

/**
 * Extract text from Word (.docx) and PowerPoint (.pptx) documents
 * Uses officeparser v6+ for unified handling of Office formats
 * Returns AST with toText() method for plain text extraction
 */
export async function parseOfficeDocument(buffer: Buffer): Promise<string> {
  const bufferSize = buffer.length
  logger.info({ bufferSize }, "Starting Office document parsing")

  try {
    // v6+ API: parseOffice returns Promise<OfficeParserAST>
    const ast = await parseOffice(buffer, {
      newlineDelimiter: "\n",
      ignoreNotes: false,
    })
    // Use built-in toText() helper for plain text output
    const extractedText = ast.toText().trim()

    logger.info(
      { bufferSize, textLength: extractedText.length },
      "Office document parsing completed successfully",
    )
    return extractedText
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error({ error: errorMsg }, "Office document parsing failed")
    throw new Error(`Office document parsing failed: ${errorMsg}`)
  }
}
