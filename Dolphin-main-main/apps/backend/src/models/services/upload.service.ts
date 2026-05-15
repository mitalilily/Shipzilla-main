import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import axios from 'axios'
import {
  buildStorageKey,
  createLocalDownloadUrl,
  createLocalUploadDescriptor,
  extractKeyFromLocalDownloadUrl,
  extractKeyFromLocalUploadUrl,
  isR2StorageConfigured,
} from './localStorage.service'
import { r2 } from '../../config/r2Client'
import { getBucketName, StorageConfigurationError } from '../../utils/functions'

import * as dotenv from 'dotenv'
import path from 'path'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

interface PresignParams {
  filename: string
  contentType: string
  userId: string
  folderKey?: string
}

const PRESIGN_DOWNLOAD_EXPIRES_IN_SECONDS = 60 * 60 * 24
const PRESIGN_CACHE_SAFETY_BUFFER_MS = 60 * 1000
const presignDownloadCache = new Map<string, { url: string; expiresAt: number }>()

const presignCacheKey = (
  bucket: string,
  key: string,
  options?: {
    downloadName?: string
    disposition?: 'inline' | 'attachment'
    contentType?: string
  },
) =>
  JSON.stringify({
    bucket,
    key,
    disposition: options?.disposition || null,
    downloadName: options?.downloadName || null,
    contentType: options?.contentType || null,
  })

const signR2DownloadUrl = async (
  bucket: string,
  key: string,
  options?: {
    downloadName?: string
    disposition?: 'inline' | 'attachment'
    contentType?: string
  },
  expiresIn = PRESIGN_DOWNLOAD_EXPIRES_IN_SECONDS,
) => {
  const responseContentDisposition =
    options?.disposition && options?.downloadName
      ? `${options.disposition}; filename="${options.downloadName}"`
      : undefined

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: responseContentDisposition,
    ResponseContentType: options?.contentType,
  })

  return getSignedUrl(r2, command, {
    expiresIn,
  })
}

const extractKeyFromUrl = (url: string, bucket?: string): string | null => {
  const localKey = extractKeyFromLocalDownloadUrl(url) || extractKeyFromLocalUploadUrl(url)
  if (localKey) {
    return localKey
  }

  try {
    if (bucket && url.includes(bucket)) {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      const bucketIndex = pathParts.indexOf(bucket)
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/')
      }
    }

    if (process.env.R2_ENDPOINT && url.startsWith(process.env.R2_ENDPOINT)) {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      if (pathParts.length > 1) {
        return pathParts.slice(1).join('/')
      }
    }

    return null
  } catch (error) {
    console.error('Error extracting key from URL:', url, error)
    return null
  }
}

export const presignUpload = async ({
  filename,
  contentType,
  userId,
  folderKey = 'userPp',
}: PresignParams) => {
  if (!isR2StorageConfigured()) {
    return createLocalUploadDescriptor({
      filename,
      contentType,
      userId,
      folderKey,
    })
  }

  const bucket = getBucketName()
  const key = buildStorageKey({
    folderKey,
    userId,
    filename,
  })

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 60 * 5 })
  const publicUrl = `${process.env.R2_ENDPOINT}/${bucket}/${key}`

  return { uploadUrl, key, publicUrl, bucket, storageMode: 'r2' as const }
}

/**
 * Download a file from a URL and upload it to storage, returning only the key.
 * This ensures we store keys only, not external URLs.
 */
export const downloadAndUploadToR2 = async ({
  url,
  userId,
  filename,
  folderKey = 'labels',
  contentType = 'application/pdf',
}: {
  url: string
  userId: string
  filename: string
  folderKey?: string
  contentType?: string
}): Promise<string | null> => {
  try {
    const usingR2 = isR2StorageConfigured()
    const bucket = usingR2 ? getBucketName() : undefined

    const isValidUrl = /^https?:\/\//i.test(url)

    if (!isValidUrl) {
      console.log(`Input is not a URL, treating as storage key: ${url}`)

      if (url.includes('/')) {
        console.log(`Using existing storage key: ${url}`)
        return url
      }

      const key = buildStorageKey({
        folderKey,
        userId,
        filename: url,
      })
      console.log(`Constructed storage key from filename: ${key}`)
      return key
    }

    const extractedKey = extractKeyFromUrl(url, bucket)
    if (extractedKey) {
      console.log(`URL is already a storage URL, using existing key: ${extractedKey}`)
      return extractedKey
    }

    console.log(`Downloading file from URL: ${url}`)
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    })

    const fileBuffer = Buffer.from(response.data)

    console.log(`Uploading downloaded file to ${usingR2 ? 'R2' : 'local storage'}: ${filename}`)
    const { uploadUrl, key } = await presignUpload({
      filename,
      contentType,
      userId,
      folderKey,
    })

    if (!uploadUrl || !key) {
      console.error('Failed to get presigned upload URL')
      return null
    }

    await axios.put(Array.isArray(uploadUrl) ? uploadUrl[0] : uploadUrl, fileBuffer, {
      headers: { 'Content-Type': contentType },
    })

    const finalKey = Array.isArray(key) ? key[0] : key
    console.log(`File uploaded successfully: ${finalKey}`)
    return finalKey
  } catch (error: any) {
    console.error('Failed to download and upload file:', {
      url,
      filename,
      error: error?.message || error,
      stack: error?.stack,
    })
    return null
  }
}

export const presignDownload = async (
  keyOrKeys: string | string[],
  options?: {
    downloadName?: string
    disposition?: 'inline' | 'attachment'
    contentType?: string
  },
) => {
  try {
    const usingR2 = isR2StorageConfigured()
    const bucket = usingR2 ? getBucketName() : 'local-storage'
    const now = Date.now()

    const signValue = async (rawValue: string) => {
      const value = rawValue.trim()

      if (!value) {
        console.warn('Empty key provided to presignDownload')
        return null
      }

      if (/^https?:\/\//i.test(value)) {
        const extractedKey = extractKeyFromUrl(value, usingR2 ? bucket : undefined)
        if (!extractedKey) {
          console.warn(`Could not extract storage key from URL, returning as-is: ${value}`)
          return value
        }

        if (!usingR2) {
          return createLocalDownloadUrl({
            key: extractedKey,
            downloadName: options?.downloadName,
            disposition: options?.disposition,
            contentType: options?.contentType,
            expiresInSeconds: PRESIGN_DOWNLOAD_EXPIRES_IN_SECONDS,
          })
        }

        const signedUrl = await signR2DownloadUrl(bucket, extractedKey, options)
        console.log(`Presigned URL regenerated successfully for key: ${extractedKey}`)
        return signedUrl
      }

      if (!usingR2) {
        const cacheKey = presignCacheKey(bucket, value, options)
        const cached = presignDownloadCache.get(cacheKey)
        if (cached && cached.expiresAt - PRESIGN_CACHE_SAFETY_BUFFER_MS > now) {
          return cached.url
        }

        const signedUrl = createLocalDownloadUrl({
          key: value,
          downloadName: options?.downloadName,
          disposition: options?.disposition,
          contentType: options?.contentType,
          expiresInSeconds: PRESIGN_DOWNLOAD_EXPIRES_IN_SECONDS,
        })

        presignDownloadCache.set(cacheKey, {
          url: signedUrl,
          expiresAt: now + PRESIGN_DOWNLOAD_EXPIRES_IN_SECONDS * 1000,
        })
        return signedUrl
      }

      const cacheKey = presignCacheKey(bucket, value, options)
      const cached = presignDownloadCache.get(cacheKey)
      if (cached && cached.expiresAt - PRESIGN_CACHE_SAFETY_BUFFER_MS > now) {
        return cached.url
      }

      console.log(`Presigning download URL for key: ${value} in bucket: ${bucket}`)
      const signedUrl = await signR2DownloadUrl(bucket, value, options)
      console.log(`Presigned URL generated successfully for key: ${value}`)
      presignDownloadCache.set(cacheKey, {
        url: signedUrl,
        expiresAt: now + PRESIGN_DOWNLOAD_EXPIRES_IN_SECONDS * 1000,
      })
      return signedUrl
    }

    if (typeof keyOrKeys === 'string') {
      return await signValue(keyOrKeys)
    }

    const urls = await Promise.all(keyOrKeys.map((key) => signValue(key || '')))
    return urls.filter((url): url is string => url !== null)
  } catch (error: any) {
    if (error instanceof StorageConfigurationError) {
      console.warn('Skipping presigned download because storage is not configured:', {
        keys: keyOrKeys,
        error: error.message,
      })
      return typeof keyOrKeys === 'string' ? null : []
    }

    if (error?.code === 'NoSuchKey' || error?.message?.includes('NoSuchKey')) {
      console.error('File not found in storage:', {
        keys: keyOrKeys,
        error: error?.message || error,
      })
      return typeof keyOrKeys === 'string' ? null : []
    }

    console.error('Error generating presigned download URL(s):', {
      error: error?.message || error,
      stack: error?.stack,
      keys: keyOrKeys,
    })
    throw new Error(`Failed to generate presigned URL(s): ${error?.message || 'Unknown error'}`)
  }
}

