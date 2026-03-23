import { uploadToR2, isR2Configured } from '../../../src/lib/storage/r2.js'
import { requireUser } from '../../utils/auth.js'
import { jsonError } from '../../utils/http.js'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif']
const ALLOWED_VIDEO_TYPES = ['video/mp4']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_VIDEO_SIZE = 100 * 1024 * 1024

export default defineEventHandler(async (event) => {
  if (!isR2Configured()) {
    return jsonError(event, 503, 'Media uploads not configured')
  }

  const user = requireUser(event)
  const formData = await readMultipartFormData(event)
  const file = formData?.find((part) => part.name === 'file')

  if (!file || !file.filename || !file.type || !file.data) {
    return jsonError(event, 400, 'file is required')
  }

  const contentType = file.type
  const isImage = ALLOWED_IMAGE_TYPES.includes(contentType)
  const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType)

  if (!isImage && !isVideo) {
    return jsonError(event, 400, 'Unsupported file type. Allowed: jpg, png, gif, mp4')
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
  if (file.data.byteLength > maxSize) {
    return jsonError(event, 400, `File too large. Max ${maxSize / (1024 * 1024)}MB for ${isImage ? 'images' : 'videos'}`)
  }

  const ext = file.filename.split('.').pop() ?? (isImage ? 'jpg' : 'mp4')
  const key = `media/${user.sub}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  const url = await uploadToR2(key, Buffer.from(file.data), contentType)

  return { url }
})
