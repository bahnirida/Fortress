export type VaultEntryType = 'password' | 'note';

export type VaultEntry = {
    id: string;
    type: VaultEntryType;
    title: string;
    username?: string;
    url?: string;
    favorite?: boolean;
    updatedAt: string;
};

export type VaultApi = {
    ping: () => Promise<string>;

    listEntries: () => Promise<VaultEntry[]>;
    getEntry: (id: string) => Promise<VaultEntry | null>;
};

export type ShellApi = {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
};
