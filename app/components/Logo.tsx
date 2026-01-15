import Image from 'next/image'
import Link from 'next/link'

export default function Logo({ 
  href = '/events', 
  className = '',
  showText = true,
  size = 40
}: { 
  href?: string
  className?: string
  showText?: boolean
  size?: number
}) {
  return (
    <Link href={href} className={`flex items-center space-x-2 ${className}`}>
      <Image
        src="/SSALOGO-1.png"
        alt="Somali Student Association"
        width={size}
        height={size}
        className="object-contain rounded-full"
        priority
      />
      {showText && (
        <span className="text-2xl font-bold text-sky-600 hover:text-sky-700">SSA Events</span>
      )}
    </Link>
  )
}

