'use client';

import React from 'react';
import ProjectListView from '@/components/project-list-view';

export default function ArchivedPage() {
  return (
    <ProjectListView 
      presetFilter="archived" 
      title="Archived Projects" 
      description="View projects that have been completed, decommissioned, or put on hold."
    />
  );
}
