import Dexie, { type Table } from 'dexie';
import { 
  Project, 
  ProjectUrl, 
  Credential, 
  Hosting, 
  DatabaseInfo, 
  Service, 
  DomainInfo, 
  Contact, 
  Attachment, 
  Activity, 
  VaultSettings 
} from '@/types';

export class SiteVaultDB extends Dexie {
  projects!: Table<Project, string>;
  urls!: Table<ProjectUrl, string>;
  credentials!: Table<Credential, string>;
  hosting!: Table<Hosting, string>;
  databases!: Table<DatabaseInfo, string>;
  services!: Table<Service, string>;
  domains!: Table<DomainInfo, string>;
  contacts!: Table<Contact, string>;
  attachments!: Table<Attachment, string>;
  activities!: Table<Activity, string>;
  settings!: Table<VaultSettings, string>;

  constructor() {
    super('SiteVaultDB');
    this.version(1).stores({
      projects: 'id, name, clientName, status, color, isFavorite, isPinned, createdAt, deletedAt',
      urls: 'id, projectId, category',
      credentials: 'id, projectId',
      hosting: 'id, projectId',
      databases: 'id, projectId',
      services: 'id, projectId, name',
      domains: 'id, projectId, registrar',
      contacts: 'id, projectId, role',
      attachments: 'id, projectId, name, type',
      activities: 'id, projectId, action, createdAt',
      settings: 'key'
    });

    this.version(2).stores({
      projects: 'id, name, status, color, isFavorite, isPinned, createdAt, deletedAt',
      urls: 'id, projectId, category',
      credentials: 'id, projectId',
      hosting: 'id, projectId',
      databases: 'id, projectId',
      services: 'id, projectId, name',
      domains: 'id, projectId, registrar',
      contacts: 'id, projectId, role',
      attachments: 'id, projectId, name, type',
      activities: 'id, projectId, action, createdAt',
      settings: 'key'
    });
  }
}

// Instantiate database instance
export const db = new SiteVaultDB();

// Clear all local database tables
export async function clearAllTables() {
  await Promise.all([
    db.projects.clear(),
    db.urls.clear(),
    db.credentials.clear(),
    db.hosting.clear(),
    db.databases.clear(),
    db.services.clear(),
    db.domains.clear(),
    db.contacts.clear(),
    db.attachments.clear(),
    db.activities.clear(),
    db.settings.clear()
  ]);
}
