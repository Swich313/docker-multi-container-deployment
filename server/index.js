const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');

const keys = require('./keys');

// Express App Setup
const app = express();

app.use(cors());
app.use(express.json());

// Postgres Client Setup
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort,
    ssl: process.env.NODE_ENV !== 'production' ? false : {rejectUnauthorized: false}
});

// pgClient.on('error', () => console.log('Lost PG connection'));

pgClient.on('connect', (client) => {
    client
        .query('CREATE TABLE IF NOT EXISTS values (number INT)')
        .catch(err => console.log(err))
});

// Redis Client Setup
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000   //after connection failed try to reconnect once every 1000 ms
});

const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req, res) => {
    res.send('HI!')
});

app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * FROM values');
    if(!values){
        return res.status(204).send('No values!')
    }

    res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
    redisClient.hgetall('values', (err, values) => {
        res.send(values)
    });
});

app.post('/values', async (req, res) => {
    const index = req.body.index;

    if(parseInt(index) > 40) {
        return res.status(422).send('Index is too high!')
    }

    redisClient.hset('values', index, 'Nothing yet!');
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    res.send({working: true});
});

app.listen(5000, err => {
    console.log('Listening on port 5000');
})