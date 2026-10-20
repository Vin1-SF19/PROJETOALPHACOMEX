'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Dados de exemplo para os gráficos
const dataVendas = [
  { mes: 'Jan', vendas: 4000, meta: 3800 },
  { mes: 'Fev', vendas: 3000, meta: 3900 },
  { mes: 'Mar', vendas: 2000, meta: 2000 },
  { mes: 'Abr', vendas: 2780, meta: 1890 },
  { mes: 'Mai', vendas: 1890, meta: 2390 },
  { mes: 'Jun', vendas: 2390, meta: 3490 },
];

const dataMarketing = [
  { mes: 'Jan', leads: 4000, conversoes: 2400 },
  { mes: 'Fev', leads: 3000, conversoes: 1398 },
  { mes: 'Mar', leads: 2000, conversoes: 9800 },
  { mes: 'Abr', leads: 2780, conversoes: 3908 },
  { mes: 'Mai', leads: 1890, conversoes: 4800 },
  { mes: 'Jun', leads: 2390, conversoes: 3800 },
];

const dataFinanceiro = [
  { mes: 'Jan', receita: 4000, despesas: 2400 },
  { mes: 'Fev', receita: 3000, despesas: 1398 },
  { mes: 'Mar', receita: 2000, despesas: 9800 },
  { mes: 'Abr', receita: 2780, despesas: 3908 },
  { mes: 'Mai', receita: 1890, despesas: 4800 },
  { mes: 'Jun', receita: 2390, despesas: 3800 },
];

export default function AlphaBIPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Alpha Business Intelligence</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Total de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dataVendas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="vendas" fill="#8884d8" />
                <Bar dataKey="meta" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversões de Marketing</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dataMarketing}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="leads" stroke="#8884d8" activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="conversoes" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fluxo Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dataFinanceiro}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="receita" stackId="1" stroke="#8884d8" fill="#8884d8" />
                <Area type="monotone" dataKey="despesas" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo Executivo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Bem-vindo ao painel Alpha BI. Aqui você encontrará dashboards interativos
            com métricas de vendas, marketing e financeiro para tomada de decisão estratégica.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
