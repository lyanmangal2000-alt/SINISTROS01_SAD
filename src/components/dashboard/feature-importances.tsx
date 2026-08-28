'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ImportanciaRow } from '@/lib/transito-types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'

interface Props {
  importancias: ImportanciaRow[]
}

const COL_ORIG_COLOR: Record<string, string> = {
  veiculos: '#dc2626',
  causa_acidente: '#ea580c',
  tipo_acidente: '#d97706',
  tipo_pista: '#65a30d',
  tracado_via: '#0891b2',
  fase_dia: '#0284c7',
  periodo_dia: '#7c3aed',
  condicao_metereologica: '#be185d',
  dia_semana: '#475569',
  uf: '#0f766e',
  uso_solo: '#a16207',
  mes: '#9333ea',
}

export function FeatureImportancesChart({ importancias }: Props) {
  // Reverter para mostrar do menor para o maior (top no topo do gráfico horizontal)
  const data = [...importancias].reverse().map((row) => ({
    name: row.feature.length > 35 ? row.feature.slice(0, 32) + '…' : row.feature,
    fullName: row.feature,
    importance: row.importance,
    col_orig: row.col_orig,
    valor: row.valor,
  }))

  const legend = Array.from(new Set(importancias.map((i) => i.col_orig))).slice(0, 8)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 20 Atributos — feature_importances_</CardTitle>
        <CardDescription>
          Importância calculada pelo ganho de informação acumulado em cada split da árvore.
          Atributos no topo contribuem mais para reduzir a entropia do alvo (tipo de vítima).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[520px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 80, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis
                type="number"
                tickFormatter={(v) => v.toFixed(2)}
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: '#334155' }}
                width={220}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const p = payload[0].payload
                  return (
                    <div className="bg-background border border-border rounded-md p-2 text-xs shadow-md">
                      <div className="font-mono font-medium">{p.fullName}</div>
                      <div className="text-muted-foreground mt-0.5">
                        Original: <span className="font-mono">{p.col_orig}</span>
                        {p.valor && p.valor !== '(qualquer)' && (
                          <> = <span className="font-mono">{p.valor}</span></>
                        )}
                      </div>
                      <div className="mt-1">
                        Importância: <strong>{p.importance.toFixed(4)}</strong>
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={COL_ORIG_COLOR[d.col_orig] || '#475569'} />
                ))}
                <LabelList
                  dataKey="importance"
                  position="right"
                  formatter={(v: number) => v.toFixed(3)}
                  style={{ fontSize: 10, fill: '#475569' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {legend.map((col) => (
            <div key={col} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ background: COL_ORIG_COLOR[col] || '#475569' }}
              />
              <span className="font-mono text-muted-foreground">{col}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
