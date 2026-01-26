import { config } from "../config"
import type { SlackFile } from "../types"
import {
  parseExcel,
  parseImage,
  parseOfficeDocument,
  parsePdf,
  setGeminiFallback,
} from "../utils/file-parsers"
import logger from "../utils/logger"

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const DOWNLOAD_TIMEOUT = 30000 // 30 seconds

interface ProcessedFile {
  fileId: string
  fileName: string
  mimetype: string
  text: string | null
  error: string | null
  processingTimeMs: number
}

interface FileProcessingResult {
  files: ProcessedFile[]
  combinedText: string
  totalProcessingTimeMs: number
}

class FileProcessingService {
  private initialized = false

  /**
   * Initialize the service with Gemini fallback for image processing
   * Must be called after geminiService is available
   */
  initialize(
    geminiAnalyzeImage: (buffer: Buffer, mimetype: string, fileName: string) => Promise<string>,
  ): void {
    if (this.initialized) return
    setGeminiFallback(geminiAnalyzeImage)
    this.initialized = true
    logger.info("File processing service initialized with Gemini fallback")
  }

  /**
   * Download file from Slack using bot token authentication
   */
  private async downloadFile(url: string, fileName: string): Promise<Buffer> {
    if (!config.SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN not configured")
    }

    logger.info(
      { fileName, url: `${url.substring(0, 50)}...` },
      "Starting file download from Slack",
    )
    const downloadStart = Date.now()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT)

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.SLACK_BOT_TOKEN}`,
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      logger.info(
        { fileName, bufferSize: buffer.length, downloadTimeMs: Date.now() - downloadStart },
        "File download completed",
      )
      return buffer
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Parse file based on mimetype
   */
  private async parseFile(buffer: Buffer, mimetype: string, fileName: string): Promise<string> {
    logger.info({ fileName, mimetype, bufferSize: buffer.length }, "Routing file to parser")

    // PDF
    if (mimetype === "application/pdf") {
      logger.debug({ fileName }, "Using PDF parser (unpdf)")
      return parsePdf(buffer)
    }

    // Excel (xlsx, xls, csv)
    if (
      mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimetype === "application/vnd.ms-excel" ||
      mimetype === "text/csv" ||
      mimetype.includes("spreadsheet") ||
      mimetype.includes("excel")
    ) {
      logger.debug({ fileName }, "Using Excel parser (xlsx/SheetJS)")
      return parseExcel(buffer)
    }

    // Word documents
    if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimetype === "application/msword" ||
      mimetype.includes("document")
    ) {
      logger.debug({ fileName }, "Using Office parser for Word document (officeparser)")
      return parseOfficeDocument(buffer)
    }

    // PowerPoint
    if (
      mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
      mimetype === "application/vnd.ms-powerpoint" ||
      mimetype.includes("presentation") ||
      mimetype.includes("powerpoint")
    ) {
      logger.debug({ fileName }, "Using Office parser for PowerPoint (officeparser)")
      return parseOfficeDocument(buffer)
    }

    // Images
    if (mimetype.startsWith("image/")) {
      logger.debug({ fileName }, "Using Image parser (sharp + tesseract.js)")
      return parseImage(buffer, mimetype, fileName)
    }

    logger.warn({ fileName, mimetype }, "Unsupported file type")
    throw new Error(`Unsupported file type: ${mimetype}`)
  }

  /**
   * Process multiple Slack files and extract content
   */
  async processSlackFiles(files: SlackFile[]): Promise<FileProcessingResult> {
    const startTime = Date.now()
    const processedFiles: ProcessedFile[] = []
    const extractedTexts: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue // TypeScript guard

      const fileStartTime = Date.now()
      let text: string | null = null
      let error: string | null = null

      logger.info(
        {
          fileId: file.id,
          fileName: file.name,
          mimetype: file.mimetype,
          size: file.size,
          fileIndex: i + 1,
          totalFiles: files.length,
        },
        "Processing file attachment",
      )

      try {
        // Validate file size
        if (file.size && file.size > MAX_FILE_SIZE) {
          logger.warn(
            { fileName: file.name, size: file.size, maxSize: MAX_FILE_SIZE },
            "File exceeds size limit, skipping",
          )
          throw new Error(
            `File too large: ${Math.round(file.size / 1024 / 1024)}MB (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`,
          )
        }

        // Get download URL (prefer url_private_download)
        const downloadUrl = file.url_private_download || file.url
        if (!downloadUrl) {
          throw new Error("No download URL available")
        }

        // Download file
        const buffer = await this.downloadFile(downloadUrl, file.name)

        // Parse file
        text = await this.parseFile(buffer, file.mimetype, file.name)

        if (text) {
          extractedTexts.push(
            `\n--- [Attachment: ${file.name}] ---\n${text}\n--- [End: ${file.name}] ---\n`,
          )
        }

        const processingTime = Date.now() - fileStartTime
        logger.info(
          {
            fileId: file.id,
            fileName: file.name,
            mimetype: file.mimetype,
            textLength: text?.length,
            processingTimeMs: processingTime,
          },
          "File processed successfully",
        )
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
        logger.warn(
          {
            fileId: file.id,
            fileName: file.name,
            mimetype: file.mimetype,
            error,
            processingTimeMs: Date.now() - fileStartTime,
          },
          "Failed to process file attachment",
        )
      }

      processedFiles.push({
        fileId: file.id,
        fileName: file.name,
        mimetype: file.mimetype,
        text,
        error,
        processingTimeMs: Date.now() - fileStartTime,
      })
    }

    const totalTime = Date.now() - startTime
    logger.info(
      {
        totalFiles: files.length,
        successfulFiles: processedFiles.filter((f) => !f.error).length,
        totalProcessingTimeMs: totalTime,
      },
      "File batch processing complete",
    )

    return {
      files: processedFiles,
      combinedText: extractedTexts.join("\n"),
      totalProcessingTimeMs: totalTime,
    }
  }
}

export const fileProcessingService = new FileProcessingService()
