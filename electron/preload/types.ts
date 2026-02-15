export type VaultItemType = 'password' | 'note'

export type VaultTag = {
  id: string
  name: string
}

export type VaultItem = {
  id: string
  type: VaultItemType
  name: string
  username: string | null
  password: string | null
  url: string | null
  notes: string | null
  createdAt: number
  updatedAt: number
  tags: VaultTag[]
}

export type CreateItemPayload = {
  type: VaultItemType
  name: string
  username?: string | null
  password?: string | null
  url?: string | null
  notes?: string | null
}

export type UpdateItemPayload = Partial<CreateItemPayload>

export type VaultOpenResult = {
  unlocked: boolean
  vaultPath: string | null
}

export type VaultResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

export type VaultApi = {
  ping: () => Promise<string>
  createVault: (masterPassword: string, vaultPath?: string) => Promise<VaultResponse<VaultOpenResult>>
  openVault: (masterPassword: string, vaultPath: string) => Promise<VaultResponse<VaultOpenResult>>
  lockVault: () => Promise<{ unlocked: false }>
  isUnlocked: () => Promise<boolean>
  changeMasterPassword: (oldPassword: string, newPassword: string) => Promise<boolean>
  exportEncryptedVault: (copyToPath: string) => Promise<boolean>
  getAutoLockMinutes: () => Promise<number>
  setAutoLockMinutes: (minutes: number) => Promise<number>
  touchActivity: () => Promise<boolean>
  listItems: (query?: string) => Promise<VaultItem[]>
  getItem: (id: string) => Promise<VaultItem | null>
  createItem: (payload: CreateItemPayload) => Promise<VaultItem>
  updateItem: (id: string, payload: UpdateItemPayload) => Promise<VaultItem | null>
  deleteItem: (id: string) => Promise<boolean>
  listTags: () => Promise<VaultTag[]>
  createTag: (name: string) => Promise<VaultTag>
  deleteTag: (id: string) => Promise<boolean>
  setItemTags: (itemId: string, tagIds: string[]) => Promise<boolean>
  onStateChanged: (listener: (state: { unlocked: boolean }) => void) => () => void
}

export type ShellApi = {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<boolean>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  reload: () => Promise<void>
  toggleDevTools: () => Promise<boolean>
  zoomIn: () => Promise<number>
  zoomOut: () => Promise<number>
  zoomReset: () => Promise<number>
  copyText: (text: string) => Promise<boolean>
  copySecret: (text: string, clearAfterMs?: number) => Promise<boolean>
  openImportDialog: () => Promise<string | null>
  openExportDialog: () => Promise<string | null>
}
