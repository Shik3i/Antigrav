const express = require('express');
const router = express.Router();
const speedcubeController = require('../controllers/speedcubeController');
const { authenticateToken } = require('../controllers/authController');

// All speedcube routes require authentication
router.use(authenticateToken);

router.get('/', speedcubeController.getTimes);
router.post('/', speedcubeController.addTime);
router.patch('/:id/note', speedcubeController.updateNote);
router.delete('/:id', speedcubeController.deleteTime);

module.exports = router;
