'use client';

import React from 'react';
import ProjectListView from '@/components/project-list-view';

export default function FavoritesPage() {
  return (
    <ProjectListView 
      presetFilter="favorites" 
      title="Favorites" 
      description="Quick access dashboard for your pinned and bookmarked workspaces."
    />
  );
}
