import express from 'express';
import bodyParser from 'body-parser';
import router from './routes/api.js';
import { emailer } from './controllers/emailerController.js';
import { db } from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
const PORT = 3333;

app.use(router);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(PORT, () => {
    console.log(`Server running on Port ${PORT}`);
    db.execute('SELECT 1').then(() => {
        console.log('Database connection successfully');
    }).catch((err) => {
        console.error('Database connection failed:', err);
    });
    emailer();
});