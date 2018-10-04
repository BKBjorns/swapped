const express = require('express')
const app = express()
const sqlite3 = require('sqlite3')
const db = new sqlite3.Database("swapped.db")


// Create a table to store Accounts.
db.run(`CREATE TABLE IF NOT EXISTS Account (
    id integer PRIMARY KEY AUTOINCREMENT,
    email,
    hashedPassword TEXT,
    username TEXT
)`)


// Create a table to store Product posts.
db.run(`CREATE TABLE IF NOT EXISTS ProductPost (
    id integer PRIMARY KEY AUTOINCREMENT,
    postName TEXT NOT NULL,
    price INTEGER,
    category TEXT,
    content TEXT,
    postCreatedAt INTEGER
)`)


// Create a table to store Comment.
db.run(`CREATE TABLE IF NOT EXISTS Comment (
    id integer PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    commentCreatedAt INTEGER
    FOREIGN KEY(accountId) REFERENCES Accounts(id)
    FOREIGN KEY(postId) REFERENCES ProductPost(id)
)`)



app.get("/", function(req, res){
 res.send("Hello, World")
})
app.listen(3000)