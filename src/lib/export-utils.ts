'use client'

import { toast } from 'sonner'

/**
 * Export data to CSV (opens as Excel-compatible)
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  try {
    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => {
        const s = String(c ?? '')
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(','))
    ].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Data berhasil diexport ke ${filename}.csv`)
  } catch (e) {
    toast.error('Gagal export data')
  }
}

/**
 * Print the current visible area (opens print dialog)
 */
export function printData(title: string, contentHtml: string) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    toast.error('Popup diblokir. Izinkan popup untuk mencetak.')
    return
  }
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        * { font-family: Arial, sans-serif; box-sizing: border-box; }
        body { padding: 30px; color: #1a1a1a; }
        .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { font-size: 18px; margin: 0; color: #2563eb; }
        .header p { font-size: 12px; color: #666; margin: 4px 0; }
        h2 { font-size: 14px; color: #333; margin: 20px 0 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #2563eb; color: white; padding: 8px; text-align: left; }
        td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9fafb; }
        .footer { margin-top: 30px; text-align: right; font-size: 11px; color: #666; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>UNIVERSITAS NUSANTARA JAYA</h1>
        <p>Sistem Informasi Manajemen KKN & PLP</p>
        <p>Jl. Pendidikan No. 1, Jakarta Selatan | Telp: 021-12345678</p>
      </div>
      ${contentHtml}
      <div class="footer">
        <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
        <p>© SIM KKN & PLP — Universitas Nusantara Jaya</p>
      </div>
    </body>
    </html>
  `)
  win.document.close()
  setTimeout(() => win.print(), 300)
}

/**
 * Generate a simple PDF-like printable document
 */
export function exportToPDF(title: string, contentHtml: string) {
  printData(title, contentHtml)
}

/**
 * Format date to Indonesian format
 */
export function formatDate(date: string | Date, withTime = false): string {
  const d = new Date(date)
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long', year: 'numeric' }
  return d.toLocaleDateString('id-ID', opts)
}

export function formatDateShort(date: string | Date): string {
  return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Generate a table HTML for print/PDF
 */
export function generateTableHTML(title: string, headers: string[], rows: (string | number)[][]): string {
  return `
    <h2>${title}</h2>
    <table>
      <thead>
        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(r => `<tr>${r.map(c => `<td>${c ?? '-'}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `
}
