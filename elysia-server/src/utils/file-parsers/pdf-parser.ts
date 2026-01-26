import { extractText, getDocumentProxy } from "unpdf"
import logger from "../logger"

/**
 * Extract text from PDF buffer using unpdf
 * Modern, serverless-ready PDF parser built on PDF.js
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  const bufferSize = buffer.length
  logger.info({ bufferSize }, "Starting PDF parsing")

  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const pageCount = pdf.numPages
    logger.debug({ pageCount }, "PDF document loaded")

    const { text } = await extractText(pdf, { mergePages: true })
    const extractedText = (text as string).trim()

    logger.info(
      { bufferSize, pageCount, textLength: extractedText.length },
      "PDF parsing completed successfully",
    )
    return extractedText
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error({ error: errorMsg }, "PDF parsing failed")
    throw new Error(`PDF parsing failed: ${errorMsg}`)
  }
}
