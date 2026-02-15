import type { VaultClient } from '../types/vault'

export const vaultClient: VaultClient = {
  ping: () => window.vault.ping(),
  createVault: (masterPassword, vaultPath) => window.vault.createVault(masterPassword, vaultPath),
  openVault: (masterPassword, vaultPath) => window.vault.openVault(masterPassword, vaultPath),
  lockVault: () => window.vault.lockVault(),
  isUnlocked: () => window.vault.isUnlocked(),
  changeMasterPassword: (oldPassword, newPassword) => window.vault.changeMasterPassword(oldPassword, newPassword),
  exportEncryptedVault: (copyToPath) => window.vault.exportEncryptedVault(copyToPath),
  getAutoLockMinutes: () => window.vault.getAutoLockMinutes(),
  setAutoLockMinutes: (minutes) => window.vault.setAutoLockMinutes(minutes),
  touchActivity: () => window.vault.touchActivity(),
  listItems: (query) => window.vault.listItems(query),
  getItem: (id) => window.vault.getItem(id),
  createItem: (payload) => window.vault.createItem(payload),
  updateItem: (id, payload) => window.vault.updateItem(id, payload),
  deleteItem: (id) => window.vault.deleteItem(id),
  listTags: () => window.vault.listTags(),
  createTag: (name) => window.vault.createTag(name),
  deleteTag: (id) => window.vault.deleteTag(id),
  setItemTags: (itemId, tagIds) => window.vault.setItemTags(itemId, tagIds),
  onStateChanged: (listener) => window.vault.onStateChanged(listener),
}
