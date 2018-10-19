const express = require('express')
const app = express()
const sqlite3 = require('sqlite3')
const db = new sqlite3.Database("swapped.db")
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const saltRounds = 10

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

db.run("PRAGMA foreign_keys = ON;")

// Create a table to store Accounts. 
db.run(`CREATE TABLE IF NOT EXISTS Account (
    id integer PRIMARY KEY AUTOINCREMENT,
    email TEXT unique,
    hashedPassword TEXT,
    username TEXT		
)`)


// Create a table to store Product posts.
db.run(`CREATE TABLE IF NOT EXISTS ProductPost (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    price INTEGER,
    category TEXT,
    content TEXT,
    createdAt INTEGER,
	accountId INTEGER,
	FOREIGN KEY(\`accountId\`) REFERENCES \`Account\`(\`id\`) ON DELETE CASCADE
)`)


// Create a table to store Comments.
db.run(`CREATE TABLE IF NOT EXISTS Comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    accountId INTEGER,
    postId INTEGER,
    title TEXT,
    content TEXT,
    createdAt INTEGER,
    FOREIGN KEY(\`accountId\`) REFERENCES \`Account\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY(\`postId\`) REFERENCES \`ProductPost\`(\`id\`) ON DELETE CASCADE
)`)


// ===
// Create a new Account.
// ===

// POST /accounts
// Content-Type: application/json

app.post("/accounts", function(request, response){

    const email = request.body.email 
	const hashedPassword = request.body.hashedPassword
    const theHash = bcrypt.hashSync(hashedPassword, saltRounds)
    const username = request.body.username
    const values = [email, theHash, username]
    const createdAccount = request.body

	// Look for malformed resources.
	if(typeof createdAccount != "object" ||
	typeof createdAccount.email != "string" ||
	typeof createdAccount.hashedPassword != "string" ||
	typeof createdAccount.username != "string" ){
	   response.status(422).end()
	   return
}

    var accountErrors = [] 
    if(username.length < 3){
        accountErrors.push("usernameIsTooShort")
    }
    if(username.length > 80){
        accountErrors.push("usernameIsTooLong")
    }
    
    if(!email.endsWith('@student.ju.se')){
        accountErrors.push("emailWrongFormat")
	}
	
	if(hashedPassword.length < 10){
        accountErrors.push("passwordIsTooShort")
	}

	if (! /^[a-zA-Z0-9]+$/.test(username)) {
        valid = false
        accountErrors.push("invalidCharacters")
	}

    if(accountErrors.length == 0) { 
        const query = `
		INSERT INTO Account (email, hashedPassword, username)
		VALUES (?, ?, ?)
	`
    db.run(query, values, function(error){
		if(error){
            if(error.message == "SQLITE_CONSTRAINT: UNIQUE constraint failed: Account.email"){
            response.status(400).json(["emailNotUnique"]) 
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
// Logging into an account.
// ===

// POST /tokens
// Content-Type: application/x-www-form-urlencoded
// Body: grant_type=password&username=theEmail&password=thePassword

const jwtSecret = "dsjlksdjlkjfdsl"

app.post("/tokens", function(request, response){
	
	const grant_type = request.body.grant_type
	const email = request.body.username 
	const hashedPassword = request.body.password 
	
	const query = `SELECT * FROM Account WHERE email = ?`
	const values = [email]

	db.get(query, values, function(error, account){
		if(error){
			response.status(500).end()
		}else if(!account){
			response.status(404).json({error: "invalid_client"})
		}else{
			if(bcrypt.compareSync(hashedPassword, account.hashedPassword)){

				const accessToken = jwt.sign({accountId: account.id}, jwtSecret)
				const idToken = jwt.sign({sub: account.id, email: email}, jwtSecret)
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



// ===
// Updating the account.
// ===

// PATCH /accounts/id
// Content-Type: application/json
// Authorization: Bearer theAccessToken

app.patch("/accounts/:id", function(request, response){
	
	const accountId = request.params.id
	const receivedAccount = request.body
	const hashedPassword = request.body.hashedPassword
	const theHash = bcrypt.hashSync(hashedPassword, saltRounds)
	const username = request.body.username
	const authorizationHeader = request.get("Authorization")
	const accessToken = authorizationHeader.substr(7)	


	// Look for malformed resources.
	if(typeof receivedAccount != "object" ||
		 typeof receivedAccount.username != "string" ||
		 typeof receivedAccount.hashedPassword != "string" ){
			response.status(422).end()
			return
	}


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

	const accountErrors = []
	
		if(receivedAccount.username.length < 3){
			accountErrors.push("usernameIsTooShort")
		}
	
		if(receivedAccount.username.length > 80){
			accountErrors.push("usernameIsTooLong")
		}
	
		if(receivedAccount.hashedPassword.length < 10){
	        accountErrors.push("passwordIsTooShort")
		}
	
		if (! /^[a-zA-Z0-9]+$/.test(username)) {
	        valid = false
	        accountErrors.push("invalidCharacters")
		}

	if(0 < accountErrors.length){
		response.status(400).json(accountErrors)
		return
	}

	const query = `
		UPDATE Account SET hashedPassword = ?, username = ?
		WHERE id = ?
	`
	const values = [
		theHash,
		username,
		accountId
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
// Deleting the Account.
// ===

// DELETE/accounts/id
// Content-Type: application/json
// Authorization: Bearer theAccessToken

app.delete("/accounts/:id", function(request, response){

		const id = parseInt(request.params.id)
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
	
		if(tokenAccountId != id){
			response.status(401).end()
			return
		}
	
		db.run("DELETE FROM Account WHERE id = ?", [id], function(error){
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


// ===
// Create a new Product post.
// ===

// POST /productPosts/id
// Content-Type: application/json
// Authorization: Bearer theAccessToken

app.post("/productPosts", function(request, response){ 
	
    const title = request.body.title			
    const price = request.body.price
    const category = request.body.category
    const content = request.body.content
    const createdAt = request.body.createdAt
    const accountId = request.body.accountId
	const values = [title, price, category, content, createdAt, accountId]
	const createdPost = request.body
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
	if(typeof createdPost != "object" ||
	typeof createdPost.title != "string" ||
	typeof createdPost.price != "number" ||
	typeof createdPost.category != "string" ||
	typeof createdPost.content != "string" ||
	typeof createdPost.createdAt != "number" ||
	typeof createdPost.accountId != "number" ){
	   response.status(422).end()
	   return
}

    var newProductError = []

    if(title.length < 3){
        newProductError.push("titleTooShort")
    }
    
    if (title.length > 50){
        newProductError.push("titleTooLong")
    }

	if (price < 0){
        newProductError.push("priceNegative")
    }

    if(content.length < 10){
        newProductError.push("contentTooShort")
    }
    
    if (content.length > 1000){
        newProductError.push("contentTooLong")
    }

	if (category != "Furniture" && category != "Clothes" && category != "Technology" && category != "Books" && category != "Other"){
		    newProductError.push("wrongCategory")
	}
	

    if(newProductError.length == 0){

        const query = "INSERT INTO ProductPost (title, price, category, content, createdAt, accountId) VALUES (?, ?, ?, ?, ?, ?)"
        db.run(query, values, function(error){
            if(error){
				if(error.message == "SQLITE_CONSTRAINT: FOREIGN KEY constraint failed"){
					response.status(400).json(["accountNotFound"])
                } 
                else {
                        response.status(500).end()
                }
    		}else {
				response.setHeader("Location", "/productPosts/"+this.lastID)
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

// GET /productPosts/id
// Content-Type: application/json

app.get("/productPosts/:id", function(request, response){ 
	const id = parseInt(request.params.id)
	db.get("SELECT * FROM ProductPost WHERE id = ? ORDER BY createdAt DESC", [id], function(error, ProductPost){ 
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

// GET /productPosts
// Content-Type: application/json

app.get("/productPosts", function(request, response){
	const query = "SELECT * FROM ProductPost ORDER BY createdAt DESC"
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

// PATCH /productPosts/id
// Content-Type: application/json
// Authorization: Bearer theAccessToken

app.patch("/productPosts/:id", function(request, response){
	
	const id = parseInt(request.params.id)
	const accountIdPost = "SELECT * FROM productPost WHERE id = ?"
	
	db.get(accountIdPost,[id], function(error, post) {
		if(error){
			response.status(500).end()
		}else if(!post){
				response.status(404).end()

			}else{

				const receivedPost = request.body
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

				if(tokenAccountId != post.accountId){
					response.status(401).end()
					return
				}
				
				if(typeof receivedPost != "object"){
					response.status(422).end()
					return
				}

				const postErrors = []

				if(receivedPost.title && typeof receivedPost.title == "string"){
					post.title = receivedPost.title

					if(post.title.length < 3){
						postErrors.push("titleTooShort ")
					}

					if(post.title.length > 50){
						postErrors.push("titleTooLong ")
					}
				}

				if(receivedPost.price && typeof receivedPost.price == "number"){
					post.price = receivedPost.price

					if(post.price < 0){
						postErrors.push("priceNegative")
					}
				}

				if(receivedPost.category && typeof receivedPost.category == "string"){
					post.category = receivedPost.category

					if (post.category != "Furniture" && post.category != "Clothes" && post.category != "Technology" && post.category != "Books" && post.category != "Other" ){
						postErrors.push("wrongCategory")
					}
				}

				if(receivedPost.content && typeof receivedPost.content == "number"){
					post.content = receivedPost.content

					if(post.content.length < 10){
						postErrors.push("contentTooShort ")
					}

					if(post.content.length > 1000){
						postErrors.push("contentTooLong ")
					}
				}

				if(receivedPost.createdAt && typeof receivedPost.createdAt == "number"){
					post.createdAt = receivedPost.createdAt
				}

				if(receivedPost.accountId){
					response.status(401).end()
					return
				}
			
				
				if(0 < postErrors.length){
					response.status(400).json(postErrors)
					return
				}

				const query = `
					UPDATE ProductPost SET title = ?, price = ?, category = ?, content = ?, createdAt = ?, accountId = ?
					WHERE id = ?
				`
				const values = [
					post.title,
					post.price,
					post.category,
					post.content,
					post.createdAt,
					post.accountId,
					id
				]
				
				db.run(query, values, function(error){
					if(error){
						response.status(500).end()
					}else{
						response.setHeader("Location", "/productPosts/"+ id)
						response.status(204).end()
					}
				})

			}
	})
})


// ===
// Deleting the post. 
// ===

// DELETE /productPosts/id
// Content-Type: application/json
// Authorization: Bearer theAccessToken

app.delete("/productPosts/:id", function(request, response){

	const id = parseInt(request.params.id)
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

	db.run("DELETE FROM ProductPost WHERE id = ? AND accountId = ?", [id, tokenAccountId], function(error){
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


// ===
// Creating new comment
// ===

// POST /comments
// Content-Type: application/json
// Authorization: Bearer theAccessToken

app.post("/comments", function(request, response){ 
	
	const createdComment = request.body
	const accountId = request.body.accountId
	const postId = request.body.postId
    const title = request.body.title
    const content = request.body.content
	const createdAt = request.body.createdAt
	const values = [accountId, postId, title, content, createdAt]

   
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
	if(typeof createdComment != "object" ||
		typeof createdComment.accountId != "number" ||
		typeof createdComment.postId != "number" ||
		typeof createdComment.title != "string" ||
		typeof createdComment.content != "string" ||
		typeof createdComment.createdAt != "number" ){
			response.status(422).end()
			return
	}

	const commentErrors = []

	if(title.length < 3){
		commentErrors.push("titleTooShort")
	}
	if(title.length > 50){
		commentErrors.push("titleTooLong")
	}
	
	if(content.length < 2){
        newCommentError.push("contentTooShort")
    }
    
    if (content.length > 1000){
        newCommentError.push("contentTooLong")
	}


	if(commentErrors.length == 0){

        const query = "INSERT INTO Comment (accountId, postId, title, content, createdAt) VALUES (?, ?, ?, ?, ?)"
        db.run(query, values, function(error){
            if(error){
                if(error.message == "SQLITE_CONSTRAINT: FOREIGN KEY constraint failed"){
					response.status(400).json(["accountOrPosttNotFound"])
                } else {
                        response.status(500).end()
                }
            }else{
                response.setHeader("Location", "/comments/"+this.lastID)
                response.status(201).end()
            }
        })
    } else{
        response.status(400).json(commentErrors)
        return
    }


})


// ===
// Deleting a comment. 
// ===

// DELETE /comments/id
// Content-Type: application/json
// Authorization: Bearer theAccessToken

app.delete("/comments/:id", function(request, response){

	const id = parseInt(request.params.id)
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

	db.run("DELETE FROM Comment WHERE id = ? AND accountId = ?", [id, tokenAccountId], function(error){
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


// ====
// Updating specific comment. 
// ===

// PATCH /comments/id
// Content-Type: application/json
// Authorization: Bearer theAccessToken

app.patch("/comments/:id", function(request, response){
	
	const id = parseInt(request.params.id)
	const oldComment = "SELECT * FROM Comment WHERE id = ?"
	const receivedComment = request.body


	db.get(oldComment,[id], function(error, comment){
		if(error){
			response.status(500).end(
			)
		}else if(!comment){
			response.status(404).end()
		}else{

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
		

			if(tokenAccountId != comment.accountId){
				response.status(401).end()
				return
			}
				
			if(typeof receivedComment != "object"){
					response.status(422).end()
					return
			}

				const commentErrors = []

				if(receivedComment.title && typeof receivedComment.title == "string"){
					comment.title = receivedComment.title

					if(comment.title.length < 5){
						commentErrors.push("titleTooShort ")
					}

					if(commentErrors.length > 50){
						commentErrors.push("titleTooLong ")
					}
				}
				if(receivedComment.content && typeof receivedComment.content == "string"){
					comment.content = receivedComment.content

					if(comment.content.length < 10){
						commentErrors.push("contentTooShort ")
					}

					if(comment.content.length > 1000){
						commentErrors.push("contentTooLong ")
					}
				}

				if(receivedComment.accountId || receivedComment.postId ){
					response.status(401).end()
					return
				}
			
				
				if(0 < commentErrors.length){
					response.status(400).json(commentErrors)
					return
				}

			const query = `
				UPDATE Comment SET accountId = ?, postId = ?, title = ?, content = ?, createdAt = ?
				WHERE id = ?
			`
			const values = [
				comment.accountId,
				comment.postId,
				comment.title,
				comment.content,
				comment.createdAt,
				id
			]
		
			db.run(query, values, function(error){
				if(error){
					response.status(500).end()
				}else{
					const id = this.lastID
					response.setHeader("Location", "/comments/"+ id)
					response.status(204).end()
				}
			})



		}
	})

})

// ====
// Retrieving all comments for one specific post. 
// ===

// GET /comments?commentsId=1
// Content-Type: application/json
// Authorization: Bearer theAccessToken

app.get("/comments", function(request, response){
	const postId = request.query.postId

	const querycomments = "SELECT * FROM Comment WHERE postId = ? ORDER BY createdAt DESC"
			db.all(querycomments, [postId], function(error, comments){
				if(error){
					response.status(500).end()
				}else if(!comments){
					response.status(404).end()
				}else {
					response.status(200).json(comments)
				} 	
			})
})


app.listen(3000)