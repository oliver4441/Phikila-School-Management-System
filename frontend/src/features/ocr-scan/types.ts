export type DocumentType = 'exam_sheet' | 'student_document' | 'timetable' | 'general'

export interface ScanResult {
  id: number
  filename: string
  document_type: string
  backend_used: string | null
  processing_time_ms: number | null
  parsed_data: Record<string, unknown> | null
  raw_text: string | null
  error: string | null
  status: string
  created_at: string | null
}

export interface BackendInfo {
  name: string
  available: boolean
  label: string
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  exam_sheet: 'Exam / Results',
  student_document: 'Student Document',
  timetable: 'Timetable',
  general: 'General Document',
  auto: 'Auto-detect',
}
