import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { PropsWithChildren } from 'react'

/** Login and sign-up pages: what Spliit is for, how it works, and the form. */
export function AuthShell({ children }: PropsWithChildren) {
  const t = useTranslations('Auth')
  return (
    <main className="flex-1 w-full max-w-screen-md mx-auto px-4 py-8 sm:py-12 grid gap-8 md:grid-cols-2 md:items-start">
      <section className="flex flex-col gap-4">
        <Image
          src="/logo-with-text.png"
          className="h-auto w-auto"
          width={(45 * 522) / 180}
          height={45}
          alt="Spliit"
          priority
        />
        <p className="text-lg leading-relaxed">{t('tagline')}</p>
        <div>
          <h2 className="font-semibold mb-2">{t('howItWorks')}</h2>
          <ol className="flex flex-col gap-2 text-sm text-muted-foreground">
            {(['step1', 'step2', 'step3'] as const).map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="pt-0.5">{t(step)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section>{children}</section>
    </main>
  )
}
