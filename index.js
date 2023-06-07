const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const colors = require('colors');
const path = require('path');
require("dotenv").config();
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();

// middlewares 
app.use(cors())
app.use(express.json())


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

        // add a user to db 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await AllUsersCollection.findOne(query);
            if (existingUser) {
                res.status(200).json({
                    status: "success",
                    data: "user already exits"
                })
            }
            const result = await AllUsersCollection.insertOne(user);
            res.status(200).json({
                status: "success",
                data: result
            })
        })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
})

app.listen(port, () => {
    console.log(`Server Running on ${port}`.cyan);
});