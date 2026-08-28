'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Distribuicoes, DistItem } from '@/lib/transito-types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts'

interface Props {
  distribuicoes: Distribuicoes
}

const PALETTE = ['#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d', '#16a34a', '#0891b2', '#0284c7', '#7c3aed', '#be185d', '#475569', '#0f766e']

function DistBar({ data, layout = 'horizontal', color = '#0284c7' }: { data: DistItem[]; layout?: 'horizontal' | 'vertical'; color?: string }) {
  if (layout === 'vertical') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#334155' }} width={120} />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null
              const p = payload[0].payload as DistItem
              return (
                <div className="bg-background border border-border rounded-md p-2 text-xs shadow-md">
                  <div className="font-medium">{p.label}</div>
                  <div className="tabular-nums">{p.count.toLocaleString('pt-BR')} casos</div>
                </div>
              )
            }}
          />
          <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 60, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} angle={-30} textAnchor="end" height={60} interval={0} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null
            const p = payload[0].payload as DistItem
            return (
              <div className="bg-background border border-border rounded-md p-2 text-xs shadow-md">
                <div className="font-medium">{p.label}</div>
                <div className="tabular-nums">{p.count.toLocaleString('pt-BR')} casos</div>
              </div>
            )
          }}
        />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DistPie({ data }: { data: DistItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={45}
          paddingAngle={1}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null
            const p = payload[0].payload as DistItem
            const total = data.reduce((s, d) => s + d.count, 0)
            const pct = ((p.count / total) * 100).toFixed(1)
            return (
              <div className="bg-background border border-border rounded-md p-2 text-xs shadow-md">
                <div className="font-medium">{p.label}</div>
                <div className="tabular-nums">{p.count.toLocaleString('pt-BR')} casos ({pct}%)</div>
              </div>
            )
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 10 }}
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

function DistLine({ data }: { data: DistItem[] }) {
  // Ordenar por label numérico quando possível (ex.: mes_1..mes_12)
  const sorted = [...data].sort((a, b) => {
    const an = parseInt(a.label.replace(/[^\d]/g, ''), 10)
    const bn = parseInt(b.label.replace(/[^\d]/g, ''), 10)
    if (!isNaN(an) && !isNaN(bn)) return an - bn
    return a.label.localeCompare(b.label)
  })
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={sorted} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString()} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null
            const p = payload[0].payload as DistItem
            return (
              <div className="bg-background border border-border rounded-md p-2 text-xs shadow-md">
                <div className="font-medium">{p.label}</div>
                <div className="tabular-nums">{p.count.toLocaleString('pt-BR')} casos</div>
              </div>
            )
          }}
        />
        <Line type="monotone" dataKey="count" stroke="#0284c7" strokeWidth={2} dot={{ r: 3, fill: '#0284c7' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function DistributionCharts({ distribuicoes }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribuições da Base de Sinistros</CardTitle>
        <CardDescription>
          Perfis demográficos e circunstanciais dos {distribuicoes.alvo.reduce((s, d) => s + d.count, 0).toLocaleString('pt-BR')} registros analisados.
          Use estas distribuições para contextualizar campanhas sazonais/geográficas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="alvo">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="alvo">Alvo</TabsTrigger>
            <TabsTrigger value="uf">UF (Top 15)</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
            <TabsTrigger value="periodo">Período do dia</TabsTrigger>
            <TabsTrigger value="fase">Fase do dia</TabsTrigger>
            <TabsTrigger value="causa">Causa (Top 15)</TabsTrigger>
            <TabsTrigger value="tipo">Tipo (Top 15)</TabsTrigger>
            <TabsTrigger value="cond">Meteorologia</TabsTrigger>
            <TabsTrigger value="pista">Tipo pista</TabsTrigger>
            <TabsTrigger value="solo">Uso solo</TabsTrigger>
            <TabsTrigger value="dia">Dia semana</TabsTrigger>
            <TabsTrigger value="vei">Veículos</TabsTrigger>
          </TabsList>

          <TabsContent value="alvo" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Distribuição do alvo (classificacao_acidente)</h4>
            <DistPie data={distribuicoes.alvo} />
            <p className="mt-2 text-xs text-muted-foreground">
              Classes desbalanceadas — 77,5% / 15,4% / 7,2%. Por isso usamos <code className="font-mono">class_weight=&quot;balanced&quot;</code>.
            </p>
          </TabsContent>

          <TabsContent value="uf" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Top 15 Unidades Federativas</h4>
            <DistBar data={distribuicoes.uf} layout="vertical" color="#0f766e" />
          </TabsContent>

          <TabsContent value="mes" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Sazonalidade mensal</h4>
            <DistLine data={distribuicoes.mes} />
            <p className="mt-2 text-xs text-muted-foreground">Derivado de <code className="font-mono">data_inversa → mes</code>.</p>
          </TabsContent>

          <TabsContent value="periodo" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Período do dia (derivação de horario)</h4>
            <DistBar data={distribuicoes.periodo_dia} color="#7c3aed" />
          </TabsContent>

          <TabsContent value="fase" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Fase do dia (original)</h4>
            <DistBar data={distribuicoes.fase_dia} color="#be185d" />
          </TabsContent>

          <TabsContent value="causa" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Top 15 causas de acidente</h4>
            <DistBar data={distribuicoes.causa_acidente} layout="vertical" color="#ea580c" />
            <p className="mt-2 text-xs text-muted-foreground mt-2">Categorias {'<'} 1% agrupadas em &quot;Outros&quot; antes do one-hot.</p>
          </TabsContent>

          <TabsContent value="tipo" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Top 15 tipos de acidente</h4>
            <DistBar data={distribuicoes.tipo_acidente} layout="vertical" color="#d97706" />
          </TabsContent>

          <TabsContent value="cond" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Condição meteorológica</h4>
            <DistBar data={distribuicoes.condicao_metereologica} layout="vertical" color="#0891b2" />
          </TabsContent>

          <TabsContent value="pista" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Tipo de pista</h4>
            <DistPie data={distribuicoes.tipo_pista} />
          </TabsContent>

          <TabsContent value="solo" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Uso do solo (urbano vs rural)</h4>
            <DistPie data={distribuicoes.uso_solo} />
          </TabsContent>

          <TabsContent value="dia" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Dia da semana</h4>
            <DistBar data={distribuicoes.dia_semana} color="#475569" />
          </TabsContent>

          <TabsContent value="vei" className="mt-4">
            <h4 className="text-sm font-medium mb-2">Distribuição de veículos envolvidos</h4>
            <DistBar data={distribuicoes.veiculos} color="#dc2626" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
