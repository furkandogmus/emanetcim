"use client";

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          if (process.env.NODE_ENV === 'development') {
            console.debug('SW registered:', registration.scope);
          }
        })
        .catch((err) => console.warn('SW error:', err));
    }
  }, []);

  return null;
}
