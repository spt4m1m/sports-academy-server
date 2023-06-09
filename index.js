const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const colors = require('colors');
const jwt = require('jsonwebtoken');
const path = require('path');
require("dotenv").config();
const cors = require('cors');
const stripe = require('stripe')(process.env.PAYMENT_TOKEN)
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
        const AllClassCollection = client.db("sportsacademydb").collection("Classes");
        const SelectedClassCollection = client.db("sportsacademydb").collection("SelectedClass");
        const PaymentCollection = client.db("sportsacademydb").collection("Payments");
        const EnrolledClassCollection = client.db("sportsacademydb").collection("EnrolledClass");

        // jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_TOKEN, { expiresIn: '3h' })
            res.send({ token })
        })

        // admin verify 
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await AllUsersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // ------------------ payment related  api ----------------------//
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = price * 100
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // save payment to db 
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await PaymentCollection.insertOne(payment);
            const query = { _id: { $in: payment.classesId.map(id => new ObjectId(id)) } }
            const enrolledclasses = await SelectedClassCollection.find(query).toArray();

            // update class enrolled increase or availableseat decrease by 1 
            const names = payment.classesName.map(name => (name));
            const updatedDoc = {
                $inc: { availableseat: -1, enrolled: 1 }
            }
            const updateClass = await AllClassCollection.updateMany({ classname: { $in: names } }, updatedDoc);

            // save enrolled class in db 
            const enrolledclassresult = await EnrolledClassCollection.insertMany(enrolledclasses);

            // delete selected class 
            const deletedResult = await SelectedClassCollection.deleteMany(query);
            res.send({ result, deletedResult, enrolledclassresult, updateClass })
        });

        // get all payment history 
        app.get('/paymenthistory', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { paymentuser: email }
            const result = await PaymentCollection.find(query).toArray();
            res.send(result)
        })

        // get all enrolled class
        app.get('/enrolledclass', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { studentemail: email };
            const result = await EnrolledClassCollection.find(query).toArray();
            res.send(result)
        })


        // ------------------ code about user ------------ //
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
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
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


        // get all instructor 
        app.get('/instructors', verifyJWT, async (req, res) => {
            const query = { role: 'instructor' };
            const result = await AllUsersCollection.find(query).toArray();
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

        // ------------------ code end about user ------------ //


        // ------------------ code about class ------------ //

        // add a class in db 
        app.post('/classes', async (req, res) => {
            const data = req.body;
            const result = await AllClassCollection.insertOne(data)
            res.send({ result })
        })

        // get all class 
        app.get('/classes', async (req, res) => {
            const email = req.query.email;
            const status = req.query.status;
            let query = {};
            if (email) {
                query = { instructoremail: email }
            }
            if (status == "approved") {
                query = { status: "approved" }
            }
            const result = await AllClassCollection.find(query).toArray();
            res.send(result)
        })

        // change class status 
        app.put('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.query.status;
            const filter = { _id: new ObjectId(id) };
            let updatedDoc;
            if (status == "approved") {
                updatedDoc = {
                    $set: { status: 'approved' },
                }
                const result = await AllClassCollection.updateOne(filter, updatedDoc);
                return res.send({ result })
            } else if (status == "deny") {
                updatedDoc = {
                    $set: { status: 'deny' },
                }
                const result = await AllClassCollection.updateOne(filter, updatedDoc);
                return res.send({ result })
            }
        });

        // get single class 
        app.get('/classes/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await AllClassCollection.findOne(query);
            res.send({ result })
        })

        // update a single class 
        app.patch('/classes/update/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    classname: data.classname,
                    classimg: data.classimg,
                    instructorname: data.instructorname,
                    instructoremail: data.instructoremail,
                    availableseat: data.availableseat,
                    price: data.price,
                    status: data.status
                },
                $unset: {
                    feedback: ""
                }
            }
            const result = await AllClassCollection.updateOne(filter, updatedDoc);
            res.send({ result });
        })

        // add feedback in class 
        app.put('/classes/feedback/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const feedbackmsg = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: { feedback: feedbackmsg.feedbackmsg }
            }
            const result = await AllClassCollection.updateOne(filter, updatedDoc);
            res.send({ result })
        })

        // ------------------ code end about class ------------ //

        // ------------------ code about selected class ------------ //

        // add selected class in db 
        app.post('/selectedclass', verifyJWT, async (req, res) => {
            const data = req.body;
            const result = await SelectedClassCollection.insertOne(data)
            res.send({ result })
        })

        // get all selected class
        app.get('/selectedclass', verifyJWT, async (req, res) => {
            const email = req.query.email;
            let query = {};
            if (email) {
                query = { studentemail: email }
            }
            const result = await SelectedClassCollection.find(query).toArray();
            res.send({ result })
        })

        // delete selected class 
        app.delete('/selectedclass/delete/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await SelectedClassCollection.deleteOne(query);
            res.send({ result })
        })


        // ------------------ code end about selected class ------------ //


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