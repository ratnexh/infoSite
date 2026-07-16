import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/db/dexie-db';
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
  ProjectStatus 
} from '@/types';
import { encryptText, decryptText } from '@/lib/crypto/web-crypto';

// ACTIVITY LOGGER HELPER
export const ActivityRepository = {
  async getAll(): Promise<Activity[]> {
    return await db.activities.orderBy('createdAt').reverse().toArray();
  },

  async getByProjectId(projectId: string): Promise<Activity[]> {
    return await db.activities
      .where('projectId')
      .equals(projectId)
      .reverse()
      .sortBy('createdAt');
  },

  async log(projectId: string | null, action: Activity['action'], details: string): Promise<Activity> {
    let projectName = undefined;
    if (projectId) {
      const proj = await db.projects.get(projectId);
      if (proj) projectName = proj.name;
    }
    const logEntry: Activity = {
      id: uuidv4(),
      projectId,
      projectName,
      action,
      details,
      createdAt: new Date()
    };
    await db.activities.add(logEntry);
    return logEntry;
  }
};

// POSITION REORDERING HELPERS
async function ensureSequentialPositions<T extends { id: string; position?: number }>(
  list: T[], 
  table: any
): Promise<T[]> {
  let updated = false;
  const processed = list.map((item, index) => {
    const expectedPos = index + 1;
    if (item.position !== expectedPos) {
      item.position = expectedPos;
      updated = true;
    }
    return item;
  });
  if (updated) {
    for (const item of processed) {
      await table.put(item);
    }
  }
  return processed;
}

async function reorderListItem<T extends { id: string; position?: number }>(
  id: string,
  direction: 'up' | 'down',
  getItems: () => Promise<T[]>,
  table: any
): Promise<void> {
  const items = await getItems();
  const sorted = [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const processed = await ensureSequentialPositions(sorted, table);

  const index = processed.findIndex(item => item.id === id);
  if (index === -1) return;

  if (direction === 'up' && index > 0) {
    const prev = processed[index - 1];
    const curr = processed[index];
    const tempPos = curr.position;
    curr.position = prev.position;
    prev.position = tempPos;
    await table.put(curr);
    await table.put(prev);
  } else if (direction === 'down' && index < processed.length - 1) {
    const next = processed[index + 1];
    const curr = processed[index];
    const tempPos = curr.position;
    curr.position = next.position;
    next.position = tempPos;
    await table.put(curr);
    await table.put(next);
  }
}

async function swapItemPositions<T extends { id: string; position?: number }>(
  idA: string,
  idB: string,
  getItems: () => Promise<T[]>,
  table: any
): Promise<void> {
  const items = await getItems();
  const sorted = [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const processed = await ensureSequentialPositions(sorted, table);

  const itemA = processed.find(item => item.id === idA);
  const itemB = processed.find(item => item.id === idB);
  if (!itemA || !itemB) return;

  const tempPos = itemA.position;
  itemA.position = itemB.position;
  itemB.position = tempPos;

  await table.put(itemA);
  await table.put(itemB);
}

// PROJECT REPOSITORY
export const ProjectRepository = {
  async getAll(includeDeleted = false): Promise<Project[]> {
    const list = await db.projects.toArray();
    const sorted = list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (includeDeleted) return sorted;
    return sorted.filter(p => !p.deletedAt);
  },

  async getArchived(): Promise<Project[]> {
    return await db.projects
      .where('status')
      .equals('archived')
      .and(p => !p.deletedAt)
      .reverse()
      .sortBy('createdAt');
  },

  async getDeleted(): Promise<Project[]> {
    return (await db.projects.toArray())
      .filter(p => p.deletedAt !== null)
      .sort((a, b) => b.deletedAt!.getTime() - a.deletedAt!.getTime());
  },

  async getById(id: string): Promise<Project | undefined> {
    return await db.projects.get(id);
  },

  async encrypt(projectData: Partial<Project>, key: CryptoKey | null): Promise<Partial<Project>> {
    if (!key) return projectData;
    const encrypted = { ...projectData };
    if (projectData.cred2Password) {
      const { ciphertext, iv } = await encryptText(projectData.cred2Password, key);
      encrypted.cred2Password = ciphertext;
      encrypted.cred2PasswordIv = iv;
    }
    if (projectData.cred3Password) {
      const { ciphertext, iv } = await encryptText(projectData.cred3Password, key);
      encrypted.cred3Password = ciphertext;
      encrypted.cred3PasswordIv = iv;
    }
    return encrypted;
  },

  async decrypt(project: Project, key: CryptoKey | null): Promise<Project> {
    if (!key) return project;
    const decrypted = { ...project };
    if (project.cred2Password && project.cred2PasswordIv) {
      try {
        decrypted.cred2Password = await decryptText(project.cred2Password, project.cred2PasswordIv, key);
      } catch {
        // ignore
      }
    }
    if (project.cred3Password && project.cred3PasswordIv) {
      try {
        decrypted.cred3Password = await decryptText(project.cred3Password, project.cred3PasswordIv, key);
      } catch {
        // ignore
      }
    }
    return decrypted;
  },

  async syncSubTables(project: Project, key: CryptoKey | null): Promise<void> {
    const id = project.id;
    
    // 1. Delete previous auto-generated URLs and credentials
    const urls = await db.urls.where('projectId').equals(id).toArray();
    for (const u of urls) {
      if (u.isAutoGenerated) {
        await db.urls.delete(u.id);
      }
    }

    const creds = await db.credentials.where('projectId').equals(id).toArray();
    for (const c of creds) {
      if (c.isAutoGenerated) {
        await db.credentials.delete(c.id);
      }
    }

    // 2. Add documentation links
    if (project.docsUrls && project.docsUrls.length > 0) {
      for (const url of project.docsUrls) {
        if (url.trim()) {
          await db.urls.add({
            id: uuidv4(),
            projectId: id,
            title: 'Docs Link',
            url: url.trim(),
            category: 'documentation',
            isAutoGenerated: true
          });
        }
      }
    }

    // 3. Add Figma URLs
    if (project.figmaUrls && project.figmaUrls.length > 0) {
      for (const url of project.figmaUrls) {
        if (url.trim()) {
          await db.urls.add({
            id: uuidv4(),
            projectId: id,
            title: 'Figma URL',
            url: url.trim(),
            category: 'design',
            isAutoGenerated: true
          });
        }
      }
    }

    // 4. Add v2.0 environment
    if (project.url2 && project.url2.trim()) {
      await db.urls.add({
        id: uuidv4(),
        projectId: id,
        title: '2.0 URL',
        url: project.url2.trim(),
        category: 'staging',
        isAutoGenerated: true
      });
    }
    if (project.dashboardUrl2 && project.dashboardUrl2.trim()) {
      await db.urls.add({
        id: uuidv4(),
        projectId: id,
        title: '2.0 Dashboard',
        url: project.dashboardUrl2.trim(),
        category: 'other',
        isAutoGenerated: true
      });
    }
    if (key && (project.cred2Username || project.cred2Password)) {
      await CredentialRepository.save({
        projectId: id,
        title: 'Staging 2.0 Credentials',
        username: project.cred2Username || '',
        email: '',
        password: project.cred2Password || '',
        isAutoGenerated: true
      } as any, key);
    }

    // 5. Add v3.0 environment
    if (project.url3 && project.url3.trim()) {
      await db.urls.add({
        id: uuidv4(),
        projectId: id,
        title: '3.0 URL',
        url: project.url3.trim(),
        category: 'production',
        isAutoGenerated: true
      });
    }
    if (project.dashboardUrl3 && project.dashboardUrl3.trim()) {
      await db.urls.add({
        id: uuidv4(),
        projectId: id,
        title: '3.0 Dashboard',
        url: project.dashboardUrl3.trim(),
        category: 'other',
        isAutoGenerated: true
      });
    }
    if (key && (project.cred3Username || project.cred3Password)) {
      await CredentialRepository.save({
        projectId: id,
        title: 'Production 3.0 Credentials',
        username: project.cred3Username || '',
        email: '',
        password: project.cred3Password || '',
        isAutoGenerated: true
      } as any, key);
    }
  },

  async create(
    projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'isFavorite' | 'isPinned'>,
    key?: CryptoKey | null
  ): Promise<Project> {
    const encryptedData = await this.encrypt(projectData, key || null);
    const project: Project = {
      ...projectData,
      ...encryptedData,
      id: uuidv4(),
      isFavorite: false,
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };
    await db.projects.add(project);
    await this.syncSubTables(project, key || null);
    await ActivityRepository.log(project.id, 'create', `Created project "${project.name}"`);
    return project;
  },

  async update(
    id: string, 
    updates: Partial<Omit<Project, 'id' | 'createdAt' | 'deletedAt'>>,
    key?: CryptoKey | null
  ): Promise<Project> {
    const project = await db.projects.get(id);
    if (!project) throw new Error('Project not found');

    const encryptedUpdates = await this.encrypt(updates, key || null);
    const updatedProject: Project = {
      ...project,
      ...updates,
      ...encryptedUpdates,
      updatedAt: new Date()
    };

    await db.projects.put(updatedProject);
    await this.syncSubTables(updatedProject, key || null);
    
    // Create detailed log of changes
    const changes: string[] = [];
    if (updates.name && updates.name !== project.name) changes.push(`renamed to "${updates.name}"`);
    if (updates.status && updates.status !== project.status) changes.push(`status changed to "${updates.status}"`);
    
    const changeText = changes.length > 0 ? changes.join(', ') : 'Details updated';
    await ActivityRepository.log(id, 'update', `Updated project "${project.name}": ${changeText}`);
    
    return updatedProject;
  },

  async togglePinned(id: string): Promise<boolean> {
    const project = await db.projects.get(id);
    if (!project) throw new Error('Project not found');
    const newState = !project.isPinned;
    await db.projects.update(id, { isPinned: newState, updatedAt: new Date() });
    await ActivityRepository.log(id, 'update', `${newState ? 'Pinned' : 'Unpinned'} project "${project.name}"`);
    return newState;
  },

  async toggleFavorite(id: string): Promise<boolean> {
    const project = await db.projects.get(id);
    if (!project) throw new Error('Project not found');
    const newState = !project.isFavorite;
    await db.projects.update(id, { isFavorite: newState, updatedAt: new Date() });
    await ActivityRepository.log(id, 'update', `${newState ? 'Added' : 'Removed'} project "${project.name}" ${newState ? 'to' : 'from'} favorites`);
    return newState;
  },

  async softDelete(id: string): Promise<void> {
    const project = await db.projects.get(id);
    if (!project) throw new Error('Project not found');
    await db.projects.update(id, { deletedAt: new Date(), updatedAt: new Date() });
    await ActivityRepository.log(id, 'delete', `Soft-deleted project "${project.name}"`);
  },

  async restore(id: string): Promise<void> {
    const project = await db.projects.get(id);
    if (!project) throw new Error('Project not found');
    await db.projects.update(id, { deletedAt: null, updatedAt: new Date() });
    await ActivityRepository.log(id, 'restore', `Restored project "${project.name}"`);
  },

  async hardDelete(id: string): Promise<void> {
    const project = await db.projects.get(id);
    const name = project?.name || 'Unknown Project';

    // Cascade delete related records
    await db.transaction('rw', [
      db.projects, db.urls, db.credentials, db.hosting, 
      db.databases, db.services, db.domains, db.contacts, 
      db.attachments, db.activities
    ], async () => {
      await db.projects.delete(id);
      await db.urls.where('projectId').equals(id).delete();
      await db.credentials.where('projectId').equals(id).delete();
      await db.hosting.where('projectId').equals(id).delete();
      await db.databases.where('projectId').equals(id).delete();
      await db.services.where('projectId').equals(id).delete();
      await db.domains.where('projectId').equals(id).delete();
      await db.contacts.where('projectId').equals(id).delete();
      await db.attachments.where('projectId').equals(id).delete();
      await db.activities.where('projectId').equals(id).delete();
    });

    await ActivityRepository.log(null, 'delete', `Permanently deleted project "${name}" and all associated records`);
  },

  async duplicate(id: string, key?: CryptoKey): Promise<Project> {
    const original = await db.projects.get(id);
    if (!original) throw new Error('Original project not found');

    const newProjId = uuidv4();
    
    // 1. Duplicate Project root
    const duplicatedProject: Project = {
      ...original,
      id: newProjId,
      name: `${original.name} (Copy)`,
      isPinned: false,
      isFavorite: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    };

    await db.transaction('rw', [
      db.projects, db.urls, db.credentials, db.hosting, 
      db.databases, db.services, db.domains, db.contacts, 
      db.attachments
    ], async () => {
      await db.projects.add(duplicatedProject);

      // 2. Duplicate URLs
      const urls = await db.urls.where('projectId').equals(id).toArray();
      for (const url of urls) {
        await db.urls.add({ ...url, id: uuidv4(), projectId: newProjId });
      }

      // 3. Duplicate Credentials
      const creds = await db.credentials.where('projectId').equals(id).toArray();
      for (const cred of creds) {
        await db.credentials.add({ ...cred, id: uuidv4(), projectId: newProjId });
      }

      // 4. Duplicate Hosting
      const hostings = await db.hosting.where('projectId').equals(id).toArray();
      for (const h of hostings) {
        await db.hosting.add({ ...h, id: uuidv4(), projectId: newProjId });
      }

      // 5. Duplicate Databases
      const dbs = await db.databases.where('projectId').equals(id).toArray();
      for (const d of dbs) {
        await db.databases.add({ ...d, id: uuidv4(), projectId: newProjId });
      }

      // 6. Duplicate Services
      const services = await db.services.where('projectId').equals(id).toArray();
      for (const s of services) {
        await db.services.add({ ...s, id: uuidv4(), projectId: newProjId });
      }

      // 7. Duplicate Domains
      const domains = await db.domains.where('projectId').equals(id).toArray();
      for (const dom of domains) {
        await db.domains.add({ ...dom, id: uuidv4(), projectId: newProjId });
      }

      // 8. Duplicate Contacts
      const contacts = await db.contacts.where('projectId').equals(id).toArray();
      for (const c of contacts) {
        await db.contacts.add({ ...c, id: uuidv4(), projectId: newProjId });
      }

      // 9. Duplicate Attachments
      const attachments = await db.attachments.where('projectId').equals(id).toArray();
      for (const a of attachments) {
        await db.attachments.add({ ...a, id: uuidv4(), projectId: newProjId });
      }
    });

    await ActivityRepository.log(newProjId, 'create', `Duplicated project "${original.name}" into "${duplicatedProject.name}"`);
    return duplicatedProject;
  }
};

// URL REPOSITORY
export const UrlRepository = {
  async getByProjectId(projectId: string): Promise<ProjectUrl[]> {
    const list = await db.urls.where('projectId').equals(projectId).toArray();
    return list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  },

  async save(urlData: Omit<ProjectUrl, 'id'> & { id?: string }): Promise<ProjectUrl> {
    const id = urlData.id || uuidv4();
    const projectUrl: ProjectUrl = { ...urlData, id } as ProjectUrl;
    await db.urls.put(projectUrl);
    await ActivityRepository.log(urlData.projectId, 'update', `Saved URL "${projectUrl.title}"`);
    return projectUrl;
  },

  async reorder(id: string, projectId: string, direction: 'up' | 'down'): Promise<void> {
    await reorderListItem(
      id,
      direction,
      () => db.urls.where('projectId').equals(projectId).toArray(),
      db.urls
    );
    await ActivityRepository.log(projectId, 'update', `Adjusted URL position`);
  },

  async swap(idA: string, idB: string, projectId: string): Promise<void> {
    await swapItemPositions(
      idA,
      idB,
      () => db.urls.where('projectId').equals(projectId).toArray(),
      db.urls
    );
    await ActivityRepository.log(projectId, 'update', `Swapped URL positions`);
  },

  async delete(id: string, projectId: string): Promise<void> {
    const url = await db.urls.get(id);
    const title = url?.title || 'URL';
    await db.urls.delete(id);
    await ActivityRepository.log(projectId, 'update', `Deleted URL "${title}"`);
  }
};

// CREDENTIAL REPOSITORY
export const CredentialRepository = {
  async getByProjectId(projectId: string, key?: CryptoKey): Promise<Credential[]> {
    const list = await db.credentials.where('projectId').equals(projectId).toArray();
    const sorted = list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    if (!key) return sorted; // Return encrypted records if key is missing

    // Decrypt on the fly
    return await Promise.all(sorted.map(c => this.decrypt(c, key)));
  },

  async save(credential: Omit<Credential, 'id' | 'encryptedPassword' | 'encryptedApiKey' | 'encryptedSecret' | 'encryptedNotes' | 'iv'> & { id?: string }, key: CryptoKey): Promise<Credential> {
    const id = credential.id || uuidv4();
    
    // Encrypt sensitive fields
    const encryptedFields: Partial<Credential> = {};
    let ivString = '';

    // We can use a single IV per credential record to make it simpler, or multiple. A single IV is perfectly fine.
    // Let's encrypt the fields using Web Crypto GCM
    const dataToEncrypt = {
      password: credential.password || '',
      apiKey: credential.apiKey || '',
      secret: credential.secret || '',
      notes: credential.notes || ''
    };

    // Serialize object to text to encrypt all in one run, or encrypt separately.
    // Encrypting separately is cleaner for database fields. Let's do it separately or as a JSON string to a single encrypted payload.
    // To preserve database properties, we can encrypt them separately. Let's do separately using the SAME derived key but different random IVs.
    // Actually, encrypting them separately with unique IVs is the most secure. Or we can generate one IV and encrypt a combined JSON payload.
    // Let's encrypt them separately. To store them, each encrypted field needs its ciphertext, and they can share the same record IV since AES-GCM
    // should not reuse the IV/Key pair for different plaintexts. But wait! If we encrypt four different fields with the SAME IV and SAME key,
    // that violates cryptographic safety. So we should encrypt each field with a SEPARATE IV, or encrypt a single JSON object.
    // Encrypting a single JSON object (e.g. `encryptedData`) and keeping the non-sensitive fields (title, username, email) plaintext is very elegant!
    // Let's do that! That way we only have one `iv` and one `encryptedPayload` string. It's clean, cryptographically secure, and easy to maintain.
    // Let's look at the structure:
    // `encryptedPassword`, `encryptedApiKey`, etc. are stored. If we want to store them in separate fields, we can encrypt them as a single JSON blob
    // and put it in a single column, or we can store IVs per field, or encrypt a combined payload.
    // Let's encrypt a combined JSON string containing password, apiKey, secret, and notes:
    const payload = JSON.stringify(dataToEncrypt);
    const encrypted = await encryptText(payload, key);
    
    const dbRecord: Credential = {
      id,
      projectId: credential.projectId,
      title: credential.title,
      username: credential.username,
      email: credential.email,
      encryptedPassword: encrypted.ciphertext, // We will store the entire combined ciphertext in encryptedPassword
      iv: encrypted.iv,
      isAutoGenerated: (credential as any).isAutoGenerated
    };

    await db.credentials.put(dbRecord);
    await ActivityRepository.log(credential.projectId, 'update', `Saved credential "${credential.title}"`);
    
    return {
      ...credential,
      id
    };
  },

  async decrypt(record: Credential, key: CryptoKey): Promise<Credential> {
    if (!record.encryptedPassword || !record.iv) {
      return record;
    }
    try {
      const decryptedText = await decryptText(record.encryptedPassword, record.iv, key);
      const data = JSON.parse(decryptedText);
      return {
        ...record,
        password: data.password,
        apiKey: data.apiKey,
        secret: data.secret,
        notes: data.notes
      };
    } catch (e) {
      console.error('Failed to decrypt credential:', e);
      return record; // Return encrypted if decryption fails
    }
  },

  async reorder(id: string, projectId: string, direction: 'up' | 'down'): Promise<void> {
    await reorderListItem(
      id,
      direction,
      () => db.credentials.where('projectId').equals(projectId).toArray(),
      db.credentials
    );
    await ActivityRepository.log(projectId, 'update', `Adjusted credential position`);
  },

  async swap(idA: string, idB: string, projectId: string): Promise<void> {
    await swapItemPositions(
      idA,
      idB,
      () => db.credentials.where('projectId').equals(projectId).toArray(),
      db.credentials
    );
    await ActivityRepository.log(projectId, 'update', `Swapped credential positions`);
  },

  async delete(id: string, projectId: string): Promise<void> {
    const cred = await db.credentials.get(id);
    const title = cred?.title || 'Credential';
    await db.credentials.delete(id);
    await ActivityRepository.log(projectId, 'update', `Deleted credential "${title}"`);
  }
};

// HOSTING REPOSITORY
export const HostingRepository = {
  async getByProjectId(projectId: string): Promise<Hosting | undefined> {
    return await db.hosting.where('projectId').equals(projectId).first();
  },

  async save(hostingData: Omit<Hosting, 'id'> & { id?: string }): Promise<Hosting> {
    const existing = await this.getByProjectId(hostingData.projectId);
    const id = existing?.id || hostingData.id || uuidv4();
    const hosting: Hosting = { ...hostingData, id };
    await db.hosting.put(hosting);
    await ActivityRepository.log(hostingData.projectId, 'update', `Updated hosting details`);
    return hosting;
  }
};

// DATABASE REPOSITORY
export const DatabaseRepository = {
  async getByProjectId(projectId: string, key?: CryptoKey): Promise<DatabaseInfo | undefined> {
    const dbRecord = await db.databases.where('projectId').equals(projectId).first();
    if (!dbRecord || !key) return dbRecord;
    return await this.decrypt(dbRecord, key);
  },

  async save(dbData: Omit<DatabaseInfo, 'id' | 'encryptedPassword' | 'iv'> & { id?: string; password?: string }, key: CryptoKey): Promise<DatabaseInfo> {
    const existing = await db.databases.where('projectId').equals(dbData.projectId).first();
    const id = existing?.id || dbData.id || uuidv4();
    
    let encryptedPassword = '';
    let iv = '';

    if (dbData.password) {
      const encrypted = await encryptText(dbData.password, key);
      encryptedPassword = encrypted.ciphertext;
      iv = encrypted.iv;
    }

    const dbRecord: DatabaseInfo = {
      id,
      projectId: dbData.projectId,
      type: dbData.type,
      host: dbData.host,
      port: dbData.port,
      username: dbData.username,
      databaseName: dbData.databaseName,
      encryptedPassword,
      iv
    };

    await db.databases.put(dbRecord);
    await ActivityRepository.log(dbData.projectId, 'update', `Updated database information`);
    return {
      ...dbRecord,
      password: dbData.password
    };
  },

  async decrypt(record: DatabaseInfo, key: CryptoKey): Promise<DatabaseInfo> {
    if (!record.encryptedPassword || !record.iv) return record;
    try {
      const password = await decryptText(record.encryptedPassword, record.iv, key);
      return {
        ...record,
        password
      };
    } catch {
      return record;
    }
  }
};

// SERVICE REPOSITORY
export const ServiceRepository = {
  async getByProjectId(projectId: string): Promise<Service[]> {
    const list = await db.services.where('projectId').equals(projectId).toArray();
    return list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  },

  async save(serviceData: Omit<Service, 'id'> & { id?: string }): Promise<Service> {
    const id = serviceData.id || uuidv4();
    const service: Service = { ...serviceData, id };
    await db.services.put(service);
    await ActivityRepository.log(serviceData.projectId, 'update', `Updated third-party service: ${service.name}`);
    return service;
  },

  async reorder(id: string, projectId: string, direction: 'up' | 'down'): Promise<void> {
    await reorderListItem(
      id,
      direction,
      () => db.services.where('projectId').equals(projectId).toArray(),
      db.services
    );
    await ActivityRepository.log(projectId, 'update', `Adjusted service position`);
  },

  async swap(idA: string, idB: string, projectId: string): Promise<void> {
    await swapItemPositions(
      idA,
      idB,
      () => db.services.where('projectId').equals(projectId).toArray(),
      db.services
    );
    await ActivityRepository.log(projectId, 'update', `Swapped service positions`);
  },

  async delete(id: string, projectId: string): Promise<void> {
    const service = await db.services.get(id);
    const name = service?.name || 'Service';
    await db.services.delete(id);
    await ActivityRepository.log(projectId, 'update', `Removed service config for ${name}`);
  }
};

// DOMAIN REPOSITORY
export const DomainRepository = {
  async getByProjectId(projectId: string): Promise<DomainInfo | undefined> {
    return await db.domains.where('projectId').equals(projectId).first();
  },

  async save(domainData: Omit<DomainInfo, 'id'> & { id?: string }): Promise<DomainInfo> {
    const existing = await this.getByProjectId(domainData.projectId);
    const id = existing?.id || domainData.id || uuidv4();
    const domain: DomainInfo = { ...domainData, id };
    await db.domains.put(domain);
    await ActivityRepository.log(domainData.projectId, 'update', `Updated domain details`);
    return domain;
  }
};

// CONTACT REPOSITORY
export const ContactRepository = {
  async getByProjectId(projectId: string): Promise<Contact[]> {
    const list = await db.contacts.where('projectId').equals(projectId).toArray();
    return list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  },

  async save(contactData: Omit<Contact, 'id'> & { id?: string }): Promise<Contact> {
    const id = contactData.id || uuidv4();
    const contact: Contact = { ...contactData, id };
    await db.contacts.put(contact);
    await ActivityRepository.log(contactData.projectId, 'update', `Saved contact: ${contact.name} (${contact.role})`);
    return contact;
  },

  async reorder(id: string, projectId: string, direction: 'up' | 'down'): Promise<void> {
    await reorderListItem(
      id,
      direction,
      () => db.contacts.where('projectId').equals(projectId).toArray(),
      db.contacts
    );
    await ActivityRepository.log(projectId, 'update', `Adjusted contact position`);
  },

  async swap(idA: string, idB: string, projectId: string): Promise<void> {
    await swapItemPositions(
      idA,
      idB,
      () => db.contacts.where('projectId').equals(projectId).toArray(),
      db.contacts
    );
    await ActivityRepository.log(projectId, 'update', `Swapped contact positions`);
  },

  async delete(id: string, projectId: string): Promise<void> {
    const contact = await db.contacts.get(id);
    const name = contact?.name || 'Contact';
    await db.contacts.delete(id);
    await ActivityRepository.log(projectId, 'update', `Deleted contact: ${name}`);
  }
};

// ATTACHMENT REPOSITORY
export const AttachmentRepository = {
  async getByProjectId(projectId: string): Promise<Omit<Attachment, 'data'>[]> {
    // Return records without binary data to avoid loading large blobs unnecessarily
    const list = await db.attachments.where('projectId').equals(projectId).toArray();
    return list.map(({ data, ...rest }) => rest);
  },

  async getFile(id: string): Promise<Attachment | undefined> {
    return await db.attachments.get(id);
  },

  async save(attachmentData: Omit<Attachment, 'id' | 'createdAt'> & { id?: string }): Promise<Attachment> {
    const id = attachmentData.id || uuidv4();
    const attachment: Attachment = {
      ...attachmentData,
      id,
      createdAt: new Date()
    };
    await db.attachments.put(attachment);
    await ActivityRepository.log(attachmentData.projectId, 'update', `Uploaded attachment "${attachment.name}"`);
    return attachment;
  },

  async delete(id: string, projectId: string): Promise<void> {
    const file = await db.attachments.get(id);
    const name = file?.name || 'File';
    await db.attachments.delete(id);
    await ActivityRepository.log(projectId, 'update', `Deleted attachment "${name}"`);
  }
};

// SETTINGS REPOSITORY
export const SettingsRepository = {
  async get(key: string): Promise<any> {
    const res = await db.settings.get(key);
    return res ? res.value : null;
  },

  async set(key: string, value: any): Promise<void> {
    await db.settings.put({ key, value });
  }
};
