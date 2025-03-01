import { NextRequest, NextResponse } from 'next/server';
import { getWalletAnalysis } from '@/utils/wallet-analysis';

export async function GET(request: NextRequest) {
  try {
    // Get wallet address from query params
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    
    if (!wallet) {
      return new NextResponse(
        JSON.stringify({ error: 'Wallet address is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Get wallet analysis
    const analysis = await getWalletAnalysis(wallet);
    
    return new NextResponse(
      JSON.stringify({ success: true, data: analysis }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in wallet analysis API:', error);
    
    return new NextResponse(
      JSON.stringify({
        error: 'Failed to analyze wallet',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
