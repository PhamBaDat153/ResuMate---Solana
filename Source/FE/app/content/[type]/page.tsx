import { CatsComponent } from '@/components/cats-component'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const CONTENT_CONFIG = {
  cheap: {
    price: '0.01',
    title: 'Budget Content',
    message:
      'This is what you get when you pay for cheap content: angry, starving, and sad cats.',
  },
  expensive: {
    price: '0.25',
    title: 'Premium Content',
    message: 'You deserve the best! Here are some happy, wealthy cats living their best lives.',
  },
} as const

type ContentType = keyof typeof CONTENT_CONFIG

export default async function ContentPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params

  if (!['cheap', 'expensive'].includes(type)) {
    notFound()
  }

  const contentType = type as ContentType
  const config = CONTENT_CONFIG[contentType]

  return (
    <div className="mx-auto flex w-full max-w-2xl justify-center py-6">
      <Card className="w-full border-border/70 bg-card/90 shadow-panel animate-fade-up">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <Badge variant="outline" className="font-mono">
              x402 · {config.price} SOL
            </Badge>
          </div>
          <CardTitle className="font-display text-2xl">Exclusive content unlocked</CardTitle>
          <CardDescription className="text-[15px] leading-7">
            {config.message} You paid {config.price}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-border bg-secondary/30 p-6">
            <CatsComponent contentType={contentType} />
          </div>
          <div className="flex justify-center">
            <Button asChild>
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
