const Device = require('../models/device');

const socketController = (io) => {
  io.on('connection', (socket) => {
    console.log('socket connected:', socket.id);
    console.log('authenticated user:', socket.user.id);

    socket.on('join-device', async (dev_id) => {
      try {
        // ✅ AUTHORIZATION: user must own this device
        const hasDevice = socket.user.devices.some(
          (d) => d.toString() === dev_id
        );

        if (!hasDevice) {
          console.log('❌ unauthorized device access blocked:', dev_id);
          return;
        }

        socket.join(dev_id);
        console.log(`✅ User ${socket.user.id} joined device room ${dev_id}`);
      } catch (err) {
        console.error('join-device error:', err);
      }
    });

    socket.on('leave-device', (dev_id) => {
      socket.leave(dev_id);
      console.log(`User ${socket.user.id} left device room ${dev_id}`);
    });

    socket.on('disconnect', () => {
      console.log('socket disconnected:', socket.id);
    });
  });
};

module.exports = socketController;