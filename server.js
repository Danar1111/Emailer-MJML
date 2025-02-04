import express from 'express';
import bodyParser from 'body-parser';
import router from './routes/api.js';
import { emailer } from './controllers/emailerController.js';
import { db } from './config/db.js';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
const PORT = 3333;

app.use(router);

app.listen(PORT, () => {
    console.log(`Server running on Port ${PORT}`);
    db.execute('SELECT 1').then(() => {
        console.log('Database connection successfully');
    }).catch((err) => {
        console.error('Database connection failed:', err);
    });
    // emailer();
});