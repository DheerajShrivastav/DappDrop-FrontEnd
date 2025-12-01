// src/app/api/test-telegram-storage/route.ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {

  try {
    const body = await request.json()

    return NextResponse.json({
      success: true,
      message: 'Test endpoint received data successfully',
      receivedData: body,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Test endpoint failed', details: error },
      { status: 500 }
    )
  }
}
