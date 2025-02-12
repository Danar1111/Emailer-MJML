import { db } from '../config/db.js';
import { ExpressValidator, validationResult } from 'express-validator';
import multer from 'multer';
import path from "path";
import fs from  "fs";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { cronjob } from './emailerController.js';
dotenv.config();

const keys = process.env.API_KEYS;
const genAI = new GoogleGenerativeAI(keys);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generated(message, username) {
    let input = `give a quote for ${username} that ${message} or from famous people, Please provide a response in this format:generated_text ;; source famous person (modified for ${username}) or type "system" if original generated`
    try {
        const prompt = input;
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch(err){
        console.error('Error contacting Gemini API:', err.message);
    }
}

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
    const generated_message = await generated(message, username);

    const regex = /^(.*?)\s*;;\s*(.+)$/s;
    const match = generated_message.match(regex);

    let generated_text = generated_message;
    let generated_by = 'system';

    if (match) {
        generated_text = match[1].trim();
        generated_by = match[2].trim();
    } else {
        console.warn('Regex did not match. Message format may be incorrect.');
    }

    try {
        let insertResult;
        let return_message;
        let insertedId;
        const now = new Date();
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const scheduleTime = new Date(schedule.replace(' ', 'T'));
        let fileUrl;

        if (scheduleTime <= todayEnd && scheduleTime >= now)
        {
            if(req.file) {
                fileUrl = `${req.protocol}://${req.headers.host}/uploads/${req.file.filename}`;
                insertResult = await db.execute('INSERT INTO scheduled_messages (username, email, message, schedule, file, generated_text, generated_by) VALUES (?,?,?,?,?,?,?)', [username, email, message, schedule, fileUrl, generated_text, generated_by]);
            } else {
                insertResult = await db.execute('INSERT INTO scheduled_messages (username, email, message, schedule, generated_text, generated_by) VALUES (?,?,?,?,?,?)', [username, email, message, schedule, generated_text, generated_by]);
            }
            insertedId = insertResult[0].insertId;
            return_message = "Valid";
            cronjob(username, email, fileUrl, generated_text, generated_by, insertedId, scheduleTime);
        }
        else if (scheduleTime < now)
        {
            if (req.file) fs.unlinkSync(req.file.path);
            throw 'Date Time Not Valid';
        }
        else
        {
            if(req.file) {
                fileUrl = `${req.protocol}://${req.headers.host}/uploads/${req.file.filename}`;
                await db.execute('INSERT INTO scheduled_messages (username, email, message, schedule, file, generated_text, generated_by) VALUES (?,?,?,?,?,?,?)', [username, email, message, schedule, fileUrl, generated_text, generated_by]);
            } else {
                await db.execute('INSERT INTO scheduled_messages (username, email, message, schedule, generated_text, generated_by) VALUES (?,?,?,?,?,?)', [username, email, message, schedule, generated_text, generated_by]);
            }
            return_message = "Valid, Task will be execute with cronjob on that schedule";
        };

        res.status(200).send({
            error: false,
            message: return_message
        })

    } catch (err) {
        console.error('Error during add schedule:', err);

        if (err === 'Date Time Not Valid') {
            return res.status(400).send({ error: true, message: err });
        }

        if (req.file) fs.unlinkSync(req.file.path);

        res.status(500).send({ error: true, message: err});
    };
};

export { uploadFile };