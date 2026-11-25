import { QrCodeScanner } from '@/components/qr-code-scanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useMediaQuery } from '@/lib/hooks'
import { Link as LinkIcon, Loader2, Plus, QrCode } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Opens an invite link (or a group link) pasted or scanned by the user. */
export function AddGroupByUrlButton() {
  const t = useTranslations('Groups.AddByURL')
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const [url, setUrl] = useState('')
  const [error, setError] = useState(false)
  const [scanError, setScanError] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [scanMode, setScanMode] = useState(false)
  const router = useRouter()

  const processUrl = async (urlToProcess: string) => {
    // Parse with the URL API rather than building a RegExp from
    // window.location.origin, which is a regex-injection sink. Resolving
    // against the current origin also lets a scanned QR carry a relative
    // link, while an absolute link keeps its own origin and so still fails the
    // same-origin check below.
    let path: string | undefined
    try {
      const parsed = new URL(urlToProcess.trim(), window.location.origin)
      if (parsed.origin === window.location.origin) {
        const invite = parsed.pathname.match(/^\/invite\/([^/]+)/)?.[1]
        const group = parsed.pathname.match(/^\/groups\/([^/]+)/)?.[1]
        // Group links still work for groups created before accounts: the
        // group page then asks who you are, or for an invite link.
        if (invite) path = `/invite/${invite}`
        else if (group && group !== 'create' && group !== 'import')
          path = `/groups/${group}`
      }
    } catch {
      // Unparseable input is treated as "not found" below.
    }

    if (!path) {
      setError(true)
      setScanError('')
      return
    }

    setPending(true)
    setOpen(false)
    setScanMode(false)
    router.push(path)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary">{t('button')}</Button>
      </PopoverTrigger>
      <PopoverContent
        align={isDesktop ? 'end' : 'start'}
        className="[&_p]:text-sm flex flex-col gap-3"
      >
        <h3 className="font-bold">{t('title')}</h3>
        <p>{t('description')}</p>

        {!isDesktop && (
          <div className="flex gap-2 border-b pb-3 flex-wrap">
            <Button
              type="button"
              variant={!scanMode ? 'default' : 'outline'}
              size="sm"
              className="flex-1 min-w-[120px]"
              onClick={() => {
                setScanMode(false)
                setError(false)
                setScanError('')
              }}
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              {t('urlMode')}
            </Button>
            <Button
              type="button"
              variant={scanMode ? 'default' : 'outline'}
              size="sm"
              className="flex-1 min-w-[120px]"
              onClick={() => {
                setScanMode(true)
                setError(false)
                setScanError('')
              }}
            >
              <QrCode className="w-4 h-4 mr-2" />
              {t('qrMode')}
            </Button>
          </div>
        )}

        {!scanMode ? (
          <form
            className="flex gap-2 flex-wrap"
            onSubmit={async (event) => {
              event.preventDefault()
              await processUrl(url)
            }}
          >
            <Input
              type="url"
              required
              placeholder="https://spliit.app/..."
              className="flex-1 min-w-[200px] text-base"
              value={url}
              disabled={pending}
              onChange={(event) => {
                setUrl(event.target.value)
                setError(false)
                setScanError('')
              }}
            />
            <Button
              size="icon"
              type="submit"
              disabled={pending}
              className="flex-shrink-0"
            >
              {pending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </Button>
          </form>
        ) : (
          <QrCodeScanner
            onScan={(scannedUrl) => {
              processUrl(scannedUrl)
            }}
            onError={(errorMsg) => {
              setScanError(errorMsg)
              setError(false)
            }}
            onClose={() => setScanMode(false)}
          />
        )}

        {error && <p className="text-destructive">{t('error')}</p>}
        {scanError && <p className="text-destructive">{scanError}</p>}
      </PopoverContent>
    </Popover>
  )
}
