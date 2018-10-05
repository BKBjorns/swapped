const express = require('express')
const app = express()
const sqlite3 = require('sqlite3')
const db = new sqlite3.Database("swapped.db")
const bodyParser = require('body-parser')


app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

// Create a table to store Accounts.
db.run(`CREATE TABLE IF NOT EXISTS Account (
    id integer PRIMARY KEY AUTOINCREMENT,
    email,
    hashedPassword TEXT,
    username TEXT
)`)


// Create a table to store Product posts.
db.run(`CREATE TABLE IF NOT EXISTS ProductPost (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    postName TEXT NOT NULL,
    price INTEGER,
    category TEXT,
    content TEXT,
    postCreatedAt INTEGER
)`)


// Create a table to store Comment.
db.run(`CREATE TABLE IF NOT EXISTS Comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    accountId INTEGER,
    postId INTEGER,
    title TEXT,
    content TEXT,
    commentCreatedAt INTEGER,
    FOREIGN KEY(accountId) REFERENCES Account(id),
    FOREIGN KEY(postId) REFERENCES ProductPost(id)
)`)


// ===
// Create new Product post.
// ===

app.post("/ProductPost", function(req, res){
    const newProduct = req.body
    var newProductError = []

    // Missing validation for price and category.

    if(newProduct.postName.length < 3){
        newProductError.push("The post name is too short")
    }
    
    if (newProduct.postName.length > 50){
        newProductError.push("The post name is too long")
    }


    if(newProduct.content.length < 10){
        newProductError.push("The content is too short")
    }
    
    if (newProduct.content.length > 100){
        newProductError.push("The content is too long")
    }



    if(newProductError.length == 0){

        const query = "INSERT INTO ProductPost(postName, price, category, content, postCreatedAt) VALUES (?, ?, ?, ?, ?)"
        db.run(query, [newProduct.postName, newProduct.price, newProduct.category, newProduct.content, newProduct.postCreatedAt], function(error){
            if(error){
                res.status(500).end()
            }else{
                const numberOfInsertRows = this.changes
                if(numberOfInsertRows == 0){
                    res.status(404).end()
                }else{
                    res.status(201).end()
                }
            }
        })
    } else{
        res.status(400).json(newProductError)
        return
    }

})






app.get("/", function(req, res){
 res.send("Hello, World")
})
app.listen(3000)