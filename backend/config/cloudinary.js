import { v2 as cloudinary } from 'cloudinary'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from backend folder or root folder
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Configure Cloudinary without hardcoding credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

console.log('[Cloudinary Configured]', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '(missing)',
  api_key_set: !!process.env.CLOUDINARY_API_KEY,
  api_secret_set: !!process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload a Base64 image or URL to Cloudinary inside a specific folder
 * @param {string} imageSource Base64 data URI or image URL
 * @param {string} folder Folder path (e.g., 'isydci/members/LAKSHAN_KARTHIK')
 * @param {string} publicId File public ID (e.g., 'photo', 'card_front', 'card_back')
 */
export async function uploadToCloudinary(imageSource, folder, publicId) {
  if (!imageSource || typeof imageSource !== 'string') {
    return null
  }

  // If it's already a hosted Cloudinary/http URL, return it
  if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    if (!imageSource.startsWith('http://localhost')) {
      return { secure_url: imageSource, public_id: publicId }
    }
  }

  try {
    const uploadResponse = await cloudinary.uploader.upload(imageSource, {
      folder: folder || 'isydci/members',
      public_id: publicId,
      overwrite: true,
      resource_type: 'image',
    })

    return {
      secure_url: uploadResponse.secure_url,
      public_id: uploadResponse.public_id,
      format: uploadResponse.format,
      bytes: uploadResponse.bytes,
    }
  } catch (error) {
    console.error(`[Cloudinary Upload Error for ${publicId}]:`, error.message)
    // Fallback gracefully so saving never completely crashes if network issue occurs
    return {
      secure_url: imageSource, // keeps base64 or fallback
      public_id: publicId,
      error: error.message,
    }
  }
}

export default cloudinary
