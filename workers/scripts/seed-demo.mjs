// Idempotent demo-data seeder for multi-school Phikila.
// Re-runs safely: wipes demo rows for each school, then re-seeds in batches.
// Usage: NODE_OPTIONS=--dns-result-order=ipv4first node scripts/seed-demo.mjs
import https from 'node:https'
import dns from 'node:dns'
import { readFileSync } from 'node:fs'

const DNS_CACHE = {
  'api.c-4.us-east-1.aws.neon.tech': ['54.86.249.90', '44.211.114.173', '98.91.36.187'],
  'ep-orange-wind-aiytaow8-pooler.c-4.us-east-1.aws.neon.tech': ['54.86.249.90', '44.211.114.173', '98.91.36.187'],
}

async function resolveIps(hostname) {
  try {
    const { address } = await new Promise((resolve, reject) =>
      dns.lookup(hostname, { family: 4 }, (err, addr) => (err ? reject(err) : resolve({ address: addr }))))
    return [address]
  } catch {
    return DNS_CACHE[hostname] ?? []
  }
}

function httpsOnce(ip, url, init, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: ip,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: init.method || 'GET',
      headers: { ...init.headers, Host: url.hostname },
      timeout: 15000,
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const headers = new Headers()
        for (const [k, v] of Object.entries(res.headers)) {
          if (v !== undefined) headers.append(k, Array.isArray(v) ? v.join(', ') : v)
        }
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers }))
      })
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('connect timeout')))
    if (body) req.write(body)
    req.end()
  })
}

async function ipv4Fetch(input, init = {}) {
  const url = new URL(input)
  const body = init.body ?? null
  const ips = await resolveIps(url.hostname)
  let lastErr
  for (const ip of ips) {
    try {
      return await httpsOnce(ip, url, init, body)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? new Error(`no addresses for ${url.hostname}`)
}

globalThis.fetch = ipv4Fetch
const { neon } = await import('@neondatabase/serverless')

const vars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').split(/\r?\n/)
const url = vars.find((l) => l.startsWith('DATABASE_URL')).split('=').slice(1).join('=').trim()
  .replace(/^"|"$/g, '').replace(/^'|'$/g, '')
const sql = neon(url)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function retry(fn, tries = 6) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      await sleep(1500 * (i + 1))
    }
  }
  throw lastErr
}

const SCHOOLS = [
  {
    id: 1, label: 'Grade', levels: ['Grade 1', 'Grade 2', 'Grade 3'],
    classes: ['Grade 1 East', 'Grade 2 East', 'Grade 3 East'],
    teacherNames: ['Amina Yusuf', 'Brian Otieno', 'Catherine Wanjiku', 'Daniel Mwangi', 'Esther Achieng', 'Francis Njoroge'],
    adminEmail: 'peter@phikila.com',
  },
  {
    id: 2, label: 'Form', levels: ['Form 1', 'Form 2', 'Form 3'],
    classes: ['Form 1 West', 'Form 2 West', 'Form 3 West'],
    teacherNames: ['Grace Kiprono', 'John Kamau', 'Mercy Chebet', 'Samuel Mutiso', 'Nancy Wangari', 'Peter Kariuki'],
    adminEmail: 'grace@phikila.com',
  },
]

const SUBJECTS = ['Mathematics', 'English', 'Kiswahili', 'Science and Technology', 'Social Studies', 'CRE', 'Physical Education', 'Art and Craft']
const FIRST = ['Wanjiru', 'Brian', 'Amina', 'Kevin', 'Brenda', 'Collins', 'Diana', 'Erick', 'Fiona', 'George', 'Hellen', 'Ian']
const LAST = ['Kamau', 'Otieno', 'Yusuf', 'Mutiso', 'Njeri', 'Omondi', 'Wambui', 'Kipchoge', 'Chebet', 'Maina', 'Achieng', 'Mwangi']

async function exec(sqlString) {
  const r = await retry(() => sql`${sql.unsafe(sqlString)}`)
  return r
}

/** Multi-row insert; returns the `id` values in row order. */
async function batch(table, cols, rows) {
  if (!rows.length) return []
  const placeholders = rows.map((_, r) => `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(', ')})`).join(', ')
  const params = rows.flatMap((row) => cols.map((col) => row[col]))
  const q = `insert into ${table} (${cols.join(', ')}) values ${placeholders} returning id`
  const raw = await retry(() => sql.query(q, params))
  return raw.map((r) => r.id)
}

async function cleanup(sid) {
  const del = async (q) => { await retry(() => sql`${sql.unsafe(q)}`) }
  const withSchool = (table) => `delete from ${table} where school_id = ${sid}`
  const q = [
    'student_invoices', 'payments', 'fee_structures', 'exam_series', 'grade_scale', 'examinations',
    'attendance_sessions', 'library_books', 'inventory_items', 'board_meetings', 'board_members',
    'announcements', 'principal_insights', 'admission_applications', 'class_registers', 'health_records',
    'welfare_cases', 'enrollment_records', 'tt_constraints', 'tt_lesson_requirements', 'tt_versions',
    'tt_days', 'tt_periods', 'tt_rooms', 'tt_subjects', 'tt_classes', 'tt_teachers', 'teachers', 'students', 'terms',
    'academic_years', 'departments', 'subjects', 'streams', 'levels',
  ].map(withSchool)
  q.push(`delete from exam_entries where exam_subject_id in (select id from exam_subjects where examination_id in (select id from examinations where school_id = ${sid}))`)
  q.push(`delete from exam_subjects where examination_id in (select id from examinations where school_id = ${sid})`)
  q.push(`delete from attendance_records where session_id in (select id from attendance_sessions where school_id = ${sid})`)
  q.push(`delete from library_loans where book_id in (select id from library_books where school_id = ${sid})`)
  q.push(`delete from inventory_movements where item_id in (select id from inventory_items where school_id = ${sid})`)
  q.push(`delete from board_resolutions where meeting_id in (select id from board_meetings where school_id = ${sid})`)
  q.push(`delete from student_documents where student_id in (select id from students where school_id = ${sid})`)
  q.push(`delete from guardians where student_id in (select id from students where school_id = ${sid})`)
  q.push(`delete from tt_lessons where version_id in (select id from tt_versions where school_id = ${sid})`)
  q.push(`delete from tt_solver_jobs where version_id in (select id from tt_versions where school_id = ${sid})`)
  q.push(`delete from qualifications where teacher_id in (select id from teachers where school_id = ${sid})`)
  q.push(`delete from availabilities where teacher_id in (select id from teachers where school_id = ${sid})`)
  for (const s of q) await del(s)
}

async function seedSchool(s) {
  const sid = s.id
  await cleanup(sid)

  const adminUser = await retry(() => sql`select id from users where email = ${s.adminEmail} limit 1`)
  const publishedBy = adminUser[0]?.id ?? null

  const levelIds = await batch('levels', ['name', 'description', 'sort_order', 'school_id'],
    s.levels.map((name, i) => ({ name, description: `${name} cohort`, sort_order: i + 1, school_id: sid })))
  const [streamEast, streamWest] = (await batch('streams', ['level_id', 'name', 'school_id'], [
    { level_id: levelIds[0], name: 'East', school_id: sid },
    { level_id: levelIds[0], name: 'West', school_id: sid },
  ]))

  const subjects = SUBJECTS.map((name) => ({ name, code: name.split(' ').map((w) => w[0]).join('').toUpperCase(), category: 'core', description: `${name} subject`, school_id: sid }))
  await batch('subjects', ['name', 'code', 'category', 'description', 'school_id'], subjects)
  await batch('tt_subjects', ['name', 'code', 'category', 'school_id'], SUBJECTS.map((name) => ({ name, code: name.split(' ').map((w) => w[0]).join('').toUpperCase(), category: 'core', school_id: sid })))

  await batch('departments', ['name', 'description', 'head_of_department', 'school_id'], [
    { name: 'Academic', description: 'Teaching and learning', head_of_department: s.teacherNames[0], school_id: sid },
    { name: 'Co-curricular', description: 'Sports and clubs', head_of_department: s.teacherNames[1], school_id: sid },
  ])

  const yearId = (await batch('academic_years', ['name', 'start_date', 'end_date', 'is_current', 'school_id'],
    [{ name: '2026', start_date: '2026-01-01', end_date: '2026-12-31', is_current: true, school_id: sid }]))[0]
  const termIds = await batch('terms', ['year_id', 'name', 'start_date', 'end_date', 'school_id'],
    [['Term 1', '2026-01-05', '2026-04-10'], ['Term 2', '2026-04-27', '2026-07-31'], ['Term 3', '2026-09-01', '2026-11-27']]
      .map(([name, st, en]) => ({ year_id: yearId, name, start_date: st, end_date: en, school_id: sid })))

  const teacherIds = await batch('teachers', ['staff_number', 'first_name', 'last_name', 'email', 'phone', 'gender', 'employment_status', 'subject_specialization', 'school_id'],
    s.teacherNames.map((full, i) => {
      const [fn, ln] = full.split(' ')
      return {
        staff_number: `STF-${sid}-${100 + i}`, first_name: fn, last_name: ln,
        email: `${fn}.${ln}@phikila.com`.toLowerCase(), phone: `+2547${String(10000000 + i * 111111)}`,
        gender: i % 2 === 0 ? 'female' : 'male', employment_status: 'permanent',
        subject_specialization: SUBJECTS[i % SUBJECTS.length], school_id: sid,
      }
    }))

  await batch('tt_teachers', ['name', 'email', 'subject_specialization', 'max_periods', 'code', 'department', 'max_lessons_per_day', 'max_consecutive', 'workload_target', 'is_active', 'school_id'],
    s.teacherNames.map((full, i) => {
      const [fn, ln] = full.split(' ')
      return {
        name: full, email: `${fn}.${ln}@phikila.com`.toLowerCase(), subject_specialization: SUBJECTS[i % SUBJECTS.length],
        max_periods: 30, code: `TT-STF-${sid}-${i}`, department: i % 2 === 0 ? 'Academic' : 'Co-curricular',
        max_lessons_per_day: 6, max_consecutive: 2, workload_target: 25, is_active: true, school_id: sid,
      }
    }))

  await batch('tt_rooms', ['name', 'capacity', 'room_type', 'code', 'building', 'is_accessible', 'school_id'],
    [{ name: 'Room 1', capacity: 40, room_type: 'Classroom', code: 'R1', building: 'Main Block', is_accessible: true, school_id: sid },
     { name: 'Room 2', capacity: 40, room_type: 'Classroom', code: 'R2', building: 'Main Block', is_accessible: true, school_id: sid },
     { name: 'Science Lab', capacity: 30, room_type: 'Laboratory', code: 'LAB1', building: 'Science Wing', is_accessible: false, school_id: sid }])

  const classIds = await batch('tt_classes', ['name', 'level', 'stream', 'class_teacher_id', 'size', 'code', 'grade', 'student_count', 'school_id'],
    s.classes.map((name, i) => {
      const grade = i + 1
      const stream = i % 2 === 0 ? 'East' : 'West'
      return {
        name, level: s.label, stream, class_teacher_id: teacherIds[i % teacherIds.length], size: 40,
        code: `${s.label[0]}-${grade}-${i % 2 === 0 ? 'E' : 'W'}`, grade, student_count: 0, school_id: sid,
      }
    }))
  await batch('class_registers', ['class_name', 'level', 'stream', 'capacity', 'class_teacher_id', 'academic_year', 'school_id'],
    s.classes.map((name, i) => ({ class_name: name, level: s.label, stream: i % 2 === 0 ? 'East' : 'West', capacity: 40, class_teacher_id: teacherIds[i % teacherIds.length], academic_year: '2026', school_id: sid })))

  await batch('tt_days', ['name', 'day_of_week', 'is_active', 'school_id'],
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d, i) => ({ name: d, day_of_week: i + 1, is_active: true, school_id: sid })))
  const periods = [['08:00', '08:40'], ['08:40', '09:20'], ['09:20', '10:00'], ['10:00', '10:40'], ['11:00', '11:40'], ['11:40', '12:20'], ['12:20', '13:00'], ['14:00', '14:40']]
  await batch('tt_periods', ['name', 'start_time', 'end_time', 'is_break', 'is_teaching', 'sort_index', 'school_id'],
    periods.map(([st, en], i) => ({ name: `Period ${i + 1}`, start_time: st, end_time: en, is_break: false, is_teaching: true, sort_index: i + 1, school_id: sid })))

  const studentRows = []
  for (let c = 0; c < classIds.length; c++) {
    for (let i = 0; i < 4 + c; i++) {
      const fn = FIRST[(c + i) % FIRST.length]
      const ln = LAST[(c * 2 + i) % LAST.length]
      studentRows.push({
        admission_number: `ADM-${sid}-${String(100 + c * 10 + i).padStart(4, '0')}`,
        first_name: fn, middle_name: null, last_name: ln,
        gender: i % 2 === 0 ? 'female' : 'male',
        date_of_birth: `2012-0${(i % 9) + 1}-${String(10 + (i % 18)).padStart(2, '0')}`,
        status: 'active', current_class_id: classIds[c], level_id: levelIds[c % levelIds.length],
        stream_id: c % 2 === 0 ? streamEast : streamWest, admission_date: '2026-01-05', school_id: sid,
      })
    }
  }
  const studentIds = await batch('students', ['admission_number', 'first_name', 'middle_name', 'last_name', 'gender', 'date_of_birth', 'status', 'current_class_id', 'level_id', 'stream_id', 'admission_date', 'school_id'], studentRows)

  await batch('enrollment_records', ['student_id', 'admission_date', 'academic_year', 'level', 'stream', 'admission_type', 'status', 'class_id', 'level_id', 'stream_id', 'school_id'],
    studentIds.map((id, i) => ({
      student_id: id, admission_date: '2026-01-05', academic_year: '2026', level: `${s.label} ${(i % 3) + 1}`,
      stream: i % 2 === 0 ? 'East' : 'West', admission_type: 'new', status: 'enrolled',
      class_id: classIds[i % classIds.length], level_id: levelIds[i % levelIds.length],
      stream_id: i % 2 === 0 ? streamEast : streamWest, school_id: sid,
    })))
  await batch('guardians', ['student_id', 'parent_name', 'relationship_to_student', 'phone_number', 'email', 'is_emergency_contact'],
    studentIds.map((id, i) => ({
      student_id: id, parent_name: `${LAST[i % LAST.length]} ${FIRST[i % FIRST.length]} (Parent)`,
      relationship_to_student: 'parent', phone_number: `+2547${String(20000000 + i * 77777)}`,
      email: `parent.${FIRST[i % FIRST.length]}@gmail.com`.toLowerCase(), is_emergency_contact: true,
    })))

  const feeId = (await batch('fee_structures', ['name', 'amount', 'academic_year_id', 'term_id', 'level_id', 'currency', 'status', 'category', 'frequency', 'school_id'],
    [{ name: 'Annual tuition', amount: sid === 1 ? 45000 : 68000, academic_year_id: yearId, term_id: termIds[0], level_id: levelIds[0], currency: 'KES', status: 'active', category: 'tuition', frequency: 'annual', school_id: sid }]))[0]

  const amount = sid === 1 ? 45000 : 68000
  await batch('student_invoices', ['invoice_number', 'student_id', 'fee_structure_id', 'amount', 'status', 'due_date', 'term', 'academic_year', 'school_id'],
    studentIds.slice(0, 5).map((id, i) => ({
      invoice_number: `INV-${sid}-2026-${String(100 + i)}`, student_id: id, fee_structure_id: feeId, amount,
      status: i % 3 === 0 ? 'paid' : 'pending', due_date: '2026-04-15', term: 'Term 1', academic_year: '2026', school_id: sid,
    })))

  await batch('library_books', ['title', 'author', 'isbn', 'category', 'total_copies', 'available_copies', 'status', 'school_id'],
    [{ title: 'The River Between', author: "Ngugi wa Thiong'o", isbn: '9780435275484', category: 'fiction', total_copies: 12, available_copies: 10, status: 'active', school_id: sid },
     { title: "A Doll's House", author: 'Henrik Ibsen', isbn: '9780486270623', category: 'drama', total_copies: 8, available_copies: 8, status: 'active', school_id: sid },
     { title: 'The Pearl', author: 'John Steinbeck', isbn: '9780140177374', category: 'novel', total_copies: 10, available_copies: 9, status: 'active', school_id: sid }])
  await batch('inventory_items', ['name', 'category', 'quantity', 'unit', 'reorder_level', 'unit_cost', 'status', 'school_id'],
    [{ name: 'Exercise books', category: 'stationery', quantity: 240, unit: 'pieces', reorder_level: 50, unit_cost: 120, status: 'In Stock', school_id: sid },
     { name: 'Ballpoint pens', category: 'stationery', quantity: 180, unit: 'pieces', reorder_level: 40, unit_cost: 40, status: 'In Stock', school_id: sid },
     { name: 'Chalk (boxes)', category: 'teaching', quantity: 30, unit: 'boxes', reorder_level: 8, unit_cost: 350, status: 'In Stock', school_id: sid }])
  await batch('announcements', ['title', 'body', 'audience', 'priority', 'status', 'published_by', 'published_at', 'school_id'],
    [{ title: 'Term 2 begins Monday', body: 'Reporting time is 7:45 a.m.', audience: 'everyone', priority: 'normal', status: 'published', published_by: publishedBy, published_at: new Date().toISOString(), school_id: sid },
     { title: 'Mid-term exams', body: 'Mid-term exams run next week.', audience: 'students', priority: 'high', status: 'published', published_by: publishedBy, published_at: new Date().toISOString(), school_id: sid }])
  await batch('board_members', ['full_name', 'position', 'email', 'phone', 'status', 'school_id'],
    [{ full_name: 'Mr. James Ochieng', position: 'Chairperson', email: 'chair@phikila.com', phone: '+254711000001', status: 'active', school_id: sid },
     { full_name: 'Mrs. Faith Muthoni', position: 'Secretary', email: 'secretary@phikila.com', phone: '+254711000002', status: 'active', school_id: sid }])
  await batch('health_records', ['student_id', 'record_type', 'date', 'title', 'description', 'school_id'],
    [{ student_id: studentIds[0], record_type: 'checkup', date: '2026-03-10', title: 'Routine checkup', description: 'Height and weight measured.', school_id: sid },
     { student_id: studentIds[1], record_type: 'allergy', date: '2026-02-20', title: 'Pollen allergy', description: 'Seasonal rhinitis; carry antihistamine.', school_id: sid }])
  await batch('admission_applications', ['application_number', 'first_name', 'last_name', 'gender', 'applying_for_level', 'parent_name', 'parent_phone', 'parent_email', 'status', 'school_id'],
    [{ application_number: `APP-${sid}-2026-001`, first_name: 'Linda', last_name: 'Adhiambo', gender: 'female', applying_for_level: `${s.label} 1`, parent_name: 'Mary Adhiambo', parent_phone: '+254722000001', parent_email: 'mary.adhiambo@gmail.com', status: 'pending', school_id: sid },
     { application_number: `APP-${sid}-2026-002`, first_name: 'Victor', last_name: 'Barasa', gender: 'male', applying_for_level: `${s.label} 2`, parent_name: 'Paul Barasa', parent_phone: '+254722000002', parent_email: 'paul.barasa@gmail.com', status: 'pending', school_id: sid }])

  console.log(`school ${sid}: seeded`)
}

for (const s of SCHOOLS) await seedSchool(s)
console.log('done')
process.exit(0)