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

export type VaultResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

export type VaultClient = {
  ping: () => Promise<string>
  createVault: (masterPassword: string, vaultPath?: string) => Promise<VaultResponse<{ unlocked: boolean; vaultPath: string | null }>>
  openVault: (masterPassword: string, vaultPath: string) => Promise<VaultResponse<{ unlocked: boolean; vaultPath: string | null }>>
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
