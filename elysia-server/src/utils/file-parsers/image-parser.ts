import sharp from "sharp"
import { createWorker } from "tesseract.js"
import logger from "../logger"

// Gemini fallback function type - injected to avoid circular dependency
type GeminiFallback = (buffer: Buffer, mimetype: string, fileName: string) => Promise<string>

let geminiFallback: GeminiFallback | null = null

/**
 * Set the Gemini fallback function for complex images
 * Called from file-processing.service.ts to inject the dependency
 */
export function setGeminiFallback(fallback: GeminiFallback): void {
  geminiFallback = fallback
}

/**
 * Extract text from image using OCR
 * 1. Preprocess with sharp (grayscale + normalize + sharpen)
 * 2. OCR with Tesseract.js (supports Korean + English)
 * 3. Fallback to Gemini Vision if confidence is low
 */
export async function parseImage(
  buffer: Buffer,
  mimetype: string,
  fileName: string,
): Promise<string> {
  const bufferSize = buffer.length
  logger.info({ fileName, mimetype, bufferSize }, "Starting image parsing")

  try {
    // Step 1: Preprocess with sharp for better OCR accuracy
    logger.debug({ fileName }, "Preprocessing image with sharp (grayscale, normalize, sharpen)")
    const preprocessed = await sharp(buffer).grayscale().normalize().sharpen().toBuffer()
    logger.debug(
      { fileName, originalSize: bufferSize, preprocessedSize: preprocessed.length },
      "Image preprocessing completed",
    )

    // Step 2: OCR with Tesseract.js (free, supports Korean)
    logger.debug({ fileName }, "Starting Tesseract OCR (eng+kor)")
    const worker = await createWorker(["eng", "kor"])
    const { data } = await worker.recognize(preprocessed)
    await worker.terminate()

    const confidence = data.confidence
    const text = data.text.trim()

    logger.info({ fileName, confidence, textLength: text.length }, "Image OCR completed")

    // Step 3: Check confidence and decide on fallback
    if (confidence > 70 && text.length > 0) {
      logger.info(
        { fileName, bufferSize, confidence, textLength: text.length, method: "tesseract" },
        "Image parsing completed successfully (high confidence OCR)",
      )
      return text // Good OCR result
    }

    // Low confidence or empty text - try Gemini Vision fallback
    if (confidence < 50 || text.length < 10) {
      if (geminiFallback) {
        logger.info({ fileName, confidence }, "Low OCR confidence, using Gemini Vision fallback")
        const geminiResult = await geminiFallback(buffer, mimetype, fileName)
        logger.info(
          { fileName, bufferSize, textLength: geminiResult.length, method: "gemini" },
          "Image parsing completed successfully (Gemini Vision fallback)",
        )
        return geminiResult
      }
      logger.warn({ fileName, confidence }, "Low OCR confidence but no Gemini fallback available")
    }

    logger.info(
      { fileName, bufferSize, confidence, textLength: text.length, method: "tesseract" },
      "Image parsing completed (medium confidence OCR)",
    )
    return text
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error({ error: errorMsg, fileName }, "Image parsing failed")
    throw new Error(`Image parsing failed: ${errorMsg}`)
  }
}
