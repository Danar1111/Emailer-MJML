import { db } from '../config/db.js';
import { ExpressValidator, validationResult } from 'express-validator';

export const upload = async(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array() });
    }

    const { username, email, message, schedule } = req.body;

    try {
        await db.execute('INSERT INTO scheduled_messages (username, email, message, schedule) VALUES (?,?,?,?)', [username, email, message, schedule]);

        res.status(200).send({
            error: false,
            message: 'Successfully added message'
        })

    } catch (err) {
        console.error('Error during add schedule:', err);
        res.status(500).send({ error: true, message: 'server error'});
    };
};