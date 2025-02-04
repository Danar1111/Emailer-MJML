import express from 'express';
import { upload } from '../controllers/userController.js';
const router = express.Router();

router.post(
    '/upload',
    (req, res, next) => {
        upload(req, res, next);
    }
)

export default router;