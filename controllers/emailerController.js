import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from "url";
import mjml from 'mjml';
import fs from 'fs';
import cron from 'node-cron';
import { db } from '../config/db.js';
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

const templatePath = path.join(__dirname, '../emailBody/email.mjml');
const htmlContent = fs.readFileSync(templatePath, 'utf8');

async function sendEmail(username, email, file, generated_text, generated_by, id) {
    if (!file){
        file = 'https://picsum.photos/400';
    }

    const emailData = {
        user_name: username,
        image: file,
        generated: generated_text,
        generated_by: generated_by,
        regards: process.env.OWNER_NAME,
        company: process.env.COMPANY_NAME,
        current_year: new Date().getFullYear(),
        link: "link_example"
    };

    const renderedTemplate = fillTemplate(htmlContent, emailData);

    const { html } = mjml(renderedTemplate);

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: `Hi ${username}`,
            html: html,
        });

        console.log('Email berhasil dikirim:', info.messageId);
    } catch (error) {
        console.error('Error saat mengirim email:', error);
        await db.execute('UPDATE scheduled_messages SET status = "failed" WHERE id = ?', [id]);
    }
}

function convertDateTimeToCron(dateTime) {
    const date = new Date(dateTime + 'Z');
    const minute = date.getUTCMinutes();
    const hour = date.getUTCHours();
    const dayOfMonth = date.getUTCDate();
    const month = date.getUTCMonth() + 1;

    return `${minute} ${hour} ${dayOfMonth} ${month} *`;
}

export const emailer = () => {
    try {
        cron.schedule('0 0 * * *', async() => {
            const scheduled_data = await db.execute("SELECT * FROM scheduled_messages WHERE DATE(schedule) = CURDATE() AND status = 'pending'");
            let count = 0;
            const today = new Date();

            scheduled_data[0].forEach(row => {
                const id = row["id"];
                const username = row["username"];
                const email = row["email"];
                const schedule = row["schedule"];
                const file = row["file"];
                const generated_text = row["generated_text"];
                const generated_by = row["generated_by"];
                console.log(`Schedule from DB: ${schedule}`);

                cronjob(username, email, file, generated_text, generated_by, id, schedule);
                count++;
            });
            console.log(`Running daily schedule check, ${count} jobs in queue today, ${today}`);

            await db.execute("INSERT INTO history_messages (id, username, email, message, schedule, file, generated_text, generated_by, status, created_at) SELECT id, username, email, message, schedule, file, generated_text, generated_by, status, created_at FROM scheduled_messages WHERE status = 'sent'");
            await db.execute("DELETE FROM scheduled_messages WHERE status = 'sent'");
        });
    } catch (err) {
        console.error('Error scheduling cron jobs:', err);
    }
};

export function cronjob(username, email, file, generated_text, generated_by, id, schedule) {
    const cronTime = convertDateTimeToCron(schedule);
    console.log(`Generated Cron Time: ${cronTime}`);

    const job = cron.schedule(cronTime, async () => {
        try {
            console.log(`Executing task for schedule: ${schedule}`);
            
            // await sendEmail(process.env.TEST_EMAIL);
            await sendEmail(username, email, file, generated_text, generated_by, id);
            await db.execute('UPDATE scheduled_messages SET status = "sent" WHERE id = ?', [id]);
            
            job.stop();
            console.log(`Cron job for schedule ${schedule} has been stopped.`);
        } catch (error) {
            console.error(`Failed to send email for schedule ${schedule}:`, error);
            await db.execute('UPDATE scheduled_messages SET status = "failed" WHERE id = ?', [id]);
        }
    });
};