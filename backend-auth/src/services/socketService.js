/**
 * Socket.io Service
 * Singleton para emitir eventos desde cualquier parte del backend
 */

let io = null;

module.exports = {
  /**
   * Initialize with Socket.io instance
   */
  init(socketIo) {
    io = socketIo;
  },

  /**
   * Get Socket.io instance
   */
  getIO() {
    if (!io) {
      throw new Error('Socket.io not initialized');
    }
    return io;
  },

  /**
   * Emit event to all users connected to a specific computer
   * @param {string} computerId - MongoDB ObjectId of the computer
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  emitToComputer(computerId, event, data) {
    if (io) {
      io.to(`computer:${computerId}`).emit(event, data);
    }
  },

  /**
   * Emit event to all connected users
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  emitToAll(event, data) {
    if (io) {
      io.emit(event, data);
    }
  }
};
