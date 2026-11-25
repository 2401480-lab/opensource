import { randomId } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { POST as route } from 'next-s3-upload/route'

const upload = route.configure({
  key(req, filename) {
    const [, extension] = filename.match(/(\.[^\.]*)$/) ?? [null, '']
    const timestamp = new Date().toISOString()
    const random = randomId()
    return `document-${timestamp}-${random}${extension.toLowerCase()}`
  },
  endpoint: env.S3_UPLOAD_ENDPOINT,
  // forcing path style is only necessary for providers other than AWS
  forcePathStyle: !!env.S3_UPLOAD_ENDPOINT,
})

// Only signed-in users may upload documents.
export async function POST(request: Request) {
  if (!(await getCurrentUser()))
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return upload(request as Parameters<typeof upload>[0])
}
