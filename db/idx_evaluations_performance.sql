-- Índice compuesto para acelerar la paginación con ORDER BY created_at DESC
-- La consulta en getEvaluationReportMetrics() y getEvaluationReports() ordena
-- por created_at desc con 5 joins (survey, campus, convenio, student, tutor).
-- Incluir id al final hace que la paginación sea determinista cuando hay filas
-- con el mismo created_at, y permite index-only scans más eficientes.

create index if not exists evaluations_paginate_idx
  on public.evaluations (created_at desc, id desc);
