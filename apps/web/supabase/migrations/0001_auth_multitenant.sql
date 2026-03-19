-- apps/web/supabase/migrations/0001_auth_multitenant.sql

-- Organizations (tenants)
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  github_org  text,
  plan        text NOT NULL DEFAULT 'free',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Organization members
CREATE TABLE organization_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Invitations (id = invite token)
CREATE TABLE invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text,
  role            text NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by      uuid NOT NULL REFERENCES auth.users(id),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at     timestamptz
);

-- RLS: enable on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS: organizations — user sees only their orgs
CREATE POLICY "users see their orgs"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Helper function (SECURITY DEFINER bypasses RLS — breaks the recursion)
CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS TABLE(organization_id uuid)
LANGUAGE sql
SECURITY DEFINER
VOLATILE
AS $$
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$;

-- RLS: organization_members — user sees members of their orgs (uses SECURITY DEFINER helper)
CREATE POLICY "users see members of their orgs"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM public.get_my_org_ids())
  );

-- RLS: invitations — admins/owners see invites for their orgs
CREATE POLICY "admins see org invitations"
  ON invitations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- JWT Custom Claims Hook: adds org_roles to JWT
-- This lets middleware check membership without a DB round-trip
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  claims jsonb;
  org_roles jsonb;
BEGIN
  claims := event -> 'claims';

  SELECT jsonb_object_agg(organization_id::text, role)
  INTO org_roles
  FROM organization_members
  WHERE user_id = (event ->> 'user_id')::uuid;

  claims := jsonb_set(
    claims,
    '{org_roles}',
    COALESCE(org_roles, '{}'::jsonb)
  );

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- organizations: any authenticated user can create an org
CREATE POLICY "authenticated users can create orgs"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- organization_members: users can only insert themselves
CREATE POLICY "users can join orgs"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- invitations: admins/owners can create invites for their orgs
CREATE POLICY "admins can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.get_my_org_ids()
    )
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = invitations.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- invitations: admins/owners can revoke (delete) invites for their orgs
CREATE POLICY "admins can revoke invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.get_my_org_ids()
    )
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = invitations.organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );
