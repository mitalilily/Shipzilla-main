import axios from 'axios'
import axiosInstance from '../api/axiosInstance'

type UploadDescriptor = {
  uploadUrl: string
  key: string
  storageMode?: 'local' | 'r2'
}

type UploadWithFallbackParams = {
  descriptor: UploadDescriptor
  file: Blob
  contentType: string
  onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void
  preferServerUpload?: boolean
}

export const uploadFileWithFallback = async ({
  descriptor,
  file,
  contentType,
  onUploadProgress,
  preferServerUpload = false,
}: UploadWithFallbackParams) => {
  if (descriptor.storageMode === 'local') {
    await axiosInstance.put(descriptor.uploadUrl, file, {
      headers: { 'Content-Type': contentType },
      onUploadProgress,
    })
    return
  }

  const uploadViaServer = async () => {
    await axiosInstance.put(`/uploads/server-upload?key=${encodeURIComponent(descriptor.key)}`, file, {
      headers: { 'Content-Type': contentType },
      onUploadProgress,
    })
  }

  if (preferServerUpload) {
    await uploadViaServer()
    return
  }

  try {
    await axios.put(descriptor.uploadUrl, file, {
      withCredentials: false,
      headers: { 'Content-Type': contentType },
      onUploadProgress,
    })
  } catch (directUploadError) {
    console.warn('Direct storage upload failed, retrying through backend fallback:', directUploadError)
    await uploadViaServer()
  }
}
