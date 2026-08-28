'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { HyperparametroRow } from '@/lib/transito-types'
import { DEFAULT_MAX_DEPTH, DEFAULT_MIN_SAMPLES_LEAF } from '@/lib/transito-constants'

interface Props {
  rows: HyperparametroRow[]
}

export function HyperparameterTable({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => b.acc_test - a.acc_test)
  const best = sorted[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Busca de Hiperparâmetros — Grid 3×3</CardTitle>
        <CardDescription>
          Acurácia de teste por combinação. Em <span className="font-mono">azul</span> a escolha padrão
          ({DEFAULT_MAX_DEPTH}/{DEFAULT_MIN_SAMPLES_LEAF}) — melhor equilíbrio entre
          interpretabilidade e recall de fatais, não necessariamente a maior acurácia bruta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">max_depth</TableHead>
              <TableHead className="text-center">min_samples_leaf</TableHead>
              <TableHead className="text-right">Acurácia Treino</TableHead>
              <TableHead className="text-right">Acurácia Teste</TableHead>
              <TableHead className="text-right">Gap Overfit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const isDefault = r.max_depth === DEFAULT_MAX_DEPTH && r.min_samples_leaf === DEFAULT_MIN_SAMPLES_LEAF
              const isBest = r.max_depth === best.max_depth && r.min_samples_leaf === best.min_samples_leaf
              return (
                <TableRow
                  key={`${r.max_depth}-${r.min_samples_leaf}`}
                  className={isDefault ? 'bg-blue-50 dark:bg-blue-950/30' : ''}
                >
                  <TableCell className="text-center font-mono">{r.max_depth}</TableCell>
                  <TableCell className="text-center font-mono">{r.min_samples_leaf}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.acc_train.toFixed(4)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{r.acc_test.toFixed(4)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${r.gap_overfit > 0.12 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {r.gap_overfit >= 0 ? '+' : ''}{r.gap_overfit.toFixed(4)}
                  </TableCell>
                  {(isDefault || isBest) && (
                    <TableCell>
                      {isDefault && <Badge variant="secondary" className="text-[10px]">escolha padrão</Badge>}
                      {isBest && !isDefault && <Badge variant="outline" className="text-[10px]">melhor acc</Badge>}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <div className="mt-3 rounded-md border border-border/40 bg-muted/30 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Justificativa da escolha:</strong> com{' '}
          <code className="font-mono">class_weight=&quot;balanced&quot;</code>, a acurácia global é
          deliberadamente penalizada em favor do recall da classe minoritária (Fatais, 7,2%). Por isso
          o critério de seleção é <strong>recall de fatais + interpretabilidade</strong>, não acurácia
          bruta — valores de <code className="font-mono">max_depth</code> {'>'} 10 geram árvores ilegíveis
          e gap {'>'} 0,12 (overfitting).
        </div>
      </CardContent>
    </Card>
  )
}
