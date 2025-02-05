import express from 'express';
import { upload, uploadFile } from '../controllers/userController.js';
const router = express.Router();

router.post(
    '/upload',
    uploadFile,
    (req, res, next) => {
        upload(req, res, next);
    }
)

export default router;