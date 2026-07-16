import { db } from '@/lib/db/dexie-db';
import { Project, ProjectStatus } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Helper to escape CSV strings
function escapeCSVValue(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Replace double quotes with pair of double quotes
  str = str.replace(/"/g, '""');
  // Wrap in quotes if it contains comma, quotes, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str}"`;
  }
  return str;
}

// Split CSV lines keeping quoted strings with commas intact
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export const ImportExportService = {
  // 1. JSON Export
  async exportJSON(): Promise<string> {
    const allProjects = await db.projects.toArray();
    const allUrls = await db.urls.toArray();
    const allCredentials = await db.credentials.toArray();
    const allHosting = await db.hosting.toArray();
    const allDatabases = await db.databases.toArray();
    const allServices = await db.services.toArray();
    const allDomains = await db.domains.toArray();
    const allContacts = await db.contacts.toArray();
    const allSettings = await db.settings.toArray();
    const allActivities = await db.activities.toArray();

    const backup = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      data: {
        projects: allProjects,
        urls: allUrls,
        credentials: allCredentials,
        hosting: allHosting,
        databases: allDatabases,
        services: allServices,
        domains: allDomains,
        contacts: allContacts,
        settings: allSettings,
        activities: allActivities
      }
    };

    return JSON.stringify(backup, null, 2);
  },

  // 2. JSON Import (Wipes existing vault and restores from backup)
  async importJSON(jsonString: string): Promise<void> {
    const parsed = JSON.parse(jsonString);
    if (!parsed || parsed.version !== '1.0.0' || !parsed.data) {
      throw new Error('Invalid vault backup file version or format');
    }

    const { data } = parsed;

    await db.transaction('rw', [
      db.projects, db.urls, db.credentials, db.hosting, 
      db.databases, db.services, db.domains, db.contacts, 
      db.settings, db.activities
    ], async () => {
      // Clear all
      await db.projects.clear();
      await db.urls.clear();
      await db.credentials.clear();
      await db.hosting.clear();
      await db.databases.clear();
      await db.services.clear();
      await db.domains.clear();
      await db.contacts.clear();
      await db.activities.clear();
      
      // We do NOT clear settings to avoid locking the user out if they import settings that mismatch their current password verifier!
      // But we will restore settings except verifier, salt, lock_timeout. Or we merge.
      // Let's add them back:
      if (data.projects) await db.projects.bulkAdd(data.projects);
      if (data.urls) await db.urls.bulkAdd(data.urls);
      if (data.credentials) await db.credentials.bulkAdd(data.credentials);
      if (data.hosting) await db.hosting.bulkAdd(data.hosting);
      if (data.databases) await db.databases.bulkAdd(data.databases);
      if (data.services) await db.services.bulkAdd(data.services);
      if (data.domains) await db.domains.bulkAdd(data.domains);
      if (data.contacts) await db.contacts.bulkAdd(data.contacts);
      if (data.activities) await db.activities.bulkAdd(data.activities);

      // Restore specific non-security settings
      if (data.settings) {
        for (const s of data.settings) {
          if (s.key !== 'vault_salt' && s.key !== 'vault_verifier') {
            await db.settings.put(s);
          }
        }
      }
    });
  },

  // 3. CSV Export (Active Projects only)
  async exportProjectsCSV(): Promise<string> {
    const projects = await db.projects.toArray();
    const active = projects.filter(p => !p.deletedAt);
    
    const headers = ['Name', 'AKA', 'Status', 'Color', 'DocsUrls', 'FigmaUrls', 'Url2', 'DashboardUrl2', 'Url3', 'DashboardUrl3', 'Cred2Username', 'Cred3Username', 'CreatedAt', 'IsPinned', 'IsFavorite'];
    const rows = active.map(p => [
      p.name,
      p.aka || '',
      p.status,
      p.color,
      (p.docsUrls || []).join(';'),
      (p.figmaUrls || []).join(';'),
      p.url2 || '',
      p.dashboardUrl2 || '',
      p.url3 || '',
      p.dashboardUrl3 || '',
      p.cred2Username || '',
      p.cred3Username || '',
      p.createdAt.toISOString ? p.createdAt.toISOString() : new Date(p.createdAt).toISOString(),
      p.isPinned ? 'true' : 'false',
      p.isFavorite ? 'true' : 'false'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSVValue).join(','))
    ].join('\r\n');

    return csvContent;
  },

  // 4. CSV Import (Merges into existing projects)
  async importProjectsCSV(csvString: string): Promise<number> {
    const lines = csvString.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return 0; // No header or data rows

    const headers = parseCSVLine(lines[0]);
    const nameIdx = headers.indexOf('Name');
    const akaIdx = headers.indexOf('AKA');
    const statusIdx = headers.indexOf('Status');
    const colorIdx = headers.indexOf('Color');
    const docsIdx = headers.indexOf('DocsUrls');
    const figmaIdx = headers.indexOf('FigmaUrls');
    const url2Idx = headers.indexOf('Url2');
    const dash2Idx = headers.indexOf('DashboardUrl2');
    const url3Idx = headers.indexOf('Url3');
    const dash3Idx = headers.indexOf('DashboardUrl3');
    const cred2UserIdx = headers.indexOf('Cred2Username');
    const cred3UserIdx = headers.indexOf('Cred3Username');
    const pinnedIdx = headers.indexOf('IsPinned');
    const favIdx = headers.indexOf('IsFavorite');

    if (nameIdx === -1) {
      throw new Error('CSV is missing required header: "Name"');
    }

    let importCount = 0;

    await db.transaction('rw', [db.projects, db.activities], async () => {
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length < nameIdx + 1) continue;

        const name = row[nameIdx]?.trim();
        if (!name) continue;

        const aka = akaIdx !== -1 ? row[akaIdx]?.trim() || '' : '';
        const status = (row[statusIdx]?.trim() || 'development') as ProjectStatus;
        const color = row[colorIdx]?.trim() || '#10b981';
        const docsUrls = docsIdx !== -1 && row[docsIdx] ? row[docsIdx].split(';').map(u => u.trim()).filter(u => u.length > 0) : [];
        const figmaUrls = figmaIdx !== -1 && row[figmaIdx] ? row[figmaIdx].split(';').map(u => u.trim()).filter(u => u.length > 0) : [];
        const url2 = url2Idx !== -1 ? row[url2Idx]?.trim() || '' : '';
        const dashboardUrl2 = dash2Idx !== -1 ? row[dash2Idx]?.trim() || '' : '';
        const url3 = url3Idx !== -1 ? row[url3Idx]?.trim() || '' : '';
        const dashboardUrl3 = dash3Idx !== -1 ? row[dash3Idx]?.trim() || '' : '';
        const cred2Username = cred2UserIdx !== -1 ? row[cred2UserIdx]?.trim() || '' : '';
        const cred3Username = cred3UserIdx !== -1 ? row[cred3UserIdx]?.trim() || '' : '';
        const isPinned = pinnedIdx !== -1 ? row[pinnedIdx]?.trim() === 'true' : false;
        const isFavorite = favIdx !== -1 ? row[favIdx]?.trim() === 'true' : false;

        const project: Project = {
          id: uuidv4(),
          name,
          aka,
          status,
          color,
          docsUrls,
          figmaUrls,
          url2,
          dashboardUrl2,
          url3,
          dashboardUrl3,
          cred2Username,
          cred3Username,
          isPinned,
          isFavorite,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null
        };

        await db.projects.add(project);
        importCount++;
      }
    });

    return importCount;
  }
};
