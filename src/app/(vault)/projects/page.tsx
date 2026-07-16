'use client';

import React from 'react';
import ProjectListView from '@/components/project-list-view';

export default function ProjectsPage() {
  return (
    <ProjectListView 
      presetFilter="active" 
      title="Projects" 
      description="Manage and organize your developer environments, staging sites, and repositories."
    />
  );
}
