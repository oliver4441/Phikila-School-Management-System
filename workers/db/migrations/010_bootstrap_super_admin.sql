-- Bootstrap first super admin.
-- Run against the Neon database when no tt_platform_admins rows exist.
-- Replace the user_id with the UUID returned by the /api/v1/auth/firebase endpoint.

-- Step 1: The user c68c0a28-71e6-41bd-b860-4829cde9aaf7 was created by
--         POST /api/v1/auth/firebase (superadmin@phikila.com).
-- Step 2: Promote to super admin:
INSERT INTO tt_platform_admins (user_id, role)
VALUES ('c68c0a28-71e6-41bd-b860-4829cde9aaf7', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
