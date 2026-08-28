'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MatrizConfusao } from '@/lib/transito-types'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  matriz: MatrizConfusao
}

function cellColor(v: number) {
  // 0..1 -> branco..vermelho escuro
  const clamped = Math.max(0, Math.min(1, v))
  // Map 0 -> bg-white text-slate-700
  // Map 1 -> bg-red-700 text-white
  if (clamped < 0.1) return 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200'
  if (clamped < 0.25) return 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100'
  if (clamped < 0.5) return 'bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-50'
  if (clamped < 0.75) return 'bg-red-400 text-white dark:bg-red-800 dark:text-red-50'
  return 'bg-red-600 text-white dark:bg-red-700'
}

export function ConfusionMatrixHeatmap({ matriz }: Props) {
  const { labels, short_labels, normalized, counts, support } = matriz
  const n = labels.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matriz de Confusão (normalizada por classe real)</CardTitle>
        <CardDescription>
          Cada célula mostra a proporção de exemplos da classe <em>real</em> (linha) que foram
          classificados como cada classe <em>predita</em> (coluna). A diagonal é o recall por classe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="p-2"></th>
                <th colSpan={n} className="p-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
                  Predito
                </th>
              </tr>
              <tr>
                <th className="p-2 text-xs text-right text-muted-foreground">Real ↓</th>
                {short_labels.map((l) => (
                  <th key={l} className="p-2 text-xs font-medium text-center min-w-[110px]">
                    {l}
                  </th>
                ))}
                <th className="p-2 text-xs text-muted-foreground text-right">Suporte</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((realLabel, i) => (
                <tr key={realLabel}>
                  <td className="p-2 text-xs font-medium text-right whitespace-nowrap">{realLabel}</td>
                  {Array.from({ length: n }).map((_, j) => {
                    const v = normalized[i][j]
                    const c = counts[i][j]
                    return (
                      <td key={j} className="p-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`flex flex-col items-center justify-center rounded-md border border-border/40 min-h-[80px] cursor-help ${cellColor(v)}`}
                              >
                                <span className="text-base font-bold tabular-nums">
                                  {(v * 100).toFixed(1)}%
                                </span>
                                <span className="text-[10px] opacity-80 tabular-nums">
                                  {c.toLocaleString('pt-BR')}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="text-xs">
                                Real: <strong>{realLabel}</strong>
                                <br />
                                Predito: <strong>{labels[j]}</strong>
                                <br />
                                Proporção: <strong>{(v * 100).toFixed(2)}%</strong>
                                <br />
                                Contagem: <strong>{c.toLocaleString('pt-BR')}</strong>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    )
                  })}
                  <td className="p-2 text-xs text-right tabular-nums text-muted-foreground">
                    {support[i].toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>Escala:</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <div key={v} className="flex items-center gap-1.5">
              <div className={`w-6 h-3 rounded-sm ${cellColor(v)}`} />
              <span>{(v * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-md border border-border/40 bg-muted/30 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Leitura-chave:</strong> olhe a última linha
          (classe <em>Com Vítimas Fatais</em>) — quanto maior o valor na coluna &quot;Fatais&quot;,
          maior o <strong>recall de fatais</strong> do modelo. O baseline trivial acerta 0%
          desta classe; o modelo treinado chega a {((normalized[labels.indexOf('Com Vítimas Fatais')][labels.indexOf('Com Vítimas Fatais')] || 0) * 100).toFixed(1)}%.
        </div>
      </CardContent>
    </Card>
  )
}
