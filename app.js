const express = require('express')
const app = express()
const sqlite3 = require('sqlite3')
const db = new sqlite3.Database("swapped.db")
const bodyParser = require('body-parser')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')


app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

// Create a table to store Accounts. 
// Added accountId to all three tables, checkes if the right person is creating the post/comment.
db.run(`CREATE TABLE IF NOT EXISTS Account (
    id integer PRIMARY KEY AUTOINCREMENT,
    email TEXT unique,
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
    postCreatedAt INTEGER,
    accountId INTEGER
)`)


// Create a table to store Comment.
db.run(`CREATE TABLE IF NOT EXISTS Comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    accountId INTEGER,
    postId INTEGER,
    title TEXT,
    content TEXT,
    commentCreatedAt INTEGER,
    FOREIGN KEY(\`accountId\`) REFERENCES \`Account\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY(\`postId\`) REFERENCES \`ProductPost\`(\`id\`) ON DELETE CASCADE
)`)

// Function used to validate a ProductPost resource.
// Returns an array with error codes.
function validatePost(productPost){
	
	const postErrors = []

	if(productPost.postName.length < 3){
		postErrors.push("The post name is too short")
	}

	if(productPost.postName.length > 50){
		postErrors.push("The post name is too long")
	}

	if(productPost.price < 0){
		postErrors.push("You have inserted negative number")
	}

	if(productPost.content.length < 10){
		postErrors.push("The content is too short")
	}

	if(productPost.content.length > 1000){
		postErrors.push("The content is too long")
	}

	if (productPost.category != "Furniture" && productPost.category != "Clothes" && productPost.category != "Technology" && productPost.category != "Other"){
		postErrors.push("You haven't selected the right category.")
}

	return postErrors

}

function validateAccount(accountUpdate){
	
	const accountErrors = []

	if(productPost.postName.length < 3){
		postErrors.push("The post name is too short")
	}

	if(productPost.postName.length > 50){
		postErrors.push("The post name is too long")
	}

	if(productPost.price < 0){
		postErrors.push("You have inserted negative number")
	}

	if(productPost.content.length < 10){
		postErrors.push("The content is too short")
	}

	if(productPost.content.length > 1000){
		postErrors.push("The content is too long")
	}

	if (productPost.category != "Furniture" && productPost.category != "Clothes" && productPost.category != "Technology" && productPost.category != "Other"){
		postErrors.push("You haven't selected the right category.")
}

	return postErrors

}


// ===
// Create a new Account.
// ===
const saltRounds = 10

app.post("/accounts", function(request, response){

    const email = request.body.email
	const hashedPassword = request.body.hashedPassword
    const theHash = bcrypt.hashSync(hashedPassword, saltRounds)
    const username = request.body.username
    const values = [email, hashedPassword, username]
    

    var accountErrors = [] 
    if(username.length < 3){
        accountErrors.push("Username is too short.")
    }
    if(username.length > 30){
        accountErrors.push("Username is too long.")
    }
    
    if(!email.endsWith('@student.ju.se')){
        accountErrors.push("This is not JU email.")
    }

    if(accountErrors.length == 0) { 
        const query = `
		INSERT INTO Account (email, hashedPassword, username)
		VALUES (?, ?, ?)
	`
    db.run(query, values, function(error){
		if(error){
            if(error.message == "SQLITE_CONSTRAINT: UNIQUE constraint failed: Account.email"){
            response.status(400).json(["Email taken."]) 
            }
            else {
                response.status(500).end()
            }
		}else {
			response.setHeader("Location", "/accounts/"+this.lastID)
			response.status(201).end()
        } 
	}) 
    }
	else {
        response.status(400).json(accountErrors)
    }

})

// ===
// Getting a new Account(s).
// ===
app.get("/accounts/:id", function(request, response){
	const id = request.params.id
	const query = "SELECT * FROM Account WHERE id = ?"
	const values = [id]
	db.get(query, values, function(error, email){
		if(error){
			response.status(500).end()
		}else if(!email){
			response.status(404).end()
		}else{
			response.status(200).json(email)
		}
	})
})

app.get("/accounts", function(request, response){
	const query = "SELECT * FROM Account"
	db.all(query, function(error, email){
		if(error){
			response.status(500).end()
		}else{
			response.status(200).json(email)
		}
	})
})



// ===
// Logging into an account.
// ===

//Tokens
const jwtSecret = "dsjlksdjlkjfdsl"

app.post("/tokens", function(request, response){
	
	const grant_type = request.body.grant_type
	const email = request.body.email
	const hashedPassword = request.body.hashedPassword

	const query = `SELECT * FROM Account WHERE email = ?`
	const values = [email]

	db.get(query, values, function(error, account){
		if(error){
			response.status(500).end()
		}else if(!account){
			response.status(404).json({error: "invalid_client"})
		}else{
			if(account.hashedPassword == hashedPassword){

				const accessToken = jwt.sign({accountId: account.id}, jwtSecret)
				const idToken = jwt.sign({sub: account.id, preferred_email: email}, jwtSecret)
				response.status(200).json({
					access_token: accessToken,
					token_type: "Bearer",
					id_token: idToken
				})

			}else{
				response.status(404).json({error: "invalid_client"})
			}
		}
	})

})



app.post("/accounts", function(request, response){
	
	const title = request.body.title
	const abstract = request.body.abstract
	const accountId = request.body.accountId

	const authorizationHeader = request.get("Authorization")
	const accessToken = authorizationHeader.substr(7)

	let tokenAccountId = null
	try{
		const payload = jwt.verify(accessToken, jwtSecret)
		tokenAccountId = payload.accountId
	}catch(error){
		response.status(401).end()
		return
	}

	if(tokenAccountId != accountId){
		response.status(401).end()
		return
	}

	const query = `
		INSERT INTO Account (email, hashedPassword, username)
		VALUES (?, ?, ?)
	`
	const values = [email, hashedPassword, username]
	
	db.run(query, values, function(error){
		if(error){
			response.status(500).end()
		}else{
			const id = this.lastID
			response.setHeader("Location", "/accounts/"+id)
			response.status(201).end()
		}
	})

})


// ===
// Updating the account.
// ===
app.put("/accounts/:id", function(request, response){
	
	const id = request.params.id
	const receivedAccount = request.body
	const accountId = request.body.accountId
	
	const authorizationHeader = request.get("Authorization")
	const accessToken = authorizationHeader.substr(7)	

    let tokenAccountId = null
	try{
		const payload = jwt.verify(accessToken, jwtSecret)
		tokenAccountId = payload.accountId
	}catch(error){
		response.status(401).end()
		return
	}

	if(tokenAccountId != accountId){
		response.status(401).end()
		return
	}

	// Look for malformed resources.
	if(typeof receivedAccount != "object" ||
		 typeof receivedAccount.username != "string" ||
		 typeof receivedAccount.accountId != "number" ){
			response.status(422).end()
			return
	}

	// Look for validation errors.
	const accountErrors = validateAccount(receivedAccount)

	if(0 < accountErrors.length){
		response.status(400).json(accountErrors)
		return
	}

	// Go ahead and update the resource.
	const query = `
		UPDATE Account SET hashedPassword = ?, username = ?, accountId = ?
		WHERE id = ?
	`
	const values = [
		receivedAccount.hashedPassword,
		receivedAccount.username,
		receievedAccount.accountId,
		id
	]
	db.run(query, values, function(error){
		if(error){
			response.status(500).end()
		}else{
			const id = this.lastID
			response.setHeader("Location", "/accounts/"+ id)
			response.status(204).end()
		}
	})

})


// ===
// Create a new Product post.
// ===

app.post("/ProductPosts", function(request, response){ //Changed the ProductPost to Posts so its coherent with other endings (accounts and comments).
    const postName = request.body.postName				//Need to update the second part of the report.
    const price = request.body.price
    const category = request.body.category
    const content = request.body.content
    const postCreatedAt = request.body.postCreatedAt
    const accountId = request.body.accountId
    const values = [postName, price, category, content, postCreatedAt, accountId]
   
    const authorizationHeader = request.get("Authorization")
	const accessToken = authorizationHeader.substr(7)	

    let tokenAccountId = null
	try{
		const payload = jwt.verify(accessToken, jwtSecret)
		tokenAccountId = payload.accountId
	}catch(error){
		response.status(401).end()
		return
	}

	if(tokenAccountId != accountId){
		response.status(401).end()
		return
	}



    var newProductError = []

    // Missing validation for price and category. FIXED!

    if(postName.length < 3){
        newProductError.push("The post name is too short")
    }
    
    if (postName.length > 50){
        newProductError.push("The post name is too long")
    }

	if (price < 0){
        newProductError.push("You have inserted negative number")
    }

    if(content.length < 10){
        newProductError.push("The content is too short")
    }
    
    if (content.length > 1000){
        newProductError.push("The content is too long")
    }

	if (category != "Furniture" && category != "Clothes" && category != "Technology" && category != "Other"){
		    newProductError.push("You haven't selected the right category.")
	}
	

    if(newProductError.length == 0){

        const query = "INSERT INTO ProductPost (postName, price, category, content, postCreatedAt, accountId) VALUES (?, ?, ?, ?, ?, ?)"
        db.run(query, values, function(error){
            if(error){
                if(error.message == "SQLITE_CONSTRAINT: FOREIGN KEY constraint failed"){
					response.status(400).json(["AccountDoesNotExist"])
                } 
                else {
                        response.status(500).end()
                }
            }else{
                response.setHeader("Location", "/ProductPosts/"+this.lastID)
                response.status(201).end()
            }
        })
    } else{
        response.status(400).json(newProductError)
        return
    }

})


// ===
// Retrieving single post.
// ===
app.get("/ProductPosts/:id", function(request, response){ 
	const id = parseInt(request.params.id)
	db.get("SELECT * FROM ProductPost WHERE id = ?", [id], function(error, ProductPost){ 
		if(error){
			response.status(500).end()
		}else if(!ProductPost){
			response.status(404).end()
		}else {
			response.status(200).json(ProductPost)
		}
 
	})
 })


// ===
// Retrieving all posts.
// ===
app.get("/ProductPosts", function(request, response){
	const query = "SELECT * FROM ProductPost"
db.all(query, function(error, ProductPost){
if(error){
   response.status(500).end()
}else{
   response.status(200).json(ProductPost)
} 
})
})



// ===
// Updating the post. 
// ===
app.put("/ProductPosts/:id", function(request, response){
	
	const id = request.params.id
	const receivedPost = request.body
	const accountId = request.body.accountId
	
	const authorizationHeader = request.get("Authorization")
	const accessToken = authorizationHeader.substr(7)	

    let tokenAccountId = null
	try{
		const payload = jwt.verify(accessToken, jwtSecret)
		tokenAccountId = payload.accountId
	}catch(error){
		response.status(401).end()
		return
	}

	if(tokenAccountId != accountId){
		response.status(401).end()
		return
	}

	// Look for malformed resources.
	if(typeof receivedPost != "object" ||
		 typeof receivedPost.postName != "string" ||
		 typeof receivedPost.price != "number" ||
		 typeof receivedPost.category != "string" ||
		 typeof receivedPost.content != "string" ||
		 typeof receivedPost.postCreatedAt != "number" ||
		 typeof receivedPost.accountId != "number" ){
			response.status(422).end()
			return
	}

	// Look for validation errors.
	const postErrors = validatePost(receivedPost)

	if(0 < postErrors.length){
		response.status(400).json(postErrors)
		return
	}

	// Go ahead and update the resource.
	const query = `
		UPDATE ProductPost SET postName = ?, price = ?, category = ?, content = ?, postCreatedAt = ?, accountId = ?
		WHERE id = ?
	`
	const values = [
		receivedPost.postName,
		receivedPost.price,
		receivedPost.category,
		receivedPost.content,
		receivedPost.postCreatedAt,
		receivedPost.accountId,
		id
	]
	db.run(query, values, function(error){
		if(error){
			response.status(500).end()
		}else{
			const id = this.lastID
			response.setHeader("Location", "/ProductPosts/"+ id)
			response.status(204).end()
		}
	})

})


// ===
// Deleting the post. 
// ===

// Allow clients to delete a post with a specific id, e.g.:
// DELETE /ProductPosts/123
app.delete("/ProductPosts/:id", function(request, response){

	// const id = request.params.id
	// const receivedPost = request.body
	const accountId = request.body.accountId
	
	const authorizationHeader = request.get("Authorization")
<<<<<<< HEAD


	
// ===
// Creating new comment
// ===

app.post("/comment", function(request, response){ 
    const title = request.body.title
    const content = request.body.content
	const commentCreatedAt = request.body.commentCreatedAt
	const accountId = request.body.accountId
	const postId = request.body.postId
    const values = [title, content, commentCreatedAt, accountId, postId]
   
    const authorizationHeader = request.get("Authorization")
=======
>>>>>>> d278de9075d3eb40fe8891cfe153738bdef200dd
	const accessToken = authorizationHeader.substr(7)	

    let tokenAccountId = null
	try{
		const payload = jwt.verify(accessToken, jwtSecret)
		tokenAccountId = payload.accountId
	}catch(error){
		response.status(401).end()
		return
	}

	if(tokenAccountId != accountId){
		response.status(401).end()
		return
	}
<<<<<<< HEAD
	newCommentError = []

	// Validation comments
	if(title.length < 5){
        newCommentError.push("The title is too short")
    }
    
    if (title.length > 50){
        newCommentError.push("The title is too long")
	}
	
	if(content.length < 10){
        newCommentError.push("The content is too short")
    }
    
    if (content.length > 1000){
        newCommentError.push("The content is too long")
    }

})
=======

	const id = parseInt(request.params.id)
	db.run("DELETE FROM ProductPost WHERE id = ?", [id], function(error){
		if(error){
			response.status(500).end()
		}else{
			const numberOfDeletetRows = this.changes
			if(numberOfDeletetRows == 0){
				response.status(404).end()
			}else{
				response.status(204).end()
				return
			}
		}
	})
})

>>>>>>> d278de9075d3eb40fe8891cfe153738bdef200dd


app.listen(3000)