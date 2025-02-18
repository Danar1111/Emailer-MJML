import express from 'express';
import { upload, uploadFile } from '../controllers/userController.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.get(
    '/',
    (req, res) => {
        res.sendFile(path.join(__dirname, "..", "public", "message.html"));
    }
);

router.get(
    '/success',
    (req, res) => {
        res.sendFile(path.join(__dirname, "..", "public", "success.html"));
    }
);

router.post(
    '/upload',
    uploadFile,
    (req, res, next) => {
        upload(req, res, next);
    }
)

export default router;