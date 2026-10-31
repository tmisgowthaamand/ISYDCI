import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectDb, col } from '../db/mongo.js'
import { renderMemberCard } from '../services/cardRenderer.js'
import { saveMemberCardFiles, saveMemberPhoto, sanitizeMemberFolder, memberUploadDir } from '../services/storage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_DIR = path.resolve(__dirname, '../../public')

process.env.STORAGE_DRIVER = 'local'
process.env.PUBLIC_SITE_URL = 'https://isydci.com'

async function migrate() {
  await connectDb()
  const members = await col('members').find({}).toArray()
  console.log(`\n🚀 Starting local asset generation for ${members.length} members...`)

  for (const m of members) {
    const start = Date.now()
    const folder = sanitizeMemberFolder(m)
    const { dir } = memberUploadDir(m)

    // 1. Download & store profile photo locally
    let localPhotoUrl = m.photoUrl || m.photo || '/athletes/1.png'
    try {
      if (localPhotoUrl.startsWith('http://') || localPhotoUrl.startsWith('https://')) {
        const res = await fetch(localPhotoUrl)
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          const ext = res.headers.get('content-type')?.includes('png') ? 'png' : 'jpg'
          fs.writeFileSync(path.join(dir, `profile_photo.${ext}`), buf)
          localPhotoUrl = `https://isydci.com/uploads/members/${folder}/profile_photo.${ext}`
        }
      } else if (localPhotoUrl.startsWith('/athletes/')) {
        const localSrc = path.join(PUBLIC_DIR, localPhotoUrl.replace(/^\//, ''))
        if (fs.existsSync(localSrc)) {
          const buf = fs.readFileSync(localSrc)
          const ext = path.extname(localSrc).replace('.', '') || 'png'
          fs.writeFileSync(path.join(dir, `profile_photo.${ext}`), buf)
          localPhotoUrl = `https://isydci.com/uploads/members/${folder}/profile_photo.${ext}`
        }
      }
    } catch (err) {
      console.warn(`[Photo download error for ${m.memberId}]:`, err.message)
    }

    const memberWithLocalPhoto = {
      ...m,
      photo: localPhotoUrl,
      photoUrl: localPhotoUrl,
    }

    // 2. Render Front, Back, Combined
    const { front, back, combined } = await renderMemberCard(memberWithLocalPhoto)
    const cardUrls = saveMemberCardFiles(memberWithLocalPhoto, { front, back, combined })

    // 3. Update in MongoDB
    const updateDoc = {
      photo: localPhotoUrl,
      photoUrl: localPhotoUrl,
      cardFullUrl: cardUrls.cardFullUrl,
      cardFrontUrl: cardUrls.cardFrontUrl,
      cardBackUrl: cardUrls.cardBackUrl,
      cardDesignVersion: 3,
      updatedAt: new Date(),
    }

    await col('members').updateOne({ _id: m._id }, { $set: updateDoc })
    console.log(`✅ [${m.memberId}] ${m.name} -> cards & photo saved in uploads/members/${folder} (${Date.now() - start}ms)`)
  }

  console.log(`\n🎉 All ${members.length} members migrated to local storage and updated in MongoDB!`)
  process.exit(0)
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})

