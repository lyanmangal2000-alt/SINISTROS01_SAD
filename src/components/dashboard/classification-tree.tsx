'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ClassificationReport } from '@/lib/transito-types'
import { Maximize2 } from 'lucide-react'

interface Props {
  report: ClassificationReport
}

export function ClassificationReportTable({ report }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Classification Report (teste)</CardTitle>
        <CardDescription>
          Precision, recall e F1 por classe. <strong>Fatais</strong> é a classe minoritária (7,2%) —
          foco em <em>recall</em> (encontrar os fatais) e <em>precision</em> (não dar falso alarme).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Classe</TableHead>
              <TableHead className="text-right">Precision</TableHead>
              <TableHead className="text-right">Recall</TableHead>
              <TableHead className="text-right">F1-Score</TableHead>
              <TableHead className="text-right">Suporte</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.por_classe.map((c) => (
              <TableRow key={c.classe}>
                <TableCell className="font-medium">{c.classe}</TableCell>
                <TableCell className="text-right tabular-nums">{c.precision.toFixed(3)}</TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${c.classe === 'Com Vítimas Fatais' ? 'text-red-600' : ''}`}>
                  {c.recall.toFixed(3)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.f1.toFixed(3)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {c.support.toLocaleString('pt-BR')}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 border-border/60 bg-muted/30">
              <TableCell className="font-medium">Macro avg</TableCell>
              <TableCell className="text-right tabular-nums">{report.macro_avg.precision?.toFixed(3) ?? '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{report.macro_avg.recall?.toFixed(3) ?? '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{report.macro_avg['f1-score']?.toFixed(3) ?? '—'}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {report.macro_avg.support?.toLocaleString('pt-BR') ?? '—'}
              </TableCell>
            </TableRow>
            <TableRow className="bg-muted/30">
              <TableCell className="font-medium">Weighted avg</TableCell>
              <TableCell className="text-right tabular-nums">{report.weighted_avg.precision?.toFixed(3) ?? '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{report.weighted_avg.recall?.toFixed(3) ?? '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{report.weighted_avg['f1-score']?.toFixed(3) ?? '—'}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {report.weighted_avg.support?.toLocaleString('pt-BR') ?? '—'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="bg-red-50 dark:bg-red-950/30">
            Recall Fatais: {(report.por_classe.find((c) => c.classe === 'Com Vítimas Fatais')?.recall ?? 0 * 100).toFixed(1)}%
          </Badge>
          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30">
            Recall Sem Vítimas: {(report.por_classe.find((c) => c.classe === 'Sem Vítimas')?.recall ?? 0 * 100).toFixed(1)}%
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30">
            Recall Feridos: {(report.por_classe.find((c) => c.classe === 'Com Vítimas Feridas')?.recall ?? 0 * 100).toFixed(1)}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

export function DecisionTreePreview({ src, depth }: { src: string; depth: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Árvore de Decisão (preview)</CardTitle>
            <CardDescription>
              Primeiros <strong>3 níveis</strong> da árvore treinada com{' '}
              <code className="font-mono">criterion=&quot;entropy&quot;</code>. Profundidade real: {depth} níveis.
            </CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <button className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">
                <Maximize2 className="h-3 w-3" />
                Ampliar
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-7xl w-[95vw]">
              <DialogTitle>Árvore de Decisão — visão completa</DialogTitle>
              <DialogDescription>
                Cada nó mostra: condição de split, entropia, amostras, distribuição de classes e classe majoritária.
              </DialogDescription>
              <img
                src={src}
                alt="Árvore de decisão completa"
                className="w-full h-auto rounded-md border border-border"
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <img
          src={src}
          alt="Árvore de decisão — primeiros 3 níveis"
          className="w-full h-auto rounded-md border border-border cursor-zoom-in"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          As cores indicam a classe majoritária em cada nó (mais saturado = mais puro).
          O caminho da raiz até qualquer folha é uma regra interpretável por humanos.
        </p>
      </CardContent>
    </Card>
  )
}
