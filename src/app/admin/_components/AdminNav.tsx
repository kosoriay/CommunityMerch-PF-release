'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'

type AdminNavProps = {
  email: string
  platformRole: string | null
  isAdmin: boolean
}

export function AdminNav({ email, platformRole, isAdmin }: AdminNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const roleLabel = platformRole
    ?.replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) ?? ''

  const linkClass = (href: string) =>
    `text-sm hover:text-foreground transition-colors ${
      pathname.startsWith(href)
        ? 'text-foreground font-medium'
        : 'text-muted-foreground'
    }`

  const links = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/orgs', label: 'Organizations' },
    ...(isAdmin
      ? [
          { href: '/admin/discount-codes', label: 'Discount Codes' },
          { href: '/admin/staff', label: 'Staff' },
        ]
      : []),
  ]

  return (
    <nav className="bg-white border-b">
      {/* Desktop + mobile top bar */}
      <div className="px-4 md:px-6 py-3 flex items-center gap-6">
        <span className="font-semibold text-sm shrink-0">Platform Admin</span>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 flex-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
          <div className="ml-auto text-xs text-muted-foreground">
            {email} · {roleLabel}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden ml-auto p-1 text-muted-foreground hover:text-foreground"
          onClick={() => setIsOpen((o) => !o)}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {isOpen && (
        <div className="md:hidden border-t bg-white px-4 py-3 flex flex-col gap-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={linkClass(l.href)}
              onClick={() => setIsOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-2 border-t text-xs text-muted-foreground">
            {email} · {roleLabel}
          </div>
        </div>
      )}
    </nav>
  )
}
