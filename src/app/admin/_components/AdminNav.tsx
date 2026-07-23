'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, ShieldCheck } from 'lucide-react'
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
    `text-sm transition-colors hover:text-white ${
      pathname.startsWith(href)
        ? 'text-white font-medium'
        : 'text-slate-300'
    }`

  const links = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/orgs', label: 'Organizations' },
    ...(isAdmin
      ? [
          { href: '/admin/landing', label: 'Landing Page' },
          { href: '/admin/discount-codes', label: 'Discount Codes' },
          { href: '/admin/staff', label: 'Staff' },
        ]
      : []),
  ]

  return (
    <nav className="bg-slate-900 border-b-4 border-amber-400">
      {/* Desktop + mobile top bar */}
      <div className="px-4 md:px-6 py-3 flex items-center gap-6">
        <span className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-900">
            <ShieldCheck size={12} aria-hidden="true" />
            Admin
          </span>
          <span className="font-semibold text-sm text-white">Platform Admin</span>
        </span>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 flex-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
          <div className="ml-auto text-xs text-slate-400">
            {email} · {roleLabel}
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden ml-auto p-1 text-slate-300 hover:text-white"
          onClick={() => setIsOpen((o) => !o)}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-700 bg-slate-900 px-4 py-3 flex flex-col gap-3">
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
          <div className="pt-2 border-t border-slate-700 text-xs text-slate-400">
            {email} · {roleLabel}
          </div>
        </div>
      )}
    </nav>
  )
}
