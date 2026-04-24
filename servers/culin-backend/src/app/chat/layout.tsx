'use client';

/**
 * Chat Layout
 * Wraps the chat interface with custom authentication
 */

import CustomProtectedRoute from '../components/CustomProtectedRoute';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CustomProtectedRoute>
      {children}
    </CustomProtectedRoute>
  );
}
