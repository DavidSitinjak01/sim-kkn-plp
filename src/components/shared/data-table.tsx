'use client'

import { useState, useMemo } from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  sortValue?: (row: T) => string | number
  className?: string
  width?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchKeys?: (keyof T)[]
  pageSize?: number
  actions?: React.ReactNode
  emptyMessage?: string
 getRowId: (row: T) => string
}

export function DataTable<T extends Record<string, any>>({
  data, columns, searchable = true, searchKeys, pageSize = 10, actions, emptyMessage = 'Tidak ada data', getRowId
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let result = [...data]
    if (search && searchable) {
      const q = search.toLowerCase()
      const keys = searchKeys || columns.map(c => c.key as keyof T)
      result = result.filter(row =>
        keys.some(k => String(row[k] ?? '').toLowerCase().includes(q))
      )
    }
    if (sortKey) {
      const col = columns.find(c => c.key === sortKey)
      if (col?.sortValue) {
        result.sort((a, b) => {
          const av = col.sortValue!(a)
          const bv = col.sortValue!(b)
          if (av < bv) return sortDir === 'asc' ? -1 : 1
          if (av > bv) return sortDir === 'asc' ? 1 : -1
          return 0
        })
      } else {
        result.sort((a, b) => {
          const av = String(a[sortKey] ?? '')
          const bv = String(b[sortKey] ?? '')
          if (av < bv) return sortDir === 'asc' ? -1 : 1
          if (av > bv) return sortDir === 'asc' ? 1 : -1
          return 0
        })
      }
    }
    return result
  }, [data, search, sortKey, sortDir, columns, searchable, searchKeys])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div className="space-y-3">
      {(searchable || actions) && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          {searchable && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari data..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 h-9"
              />
            </div>
          )}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn("text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground px-4 py-3 whitespace-nowrap", col.className)}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.sortable !== false ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {col.header}
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                    <Inbox className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr key={getRowId(row)} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3 align-middle", col.className)}>
                        {col.render ? col.render(row) : String(row[col.key] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Menampilkan {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} data
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" /> Sebelumnya
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Berikutnya <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
