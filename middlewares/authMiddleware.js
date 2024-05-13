import redisClient from '../utils/redis';

const authMiddleware = async (req, res, next) => {
  const token = req.get('X-Token');
  const userId = await redisClient.get(`auth_${token}`);
  res.locals.userId = userId;
  if (!userId) {
    if (req.url.endsWith('data')) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};

export default authMiddleware;
