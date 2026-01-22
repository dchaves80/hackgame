const jwt = require('jsonwebtoken');

/**
 * Middleware para verificar JWT token
 * Agrega req.user con { userId, username, email }
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided. Authorization required.'
      });
    }

    // Extraer token
    const token = authHeader.substring(7); // Remove "Bearer "

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Agregar usuario a request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired. Please login again.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token.'
      });
    }

    return res.status(500).json({
      error: 'Authentication failed.',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

module.exports = authMiddleware;
