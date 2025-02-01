import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from "url";
import mjml from 'mjml';
import fs from 'fs';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD 
    }
});

async function sendEmail(toEmail) {
    const templatePath = path.join(__dirname, 'emailBody/email.mjml');
    const htmlContent = fs.readFileSync(templatePath, 'utf8');
    const { html } = mjml(htmlContent);

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: toEmail,
            subject: 'Hi!',
            html: html,
        });

        console.log('Email berhasil dikirim:', info.messageId);
    } catch (error) {
        console.error('Error saat mengirim email:', error);
    }
}

sendEmail('priyambodo02@gmail.com');