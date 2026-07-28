// ============ Dynamic Form Builder — shared types & helpers ============
// Used by both API routes (server) and React views (client).

export type FieldType =
  | 'text'          // single line text
  | 'textarea'      // multi line text
  | 'number'        // numeric input
  | 'email'         // email input
  | 'tel'           // phone input
  | 'date'          // date picker (input type=date)
  | 'select'        // dropdown, uses options
  | 'radio'         // radio buttons, uses options
  | 'checkbox'      // single boolean checkbox (value "true"/"false")
  | 'file-image'    // image upload (stored as base64 data URL, max 5MB, jpg/png/webp)

export interface FormFieldDef {
  id: string          // unique id (cuid or nanoid-ish) for the field
  key: string         // slug identifier, e.g. "namaLengkap", "email", "ipk". Used as response key.
  label: string       // label shown to student, e.g. "Nama Lengkap"
  type: FieldType
  required: boolean
  helpText?: string   // optional help/instruction text
  placeholder?: string
  options?: string[]  // for select/radio/checkbox-multiple
  order: number       // display order
}

// All field types that can be selected in the builder UI.
export const FIELD_TYPES: { value: FieldType; label: string; needsOptions?: boolean }[] = [
  { value: 'text', label: 'Teks Pendek' },
  { value: 'textarea', label: 'Teks Panjang' },
  { value: 'number', label: 'Angka' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Nomor Telepon' },
  { value: 'date', label: 'Tanggal' },
  { value: 'select', label: 'Dropdown (Pilihan)', needsOptions: true },
  { value: 'radio', label: 'Radio (Pilihan)', needsOptions: true },
  { value: 'checkbox', label: 'Centang (Ya/Tidak)' },
  { value: 'file-image', label: 'Unggah Foto' },
]

// ============ System field keys (for import-to-mahasiswa compatibility) ============
// A field whose `key` matches one of these is treated as a "system field"
// whose value can be mapped to columns on the Mahasiswa / Pendaftaran table
// during the import flow.
export const SYSTEM_FIELD_KEYS = {
  namaLengkap: 'namaLengkap',
  nim: 'nim',
  jenisKelamin: 'jenisKelamin',
  noWa: 'noWa',
  alamat: 'alamat',
  foto: 'foto',
  prodiNama: 'prodiNama',
  jurusan: 'jurusan',
} as const

// System fields required for a successful import-to-mahasiswa.
export const REQUIRED_SYSTEM_KEYS: string[] = [
  'namaLengkap',
  'nim',
  'jenisKelamin',
  'noWa',
  'alamat',
]

// Pre-configured "system field" templates for the "Tambah Field Sistem" UI.
export const SYSTEM_FIELD_TEMPLATES: Omit<FormFieldDef, 'id' | 'order'>[] = [
  {
    key: 'namaLengkap',
    label: 'Nama Lengkap',
    type: 'text',
    required: true,
    placeholder: 'cth. Budi Santoso',
    helpText: 'Sesuai KTP / KTM',
  },
  {
    key: 'nim',
    label: 'NIM (Nomor Induk Mahasiswa)',
    type: 'text',
    required: true,
    placeholder: 'cth. 2021010001',
    helpText: 'NIM unik, tidak boleh sama dengan mahasiswa lain',
  },
  {
    key: 'jenisKelamin',
    label: 'Jenis Kelamin',
    type: 'radio',
    required: true,
    options: ['L', 'P'],
    helpText: 'L = Laki-laki, P = Perempuan',
  },
  {
    key: 'noWa',
    label: 'Nomor WhatsApp',
    type: 'tel',
    required: true,
    placeholder: 'cth. 0812xxxxxxx',
    helpText: 'Nomor WhatsApp aktif untuk dihubungi panitia',
  },
  {
    key: 'alamat',
    label: 'Alamat',
    type: 'textarea',
    required: true,
    placeholder: 'Alamat lengkap domisili',
  },
  {
    key: 'foto',
    label: 'Pas Foto 3x4',
    type: 'file-image',
    required: false,
    helpText: 'Format JPG/PNG/WebP, maksimal 5MB',
  },
  {
    key: 'prodiNama',
    label: 'Program Studi',
    type: 'text',
    required: false,
    placeholder: 'cth. Pendidikan Ekonomi',
    helpText: 'Diisi bebas; admin akan memilih prodi yang sesuai saat import',
  },
  {
    key: 'jurusan',
    label: 'Jurusan / Fakultas',
    type: 'text',
    required: false,
    placeholder: 'cth. FKIP',
    helpText: 'Informasional saja',
  },
]

// ============ Helpers ============

// Parse the JSON `fields` string stored on FormPendaftaran into a typed array.
// Always returns an array (defensive: never throws).
export function parseFormFields(raw: string | null | undefined): FormFieldDef[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as FormFieldDef[]
  } catch {
    return []
  }
}

// Parse the JSON `data` string stored on PendaftaranResponse into an object.
export function parseResponseData(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

// Validate that field keys are unique within the array (returns the first dup key or null).
export function findDuplicateFieldKey(fields: FormFieldDef[]): string | null {
  const seen = new Set<string>()
  for (const f of fields) {
    if (seen.has(f.key)) return f.key
    seen.add(f.key)
  }
  return null
}

// Generate a slug-like field key from a label.
export function slugifyKey(label: string): string {
  return (label || '')
    .trim()
    .toLowerCase()
    // remove diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // non-alphanumeric → nothing (camelCase-ish by stripping spaces)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+(.)/g, (_, c) => String(c).toUpperCase())
    .replace(/\s+/g, '')
}

// Generate a pseudo-unique id without external deps.
export function generateFieldId(): string {
  return 'fld_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
