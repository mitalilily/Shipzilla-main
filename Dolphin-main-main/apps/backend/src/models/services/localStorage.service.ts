import { createHmac, timingSafeEqual } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

export type LocalStorageMode = 'local'

export interface LocalUploadDescriptor {
  uploadUrl: string
  key: string
  publicUrl: string
  storageMode: LocalStorageMode
}

export interface LocalDownloadOptions {
  downloadName?: string
  disposition?: 'inline' | 'attachment'
  contentType?: string
  expiresInSeconds?: number
}

interface LocalUploadTokenPayload {
  kind: 'upload'
  key: string
  filename: string
  contentType: string
  expiresAt: number
}

interface LocalDownloadTokenPayload {
  kind: 'download'
  key: string
  downloadName?: string
  disposition?: 'inline' | 'attachment'
  contentType?: string
  expiresAt: number
}

interface LocalUploadMetadata {
  key: string
  originalName: string
  contentType: string
  size: number
  uploadedAt: string
}

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:5002'
const LOCAL_UPLOAD_ROUTE = '/api/uploads/local-upload'
const LOCAL_DOWNLOAD_ROUTE = '/api/uploads/local-download'
const LOCAL_UPLOAD_TTL_SECONDS = 60 * 5
const LOCAL_DOWNLOAD_TTL_SECONDS = 60 * 60 * 24

const cleanEnvValue = (value?: string) => {
  const trimmed = value?.trim()
  return trimmed || undefined
}

const normalizeBaseUrl = (value?: string) => {
  const trimmed = cleanEnvValue(value)
  if (!trimmed) return undefined
  return trimmed.replace(/\/+$/, '').replace(/\/api$/i, '')
}

export const getBackendBaseUrl = () =>
  normalizeBaseUrl(
    cleanEnvValue(process.env.API_PUBLIC_URL) ||
      cleanEnvValue(process.env.API_URL) ||
      `${DEFAULT_BACKEND_BASE_URL}`,
  ) || DEFAULT_BACKEND_BASE_URL

export const isR2StorageConfigured = () =>
  Boolean(
    cleanEnvValue(process.env.R2_ENDPOINT) &&
      cleanEnvValue(process.env.R2_ACCESS_KEY_ID) &&
      cleanEnvValue(process.env.R2_SECRET_ACCESS_KEY) &&
      cleanEnvValue(
        process.env.R2_BUCKET ||
          process.env.DEV_BUCKET ||
          process.env.STAGING_BUCKET ||
          process.env.PROD_BUCKET,
      ),
  )

export const sanitizeUploadFilename = (filename: string) => {
  const baseName = path.basename(filename || 'file')
  const sanitized = baseName
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return sanitized || 'file'
}

export const buildStorageKey = ({
  folderKey,
  userId,
  filename,
}: {
  folderKey: string
  userId: string
  filename: string
}) => `${folderKey}/${userId}/${Date.now()}-${sanitizeUploadFilename(filename)}`

const buildUrl = (route: string) => new URL(route, getBackendBaseUrl()).toString()

const getLocalUploadsRoot = () => path.resolve(__dirname, '../../../uploads')

const inferContentTypeFromName = (name: string) => {
  const ext = path.extname(name).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.doc') return 'application/msword'
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}

export const resolveLocalStoragePath = (key: string) => {
  const normalizedKey = key.replace(/^\/+/, '').replace(/\\/g, '/')
  const root = path.resolve(getLocalUploadsRoot())
  const filePath = path.resolve(root, normalizedKey)

  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid local storage key')
  }

  return filePath
}

const getTokenSecret = () =>
  cleanEnvValue(process.env.LOCAL_STORAGE_SECRET) ||
  cleanEnvValue(process.env.JWT_SECRET) ||
  cleanEnvValue(process.env.ACCESS_TOKEN_SECRET) ||
  'shipzilla-local-storage-secret'

const encodeSignedToken = (payload: object) => {
  const payloadJson = JSON.stringify(payload)
  const payloadBase64 = Buffer.from(payloadJson).toString('base64url')
  const signature = createHmac('sha256', getTokenSecret()).update(payloadBase64).digest('base64url')
  return `${payloadBase64}.${signature}`
}

const decodeSignedToken = <T>(token: string, options?: { ignoreExpiry?: boolean }): T | null => {
  const [payloadBase64, signature] = token.split('.')
  if (!payloadBase64 || !signature) return null

  const expected = Buffer.from(
    createHmac('sha256', getTokenSecret()).update(payloadBase64).digest('base64url'),
  )
  const actual = Buffer.from(signature, 'base64url')

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as T & {
      expiresAt?: number
    }

    if (!options?.ignoreExpiry && payload.expiresAt && payload.expiresAt < Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export const createLocalDownloadUrl = ({
  key,
  downloadName,
  disposition,
  contentType,
  expiresInSeconds = LOCAL_DOWNLOAD_TTL_SECONDS,
}: {
  key: string
  downloadName?: string
  disposition?: 'inline' | 'attachment'
  contentType?: string
  expiresInSeconds?: number
}) => {
  const token = encodeSignedToken({
    kind: 'download',
    key,
    downloadName,
    disposition,
    contentType,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  } satisfies LocalDownloadTokenPayload)

  return buildUrl(`${LOCAL_DOWNLOAD_ROUTE}?token=${encodeURIComponent(token)}`)
}

export const createLocalUploadDescriptor = ({
  filename,
  contentType,
  userId,
  folderKey = 'userPp',
}: {
  filename: string
  contentType: string
  userId: string
  folderKey?: string
}): LocalUploadDescriptor => {
  const key = buildStorageKey({ folderKey, userId, filename })
  const uploadToken = encodeSignedToken({
    kind: 'upload',
    key,
    filename: sanitizeUploadFilename(filename),
    contentType,
    expiresAt: Date.now() + LOCAL_UPLOAD_TTL_SECONDS * 1000,
  } satisfies LocalUploadTokenPayload)

  const publicUrl = createLocalDownloadUrl({
    key,
    downloadName: sanitizeUploadFilename(filename),
    disposition: 'inline',
    expiresInSeconds: LOCAL_DOWNLOAD_TTL_SECONDS,
  })

  return {
    uploadUrl: buildUrl(`${LOCAL_UPLOAD_ROUTE}?token=${encodeURIComponent(uploadToken)}`),
    key,
    publicUrl,
    storageMode: 'local',
  }
}

export const extractKeyFromLocalDownloadUrl = (value: string): string | null => {
  try {
    const url = new URL(value)
    if (!url.pathname.endsWith('/uploads/local-download') && !url.pathname.endsWith('/api/uploads/local-download')) {
      return null
    }

    const token = url.searchParams.get('token')
    if (!token) return null

    const payload = decodeSignedToken<LocalDownloadTokenPayload>(token, { ignoreExpiry: true })
    if (!payload || payload.kind !== 'download') return null

    return payload.key
  } catch {
    return null
  }
}

export const extractKeyFromLocalUploadUrl = (value: string): string | null => {
  try {
    const url = new URL(value)
    if (!url.pathname.endsWith('/uploads/local-upload') && !url.pathname.endsWith('/api/uploads/local-upload')) {
      return null
    }

    const token = url.searchParams.get('token')
    if (!token) return null

    const payload = decodeSignedToken<LocalUploadTokenPayload>(token, { ignoreExpiry: true })
    if (!payload || payload.kind !== 'upload') return null

    return payload.key
  } catch {
    return null
  }
}

export const readLocalUploadToken = (token: string) => {
  const payload = decodeSignedToken<LocalUploadTokenPayload>(token)
  if (!payload || payload.kind !== 'upload') return null
  return payload
}

export const readLocalDownloadToken = (token: string) => {
  const payload = decodeSignedToken<LocalDownloadTokenPayload>(token)
  if (!payload || payload.kind !== 'download') return null
  return payload
}

export const saveLocalUploadBuffer = async ({
  token,
  buffer,
  contentType,
}: {
  token: string
  buffer: Buffer
  contentType?: string
}) => {
  const payload = readLocalUploadToken(token)
  if (!payload) {
    throw new Error('Invalid or expired local upload token')
  }

  const filePath = resolveLocalStoragePath(payload.key)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, buffer)

  const metadata: LocalUploadMetadata = {
    key: payload.key,
    originalName: payload.filename,
    contentType: contentType || payload.contentType || 'application/octet-stream',
    size: buffer.byteLength,
    uploadedAt: new Date().toISOString(),
  }

  await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(metadata, null, 2))

  return {
    key: payload.key,
    filePath,
    metadata,
    publicUrl: createLocalDownloadUrl({
      key: payload.key,
      downloadName: payload.filename,
      contentType: metadata.contentType,
      disposition: 'inline',
      expiresInSeconds: LOCAL_DOWNLOAD_TTL_SECONDS,
    }),
  }
}

export const readLocalDownloadAsset = async ({
  token,
}: {
  token: string
}) => {
  const payload = readLocalDownloadToken(token)
  if (!payload) {
    return null
  }

  const filePath = resolveLocalStoragePath(payload.key)
  try {
    await fs.access(filePath)
  } catch {
    return null
  }

  let metadata: LocalUploadMetadata | null = null
  try {
    const raw = await fs.readFile(`${filePath}.meta.json`, 'utf8')
    metadata = JSON.parse(raw) as LocalUploadMetadata
  } catch {
    metadata = null
  }

  const contentType =
    payload.contentType || metadata?.contentType || inferContentTypeFromName(filePath)
  const downloadName = payload.downloadName || metadata?.originalName || path.basename(filePath)
  const disposition = payload.disposition || 'inline'
  const contentDisposition = `${disposition}; filename="${sanitizeUploadFilename(downloadName)}"`

  return {
    filePath,
    contentType,
    contentDisposition,
    key: payload.key,
    metadata,
  }
}
