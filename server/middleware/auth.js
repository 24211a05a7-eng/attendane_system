import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'placenix_dev_secret_2024_change_in_prod';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(403).json({ error: 'Forbidden: Login required' });
  }
  next();
}
