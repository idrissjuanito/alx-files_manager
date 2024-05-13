import redisClient from '../utils/redis';

const authMiddleware = async (req, res, next) => {
  const token = req.get('X-Token');
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  res.locals.userId = userId;
  return next();
};

export default authMiddleware;
