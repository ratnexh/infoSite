'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    // Avoid SW register loops on localhost development
    if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (reg) => {
            console.log('Site Vault SW Registered: ', reg.scope);
          },
          (err) => {
            console.error('Site Vault SW Register Failed: ', err);
          }
        );
      });
    }
  }, []);

  return null;
}
