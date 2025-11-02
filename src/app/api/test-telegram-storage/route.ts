// src/app/api/test-telegram-storage/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  console.log('🧪 === TEST TELEGRAM STORAGE API CALLED ===')

  try {
    const body = await request.json()
    console.log('📥 Received test request body:', JSON.stringify(body, null, 2))

    return NextResponse.json({
      success: true,
      message: 'Test endpoint received data successfully',
      receivedData: body,
    })
  } catch (error) {
    console.error('❌ Test endpoint error:', error)
    return NextResponse.json(
      { error: 'Test endpoint failed', details: error },
      { status: 500 }
    )
  }
}
