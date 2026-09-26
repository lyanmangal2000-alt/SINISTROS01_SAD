import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const dynamic = 'force-static'

const FILES = [
  '.gitignore',
  'COMO_RODAR_VSCODE.md',
  'README.md',
  'RESULTADOS_ESPERADOS.md',
  'gerar_dados_sinteticos.py',
  'main.py',
  'relatorio_campanhas.md',
  'requirements.txt',
  'validar_leitura.py',
]

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const fileName = url.searchParams.get('file')

  if (!fileName || !FILES.includes(fileName)) {
    return NextResponse.json({ error: 'Arquivo inválido', available: FILES }, { status: 400 })
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'projeto', fileName)
    const data = await fs.readFile(filePath)

    const ext = fileName.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      'py': 'text/x-python; charset=utf-8',
      'md': 'text/markdown; charset=utf-8',
      'txt': 'text/plain; charset=utf-8',
      'gitignore': 'text/plain; charset=utf-8',
    }

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': mimeTypes[ext || ''] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': data.length.toString(),
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Arquivo não encontrado', details: String(err) }, { status: 404 })
  }
}
