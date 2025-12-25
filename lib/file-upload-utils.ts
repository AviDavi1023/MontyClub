/**
 * Safe file upload utilities with size limits and memory management
 * Prevents OOM errors from large file uploads
 */

// Configuration
const FILE_SIZE_LIMITS = {
  excel: 50 * 1024 * 1024, // 50MB max for Excel files
  image: 5 * 1024 * 1024,   // 5MB max for images
  general: 100 * 1024 * 1024, // 100MB general limit
}

export type AllowedFileType = 'excel' | 'image' | 'general'

export interface UploadValidationResult {
  valid: boolean
  error?: string
  sizeBytes?: number
  sizeReadable?: string
}

/**
 * Validate file size before processing
 */
export function validateFileSize(sizeBytes: number, fileType: AllowedFileType = 'general'): UploadValidationResult {
  const limit = FILE_SIZE_LIMITS[fileType]
  
  if (sizeBytes > limit) {
    return {
      valid: false,
      error: `File too large. Maximum size for ${fileType} files is ${formatBytes(limit)}, but you uploaded ${formatBytes(sizeBytes)}.`,
      sizeBytes,
      sizeReadable: formatBytes(sizeBytes),
    }
  }

  return {
    valid: true,
    sizeBytes,
    sizeReadable: formatBytes(sizeBytes),
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get Content-Length from request headers safely
 */
export function getRequestSize(headers: Headers): number | null {
  try {
    const contentLength = headers.get('content-length')
    if (contentLength) {
      return parseInt(contentLength, 10)
    }
  } catch {
    // Ignore
  }
  return null
}

/**
 * Validate Excel file upload with early size check
 * Call this before parsing the file
 */
export function validateExcelUpload(
  buffer: Buffer,
  options?: { maxSize?: number }
): UploadValidationResult {
  const maxSize = options?.maxSize || FILE_SIZE_LIMITS.excel
  
  if (buffer.byteLength > maxSize) {
    return {
      valid: false,
      error: `Excel file is too large (${formatBytes(buffer.byteLength)}). Maximum allowed size is ${formatBytes(maxSize)}.`,
      sizeBytes: buffer.byteLength,
      sizeReadable: formatBytes(buffer.byteLength),
    }
  }

  return {
    valid: true,
    sizeBytes: buffer.byteLength,
    sizeReadable: formatBytes(buffer.byteLength),
  }
}

/**
 * Safely read request body with size limits
 * Prevents reading oversized payloads into memory
 */
export async function safeReadRequestBody(
  request: Request,
  maxSize: number = FILE_SIZE_LIMITS.general
): Promise<{ success: true; buffer: Buffer } | { success: false; error: string }> {
  try {
    // Check Content-Length header first (avoid reading entire body if too large)
    const contentLength = getRequestSize(request.headers)
    if (contentLength && contentLength > maxSize) {
      return {
        success: false,
        error: `Request body too large (${formatBytes(contentLength)}). Maximum allowed size is ${formatBytes(maxSize)}.`,
      }
    }

    // Read the body with size limit
    const arrayBuffer = await request.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.byteLength > maxSize) {
      return {
        success: false,
        error: `Request body too large (${formatBytes(buffer.byteLength)}). Maximum allowed size is ${formatBytes(maxSize)}.`,
      }
    }

    return {
      success: true,
      buffer,
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to read request body: ${error?.message || String(error)}`,
    }
  }
}

/**
 * Memory-safe Excel workbook disposal
 * Call after parsing to free up memory
 */
export async function disposeWorkbook(workbook: any): Promise<void> {
  try {
    if (workbook && typeof workbook.destroy === 'function') {
      workbook.destroy()
    }
    // Force garbage collection hint
    if (global.gc) {
      global.gc()
    }
  } catch (error) {
    console.warn('Error disposing workbook:', error)
  }
}

/**
 * Get memory usage statistics (Node.js only)
 */
export function getMemoryStats() {
  if (typeof process === 'undefined') return null

  try {
    const usage = process.memoryUsage()
    return {
      heapUsed: formatBytes(usage.heapUsed),
      heapTotal: formatBytes(usage.heapTotal),
      external: formatBytes(usage.external),
      rss: formatBytes(usage.rss),
    }
  } catch {
    return null
  }
}

/**
 * Check if we're running low on memory
 */
export function isMemoryLow(thresholdPercent: number = 90): boolean {
  if (typeof process === 'undefined') return false

  try {
    const usage = process.memoryUsage()
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100
    return heapUsedPercent > thresholdPercent
  } catch {
    return false
  }
}

/**
 * Get current file size limits
 */
export function getFileSizeLimits() {
  return {
    ...FILE_SIZE_LIMITS,
    readableExcel: formatBytes(FILE_SIZE_LIMITS.excel),
    readableImage: formatBytes(FILE_SIZE_LIMITS.image),
    readableGeneral: formatBytes(FILE_SIZE_LIMITS.general),
  }
}
