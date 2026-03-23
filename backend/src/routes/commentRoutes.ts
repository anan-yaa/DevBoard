import { Router } from 'express';
import { CommentController } from '../controllers/commentController';

export function createCommentRoutes(commentController: CommentController): Router {
  const router = Router();

  // GET /api/comments/:roomId - Get comments for a room
  router.get('/:roomId', (req, res) => {
    const { roomId } = req.params;
    try {
      const comments = commentController.getRoomComments(roomId);
      res.json({ comments });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get room comments' });
    }
  });

  return router;
}
