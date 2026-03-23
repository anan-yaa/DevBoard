import { Router } from 'express';
import { RoomController } from '../controllers/roomController';

export function createRoomRoutes(roomController: RoomController): Router {
  const router = Router();

  // GET /api/rooms/:roomId/users - Get users in a room
  router.get('/:roomId/users', (req, res) => {
    const { roomId } = req.params;
    try {
      const users = roomController.getRoomUsers(roomId);
      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get room users' });
    }
  });

  return router;
}
