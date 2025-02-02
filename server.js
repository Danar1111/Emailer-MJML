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

function fillTemplate(template, data) {
    return template
        .replace(/{{user_name}}/g, data.user_name)
        .replace(/{{image}}/g, data.image)
        .replace(/{{generated}}/g, data.generated)
        .replace(/{{generated_by}}/g, data.generated_by)
        .replace(/{{regards}}/g, data.regards)
        .replace(/{{company}}/g, data.company)
        .replace(/{{current_year}}/g, data.current_year)
        .replace(/{{link}}/g, data.link);
}

async function sendEmail(toEmail) {
    const templatePath = path.join(__dirname, 'emailBody/email.mjml');
    const htmlContent = fs.readFileSync(templatePath, 'utf8');

    const emailData = {
        user_name: 'User Name',
        image: 'https://picsum.photos/400',
        generated: 'The future belongs to those who believe in the beauty of their dreams.',
        generated_by: 'Eleanor Roosevelt',
        regards: 'Owner Name',
        company: 'Company Name',
        current_year: new Date().getFullYear(),
        link: "link_example"
    };

    const renderedTemplate = fillTemplate(htmlContent, emailData);

    const { html } = mjml(renderedTemplate);

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: toEmail,
            subject: 'Hi There!',
            html: html,
        });

        console.log('Email berhasil dikirim:', info.messageId);
    } catch (error) {
        console.error('Error saat mengirim email:', error);
    }
}

sendEmail('priyambodo02@gmail.com');