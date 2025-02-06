import { db } from '../config/db.js';
import { ExpressValidator, validationResult } from 'express-validator';
import multer from 'multer';
import path from "path";
import fs from  "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadPath = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        setImmediate(() => {
            const uniqueSuffix = `${Date.now()}-${Math.round(10000 + Math.random() * 90000)}`;
            cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
        });
    },
});

const uploadFile = multer({ storage }).single('file');

export const upload = async(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array() });
    }

    const { username, email, message, schedule } = req.body;

    try {
        if(req.file) {
            const fileUrl = `${req.protocol}://${req.headers.host}/uploads/${req.file.filename}`;
            await db.execute('INSERT INTO scheduled_messages (username, email, message, schedule, file) VALUES (?,?,?,?,?)', [username, email, message, schedule, fileUrl]);
        } else {
            await db.execute('INSERT INTO scheduled_messages (username, email, message, schedule) VALUES (?,?,?,?)', [username, email, message, schedule]);
        }

        res.status(200).send({
            error: false,
            message: 'Successfully added message'
        })

    } catch (err) {
        console.error('Error during add schedule:', err);
        res.status(500).send({ error: true, message: 'server error'});
    };
};

export { uploadFile };