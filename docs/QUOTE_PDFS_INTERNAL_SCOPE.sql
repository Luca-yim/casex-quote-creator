-- Gap found by src/test/db/quote-pdfs-scope.test.ts (2026-08-28):
-- a sales rep can currently INSERT a quote_pdfs row with version = 'internal',
-- even though internal PDFs carry pricing detail reps must not produce.
-- Run against the app database to close it.

DROP POLICY IF EXISTS "Users can record PDFs for their quotes" ON public.quote_pdfs;

CREATE POLICY "Reps record customer PDFs only"
ON public.quote_pdfs FOR INSERT TO authenticated
WITH CHECK (
  generated_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_id
      AND (q.owner_id = auth.uid() OR q.requested_by = auth.uid())
  )
  AND (
    version = 'customer'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('estimator', 'admin')
    )
  )
);

CREATE POLICY "Estimators record any PDF"
ON public.quote_pdfs FOR INSERT TO authenticated
WITH CHECK (
  generated_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('estimator', 'admin')
  )
);
