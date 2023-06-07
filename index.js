const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const colors = require('colors');
const jwt = require('jsonwebtoken');
const path = require('path');
require("dotenv").config();
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();

// middlewares 
app.use(cors())
app.use(express.json())
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).json({
            error: true,
            message: "Unauthorized access"
        })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                error: true,
                message: "Unauthorized access"
            })
        }
        req.decoded = decoded;
    });
    next();
}


// Database Connection 

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zse5se0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Database Connected".yellow);
        // database
        const AllUsersCollection = client.db("sportsacademydb").collection("Users");

        // jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_TOKEN, { expiresIn: '3h' })
            res.send({ token })
        })

        // add a user to db 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await AllUsersCollection.findOne(query);
            if (existingUser) {
                return res.status(200).json({
                    status: "false",
                    data: "user already exits"
                })
            }
            const result = await AllUsersCollection.insertOne(user);
            res.status(200).json({
                status: "success",
                data: result
            })
        })

        // get all user 
        app.get('/users', verifyJWT, async (req, res) => {
            const query = {};
            const result = await AllUsersCollection.find().toArray();
            res.send(result)
        })
        // get a user 
        app.get('/users/single/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await AllUsersCollection.findOne(query);
            res.send(result)
        })

        // create admin
        app.put('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const updatedDoc = {
                $set: { role: 'admin' },
            }
            const result = await AllUsersCollection.updateOne(filter, updatedDoc);
            res.send(result)

        })
        // remove admin
        app.put('/users/removeadmin/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const updatedDoc = {
                $set: { role: 'student' },
            }
            const result = await AllUsersCollection.updateOne(filter, updatedDoc);
            res.send(result)

        })

        // create instructor
        app.put('/users/instructor/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const updatedDoc = {
                $set: { role: 'instructor' },
            }
            const result = await AllUsersCollection.updateOne(filter, updatedDoc);
            res.send(result)

        })
        // remove instructor
        app.put('/users/removeinstructor/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const updatedDoc = {
                $set: { role: 'student' },
            }
            const result = await AllUsersCollection.updateOne(filter, updatedDoc);
            res.send(result)

        })

        // delete a user 
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await AllUsersCollection.deleteOne(query);
            res.send(result)
        })


    } finally {

    }
}
run().catch(console.dir);



app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
})

app.listen(port, () => {
    console.log(`Server Running on ${port}`.cyan);
});