import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SimuladorUnitario from '@/components/simulator/SimuladorUnitario';
import PlanejamentoTributario from '@/components/simulator/PlanejamentoTributario';
import ComparadorTributario from '@/components/simulator/ComparadorTributario';
import ResumoTributario from '@/components/simulator/ResumoTributario';
import { getAllSubcategories, getScenariosForSubcategory } from '@/lib/taxScenarios';

export interface PlanejamentoRow {
  revenue: number;
  scenarioId: string;
}

export type PlanejamentoRows = Record<string, PlanejamentoRow>;

/**
 * Build a stable key per subcategory (category|subcategory) so the same
 * subcategory name under different categories (e.g., "Parceiros") is kept
 * distinct in the shared rows state.
 */
export function buildRowKey(category: string, subcategory: string): string {
  return `${category}|${subcategory}`;
}

function createInitialRows(): PlanejamentoRows {
  const rows: PlanejamentoRows = {};
  for (const sub of getAllSubcategories()) {
    const scenarios = getScenariosForSubcategory(sub.category, sub.subcategory);
    const firstScenario = scenarios[0];
    rows[buildRowKey(sub.category, sub.subcategory)] = {
      revenue: 1_000_000,
      scenarioId: firstScenario?.id ?? '',
    };
  }
  return rows;
}

export default function SimuladorTributario() {
  const [planejamentoRows, setPlanejamentoRows] =
    useState<PlanejamentoRows>(createInitialRows);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Simulador Tributário — Lucro Presumido
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Calculadora e planejamento fiscal baseados na planilha de otimização
          tributária da O2 Inc. Use as abas abaixo para simular cenários unitários,
          planejar a carga anual por BU, comparar alternativas e consolidar
          o resumo executivo.
        </p>
      </div>

      <Tabs defaultValue="simulador" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
          <TabsTrigger value="planejamento">Planejamento</TabsTrigger>
          <TabsTrigger value="comparador">Comparador</TabsTrigger>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="simulador" className="mt-4">
          <SimuladorUnitario />
        </TabsContent>
        <TabsContent value="planejamento" className="mt-4">
          <PlanejamentoTributario
            rows={planejamentoRows}
            setRows={setPlanejamentoRows}
          />
        </TabsContent>
        <TabsContent value="comparador" className="mt-4">
          <ComparadorTributario />
        </TabsContent>
        <TabsContent value="resumo" className="mt-4">
          <ResumoTributario rows={planejamentoRows} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
