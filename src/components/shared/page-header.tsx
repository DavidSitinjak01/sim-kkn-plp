'use client'

import { Fragment } from 'react'
import { motion } from 'framer-motion'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

interface PageHeaderProps {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
  breadcrumb?: string[]
}

export function PageHeader({ title, description, icon: Icon, actions, breadcrumb }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6"
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          {breadcrumb && breadcrumb.length > 0 && (
            <Breadcrumb className="mb-1">
              <BreadcrumbList>
                <BreadcrumbItem><span className="text-xs text-muted-foreground">SIM KKN & PLP</span></BreadcrumbItem>
                {breadcrumb.map((b, i) => (
                  <Fragment key={i}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {i === breadcrumb.length - 1 ? (
                        <BreadcrumbPage className="text-xs font-medium">{b}</BreadcrumbPage>
                      ) : (
                        <span className="text-xs text-muted-foreground">{b}</span>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </motion.div>
  )
}
