import { Request, Response } from 'express'
import {
  presignDownload,
  presignUpload,
  uploadBufferToStorage,
} from '../models/services/upload.service'
import {
  readLocalDownloadAsset,
  saveLocalUploadBuffer,
} from '../models/services/localStorage.service'

export const createPresignedUrl = async (
  req: any,
  res: Response,
): Promise<any> => {
  const { filename, contentType, folder } = req.body
  const { sub } = req?.user

  if (!filename || !contentType) {
    return res.status(400).json({ message: 'filename & contentType required' })
  }

  try {
    const data = await presignUpload({
      filename,
      contentType,
      userId: sub,
      folderKey: folder,
    })
    return res.status(200).json(data)
  } catch (err) {
    console.error('Presign error:', err)
    return res.status(500).json({ message: 'Failed to presign URL' })
  }
}

export const uploadLocalFile = async (req: Request, res: Response): Promise<any> => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''

  if (!token) {
    return res.status(400).json({ message: 'Missing upload token' })
  }

  try {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : undefined
    const saved = await saveLocalUploadBuffer({
      token,
      buffer: body,
      contentType,
    })

    return res.status(200).json({
      key: saved.key,
      publicUrl: saved.publicUrl,
      storageMode: 'local',
    })
  } catch (error: any) {
    console.error('Local upload failed:', error)
    return res.status(400).json({ message: error?.message || 'Failed to store file locally' })
  }
}

const isStorageKeyOwnedByUser = (key: string, userId: string) => {
  const segments = String(key || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

  return segments.length >= 3 && segments[1] === String(userId || '').trim()
}

export const uploadServerFile = async (req: any, res: Response): Promise<any> => {
  const key = typeof req.query.key === 'string' ? req.query.key.trim() : ''
  const userId = String(req?.user?.sub || '').trim()

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  if (!key) {
    return res.status(400).json({ message: 'Missing storage key' })
  }

  if (!isStorageKeyOwnedByUser(key, userId)) {
    return res.status(403).json({ message: 'Invalid storage key for current user' })
  }

  try {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '')
    const contentType =
      typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : undefined

    await uploadBufferToStorage({
      key,
      buffer: body,
      contentType,
    })

    return res.status(200).json({
      key,
      storageMode: 'r2',
      uploadedVia: 'server',
    })
  } catch (error: any) {
    console.error('Server upload failed:', error)
    return res.status(400).json({ message: error?.message || 'Failed to upload file to storage' })
  }
}

export const downloadLocalFile = async (req: Request, res: Response): Promise<any> => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''

  if (!token) {
    return res.status(400).json({ message: 'Missing download token' })
  }

  try {
    const asset = await readLocalDownloadAsset({ token })
    if (!asset) {
      return res.status(404).json({ message: 'File not found' })
    }

    res.setHeader('Content-Type', asset.contentType)
    if (asset.contentDisposition) {
      res.setHeader('Content-Disposition', asset.contentDisposition)
    }
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')

    return res.sendFile(asset.filePath)
  } catch (error: any) {
    console.error('Local download failed:', error)
    return res.status(400).json({ message: error?.message || 'Failed to read file' })
  }
}

export const getPresignedDownloadUrl = async (
  req: Request,
  res: Response,
): Promise<any> => {
  try {
    const { keys } = req.body

    if (!keys || (typeof keys !== 'string' && !Array.isArray(keys))) {
      return res.status(400).json({ message: "'keys' must be a string or string[]" })
    }

    const result = await presignDownload(keys)

    if (Array.isArray(keys)) {
      const urls = Array.isArray(result) ? result : []
      const missingFiles = urls
        .map((url, index) => (url === null ? keys[index] : null))
        .filter(Boolean)

      if (missingFiles.length > 0) {
        console.warn('Some files not found in storage:', missingFiles)
      }

      return res.status(200).json({ urls })
    }

    if (!result || result === null) {
      return res.status(404).json({
        message: 'File not found in storage',
        key: keys,
      })
    }

    return res.status(200).json({ url: result as string })
  } catch (error) {
    console.error('Presign download failed:', error)
    return res.status(500).json({ message: 'Failed to generate download URL(s)' })
  }
}

