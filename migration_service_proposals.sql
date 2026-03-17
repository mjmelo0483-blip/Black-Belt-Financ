-- Create table for Service Proposals
CREATE TABLE IF NOT EXISTS public.service_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'cancelled')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.service_proposals ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can insert their own proposals"
ON public.service_proposals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own proposals"
ON public.service_proposals FOR SELECT
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_members.company_id = service_proposals.company_id 
    AND company_members.user_id = auth.uid()
));

CREATE POLICY "Users can update their own proposals"
ON public.service_proposals FOR UPDATE
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_members.company_id = service_proposals.company_id 
    AND company_members.user_id = auth.uid()
))
WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM company_members 
    WHERE company_members.company_id = service_proposals.company_id 
    AND company_members.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own proposals"
ON public.service_proposals FOR DELETE
USING (auth.uid() = user_id);
