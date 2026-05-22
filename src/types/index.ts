export interface User {
  id: string
  email: string
  name?: string
  phone?: string
  role?: string
  organization_id?: string
  organization_name?: string
  organization_logo?: string
  organization?: Organization
  supervisor?: boolean
  permissions?: Record<string, boolean>
  lernbar_access?: boolean
  disabled?: boolean
  expires_at?: string
}

export interface Organization {
  id: string
  org_name: string
  logo?: string
  license_type?: string
  max_users?: number
  license_valid_until?: string
}

export interface App {
  id: string
  name: string
  icon: string
  url: string
  permission: string
  isInternal?: boolean
  color?: string
}

export interface AppIconProps {
  icon: string
}
