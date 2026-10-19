import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

// Usage: @RequirePermissions('product.create')
// Matches the permission codes seeded from the frontend's permission catalog
// (see prisma/seed.ts and frontend core/services/mock-data.service.ts).
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
