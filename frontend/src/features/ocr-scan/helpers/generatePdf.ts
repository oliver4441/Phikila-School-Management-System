import type { ScanResult } from '../types'
import { DOC_TYPE_LABELS } from '../types'

export async function generatePdf(scan: ScanResult): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF()

  // Title
  doc.setFontSize(18)
  doc.text('Phikila Document Scan', 20, 20)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`File: ${scan.filename}`, 20, 28)
  doc.text(`Type: ${DOC_TYPE_LABELS[scan.document_type] || scan.document_type}`, 20, 34)
  doc.text(`Scanned: ${scan.created_at ? new Date(scan.created_at).toLocaleString() : 'N/A'}`, 20, 40)
  doc.text(`Engine: ${scan.backend_used || 'auto'} · ${scan.processing_time_ms?.toFixed(0) || '?'}ms`, 20, 46)

  doc.setDrawColor(200)
  doc.line(20, 50, 190, 50)

  let y = 58

  // Render parsed data based on type
  if (scan.parsed_data) {
    const data = scan.parsed_data

    if (data.type === 'exam_sheet') {
      const examInfo = data.exam_info as Record<string, string> | undefined
      if (examInfo) {
        doc.setFontSize(12)
        doc.setTextColor(0)
        doc.text('Exam Information', 20, y)
        y += 8
        doc.setFontSize(10)
        for (const [key, val] of Object.entries(examInfo)) {
          if (val) {
            doc.text(`${key.replace(/_/g, ' ')}: ${val}`, 24, y)
            y += 6
          }
        }
        y += 4
      }

      const students = (data.students as Array<Record<string, unknown>>) || []
      const subjects = (data.subjects as string[]) || []

      if (students.length > 0) {
        doc.setFontSize(12)
        doc.text(`Student Results (${students.length} students)`, 20, y)
        y += 10

        // Table header
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('#', 22, y)
        doc.text('Name', 30, y)
        let x = 90
        for (const sub of subjects.slice(0, 5)) {
          doc.text(sub.slice(0, 10), x, y)
          x += 20
        }
        doc.text('Total', x, y)
        y += 2
        doc.line(20, y, 190, y)
        y += 5

        // Table rows
        doc.setFont('helvetica', 'normal')
        for (let i = 0; i < students.length; i++) {
          if (y > 270) {
            doc.addPage()
            y = 20
          }
          const s = students[i]
          doc.text(String(i + 1), 22, y)
          doc.text(String(s.name || '').slice(0, 25), 30, y)
          x = 90
          const scores = (s.scores as Record<string, number>) || {}
          for (const sub of subjects.slice(0, 5)) {
            doc.text(String(scores[sub] ?? '—'), x, y)
            x += 20
          }
          doc.text(String(s.total ?? '—'), x, y)
          y += 6
        }
      }
    } else if (data.type === 'timetable') {
      const entries = (data.entries as Array<Record<string, string>>) || []
      doc.setFontSize(12)
      doc.text(`Timetable (${entries.length} periods)`, 20, y)
      y += 10

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Day', 22, y)
      doc.text('Time', 50, y)
      doc.text('Subject', 85, y)
      doc.text('Teacher', 130, y)
      doc.text('Room', 165, y)
      y += 2
      doc.line(20, y, 190, y)
      y += 5

      doc.setFont('helvetica', 'normal')
      for (const e of entries) {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.text(e.day || '', 22, y)
        doc.text(`${e.start_time || ''}–${e.end_time || ''}`, 50, y)
        doc.text(String(e.subject || '—').slice(0, 20), 85, y)
        doc.text(String(e.teacher || '—').slice(0, 18), 130, y)
        doc.text(String(e.room || '—'), 165, y)
        y += 6
      }
    } else {
      // General — render as key-value pairs
      doc.setFontSize(12)
      doc.text('Extracted Data', 20, y)
      y += 10
      doc.setFontSize(10)
      const kv = (data.key_value_pairs as Record<string, string>) || {}
      for (const [key, val] of Object.entries(kv)) {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.setFont('helvetica', 'bold')
        doc.text(`${key.replace(/_/g, ' ')}:`, 24, y)
        doc.setFont('helvetica', 'normal')
        doc.text(String(val), 80, y)
        y += 7
      }
    }
  }

  // Raw text on a new page if available
  if (scan.raw_text) {
    doc.addPage()
    doc.setFontSize(12)
    doc.text('Raw OCR Text', 20, 20)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(scan.raw_text, 170)
    let ty = 30
    for (const line of lines) {
      if (ty > 275) { doc.addPage(); ty = 20 }
      doc.text(line, 20, ty)
      ty += 5
    }
  }

  doc.save(`phikila-scan-${scan.id}.pdf`)
}
