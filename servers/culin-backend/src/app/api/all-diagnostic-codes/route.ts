import { NextRequest, NextResponse } from 'next/server';
import { fetchAllCategorizedDiagnosticCodes } from '../diagnosticCodes';
import { withOptionalAuth } from '@/lib/api-auth-middleware';

export const GET = withOptionalAuth(async (req: NextRequest, user) => {
  try {
    if (user) {
      console.log('[DiagnosticCodes] Authenticated request from:', user.email);
    }
    const categorizedCodes = await fetchAllCategorizedDiagnosticCodes();
    return NextResponse.json(categorizedCodes);
  } catch (error) {
    console.error('Error in /api/all-diagnostic-codes:', error);
    return NextResponse.json({ error: 'Failed to fetch all diagnostic codes' }, { status: 500 });
  }
}); 