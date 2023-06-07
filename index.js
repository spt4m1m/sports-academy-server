const express = require('express');
const colors = require('colors');
const path = require('path');
require("dotenv").config();
const cors = require('cors');
const port = process.env.PORT || 5000;
const app = express();

// middlewares 
app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
})

app.listen(port, () => {
    console.log(`Server Running on ${port}`.cyan);
});