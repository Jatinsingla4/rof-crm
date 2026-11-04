// Only the system super_admin role. A custom role whose base role resolves to super_admin does not count:
// userRole is the role the API checks permissions against, roleName is the role stored on the login.
type Who = { userRole?: string; roleName?: string };

export const isSuperAdmin = (req: Who): boolean => req.userRole === 'super_admin' && req.roleName === 'super_admin';

export const requireSuperAdmin = (req: Who, res: { status: (n: number) => { json: (b: object) => unknown } }, next: () => void) =>
  isSuperAdmin(req) ? next() : res.status(403).json({ error: 'Only super_admin can do this' });
