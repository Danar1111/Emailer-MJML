import { db } from '../config/db.js';
import { validationResult } from 'express-validator';
import multer from 'multer';
import path from "path";
import fsSync from  "fs";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { cronjob } from './emailerController.js';
import sharp from 'sharp';
import fs from 'fs/promises';
dotenv.config();

const keys = process.env.API_KEYS;
const genAI = new GoogleGenerativeAI(keys);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generated(message, username) {
    let input = `Give a meaningful quote for ${username} that ${message}. The quote can be original or from a famous person. Please provide a response in this format: generated_text ;; source famous person (modified for ${username}) or type "system" if original generated. Ensure the quote is inspiring, relevant, and well-structured.`;
    try {
        const prompt = input;
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch(err){
        console.error('Error contacting Gemini API:', err.message);
    }
}

const uploadPath = path.join(__dirname, "../uploads");
if (!fsSync.existsSync(uploadPath)) fsSync.mkdirSync(uploadPath);

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

async function compressImage(filePath) {
    try {
        const outputFilePath = filePath.replace(path.extname(filePath), ".webp");

        const fileBuffer = await fs.readFile(filePath);

        const compressedBuffer = await sharp(fileBuffer)
            .rotate()
            .resize({ width: 1024 })
            .toFormat('webp', { quality: 80 })
            .toBuffer();

        await fs.writeFile(outputFilePath, compressedBuffer);

        await fs.unlink(filePath);

        return outputFilePath;
    } catch (error) {
        console.error("Error compressing image:", error);
        return filePath;
    }
}

async function generated_quote(username, message) {
    const generated_message = await generated(message, username);

    const regex = /^(.*?)\s*;;\s*(.+)$/s;
    const match = generated_message.match(regex);

    let generated_text = generated_message;
    let generated_by = 'system';

    if (match) {
        generated_text = match[1].trim();
        generated_by = match[2].trim();

        return { generated_text, generated_by };
    } else {
        console.warn('Regex did not match. Message format may be incorrect.');
    }
}

export const upload = async(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array() });
    }

    const { username, email, message, schedule } = req.body;

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
            let { generated_text, generated_by } = await generated_quote(username, message);
            if(req.file) {
                const compressFilePath = await compressImage(req.file.path);
                fileUrl = `${req.protocol}://${req.headers.host}/uploads/${path.basename(compressFilePath)}`;
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
            if (req.file) fsSync.unlinkSync(req.file.path);
            throw 'Date Time Not Valid';
        }
        else
        {
            let { generated_text, generated_by } = await generated_quote(username, message);
            if(req.file) {
                const compressFilePath = await compressImage(req.file.path);
                fileUrl = `${req.protocol}://${req.headers.host}/uploads/${path.basename(compressFilePath)}`;
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

        if (req.file) fsSync.unlinkSync(req.file.path);

        res.status(500).send({ error: true, message: err});
    };
};

export { uploadFile };