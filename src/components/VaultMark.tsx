import type { SVGProps } from 'react'

type VaultMarkProps = SVGProps<SVGSVGElement> & {
  title?: string
}

export default function VaultMark({ title, ...props }: VaultMarkProps) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <rect
        x="3.5"
        y="3.5"
        width="33"
        height="33"
        rx="10.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="20" cy="20" r="10" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="2.25" fill="currentColor" />
      <path
        d="M20 10v7.75M30 20h-7.75M20 30v-7.75M10 20h7.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="m13 13 2.1 2.1m11.9-2.1-2.1 2.1m2.1 11.9-2.1-2.1M13 27l2.1-2.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.25"
      />
    </svg>
  )
}