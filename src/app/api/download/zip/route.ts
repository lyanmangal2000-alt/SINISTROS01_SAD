import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const dynamic = 'force-static'

export async function GET(_req: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'campanha-transito-arvore-decisao.zip')
    const data = await fs.readFile(filePath)
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="campanha-transito-arvore-decisao.zip"',
        'Content-Length': data.length.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Arquivo não encontrado', details: String(err) }, { status: 404 })
  }
}
