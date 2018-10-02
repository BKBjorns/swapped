const express = require('express')
const app = express()
const sqlite3 = require('sqlite3')
const db = new sqlite3.Database("my-database.db")

app.get("/", function(req, res){
 res.send("Hello, World")
})
app.listen(3000)