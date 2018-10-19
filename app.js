const express = require('express')
const app = express()
const sqlite3 = require('sqlite3')
const db = new sqlite3.Database("swapped.db")
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')


app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

db.run("PRAGMA foreign_keys = ON;")

// Create a table to store Accounts. 
// Added accountId to all three tables, checkes if the right person is creating the post/comment.
db.run(`CREATE TABLE IF NOT EXISTS Account (
    id integer PRIMARY KEY AUTOINCREMENT,
    email TEXT unique,
    hashedPassword TEXT,
    username TEXT		
)`)


// Create a table to store Product posts.
// postName should be title and postCreatedAt-createdAt
db.run(`CREATE TABLE IF NOT EXISTS ProductPost (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    postName TEXT NOT NULL,
    price INTEGER,
    category TEXT,
    content TEXT,
    postCreatedAt INTEGER,
	accountId INTEGER,
	FOREIGN KEY(\`accountId\`) REFERENCES \`Account\`(\`id\`) ON DELETE CASCADE
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

// // Function used to validate a ProductPost resource.
// // Returns an array with error codes.
// // need to update the code with correct error codes everywhere
// function validatePost(productPost){
	
// 	const postErrors = []

// 	if(productPost.postName.length < 3){
// 		postErrors.push("titleTooShort ")
// 	}

// 	if(productPost.postName.length > 50){
// 		postErrors.push("titleTooLong ")
// 	}

// 	if(productPost.price < 0){
// 		postErrors.push("priceNegative")
// 	}

// 	if(productPost.content.length < 10){
// 		postErrors.push("contentTooShort ")
// 	}

// 	if(productPost.content.length > 1000){
// 		postErrors.push("contentTooLong ")
// 	}

// 	if (productPost.category != "Furniture" && productPost.category != "Clothes" && productPost.category != "Technology" && productPost.category != "Books" && productPost.category != "Other" ){
// 		postErrors.push("wrongCategory")
// }

// 	return postErrors

// }

// function validateAccount(accountUpdate){


// 	const accountErrors = []

// 	if(accountUpdate.username.length < 3){
// 		accountErrors.push("usernameIsTooShort")
// 	}

// 	if(accountUpdate.username.length > 80){
// 		accountErrors.push("usernameIsTooLong")
// 	}

// 	if(accountUpdate.hashedPassword.length < 10){
//         accountErrors.push("passwordIsTooShort")
// 	}

// 	if (! /^[a-zA-Z0-9]+$/.test(username)) {
//         // Validation failed.
//         valid = false
//         accountErrors.push("invalidCharacters")
// 	}

// 	return accountErrors

// }

function validateComment(commentUpdate){
	
	const commentErrors = []

	if(commentUpdate.title.length < 5){
		commentErrors.push("titleTooShort")
	}

	if(commentUpdate.title.length > 50){
		commentErrors.push("titleTooLong")
	}

	if(commentUpdate.content.length < 10){
		commentErrors.push("contentTooShort")
	}

	if(commentUpdate.content.length > 1000){
		commentErrors.push("contentTooLong")
	}

	return commentErrors

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
        // Validation failed.
        valid = false
        accountErrors.push("invalidCharacters")
	}
	


// Look for validation errors.
// const accountErrors = validateAccount(createdAccount)

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
// In order to log in you need  grant_type=password&username=theEmail&password=thePassword
//  and the set the Content-Type to application/x-www-form-urlencoded

//Tokens
const jwtSecret = "dsjlksdjlkjfdsl"

app.post("/tokens", function(request, response){
	
	const grant_type = request.body.grant_type
	const email = request.body.username //change this into username
	const hashedPassword = request.body.password //password
	
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



// ===
// Updating the account.
// ===
app.patch("/accounts/:id", function(request, response){
	
	const accountId = request.params.id
	const receivedAccount = request.body
	const hashedPassword = request.body.hashedPassword
	const theHash = bcrypt.hashSync(hashedPassword, saltRounds)
	const username = request.body.username
	// const hashedPassword = request.body.hashedPassword
	// const accountId = request.body.accountId
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

	

	// Look for validation errors.
	function validateAccount(accountUpdate){
		const accountErrors = []
	
		if(accountUpdate.username.length < 3){
			accountErrors.push("usernameIsTooShort")
		}
	
		if(accountUpdate.username.length > 80){
			accountErrors.push("usernameIsTooLong")
		}
	
		if(accountUpdate.hashedPassword.length < 10){
			accountErrors.push("passwordIsTooShort")
		}
	
		if (! /^[a-zA-Z0-9]+$/.test(username)) {
			// Validation failed.
			valid = false
			accountErrors.push("invalidCharacters")
		}
	
		return accountErrors
	
	}

	const accountErrors = validateAccount(receivedAccount)

	if(0 < accountErrors.length){
		response.status(400).json(accountErrors)
		return
	}

	// Go ahead and update the resource.
	const query = `
		UPDATE Account SET hashedPassword = ?, username = ?
		WHERE id = ?
	`
	const values = [
		theHash,
		username,
		// receievedAccount.accountId,
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

app.delete("/accounts/:id", function(request, response){
	
		// const id = request.params.id
		// const receivedPost = request.body
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
	
		const id = parseInt(request.params.id)
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

app.post("/productPosts", function(request, response){ //Changed the ProductPost to Posts so its coherent with other endings (accounts and comments).
    const postName = request.body.postName				//Need to update the second part of the report.
    const price = request.body.price
    const category = request.body.category
    const content = request.body.content
    const postCreatedAt = request.body.postCreatedAt
    const accountId = request.body.accountId
	
	const values = [postName, price, category, content, postCreatedAt, accountId]
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
	typeof createdPost.postName != "string" ||
	typeof createdPost.price != "number" ||
	typeof createdPost.category != "string" ||
	typeof createdPost.content != "string" ||
	typeof createdPost.postCreatedAt != "number" ||
	typeof createdPost.accountId != "number" ){
	   response.status(422).end()
	   return
}


    var newProductError = []

    
    if(postName.length < 3){
        newProductError.push("titleTooShort")
    }
    
    if (postName.length > 50){
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

        const query = "INSERT INTO ProductPost (postName, price, category, content, postCreatedAt, accountId) VALUES (?, ?, ?, ?, ?, ?)"
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
app.get("/productPosts/:id", function(request, response){ 
	const id = parseInt(request.params.id)
	db.get("SELECT * FROM ProductPost WHERE id = ? ORDER BY postCreatedAt DESC", [id], function(error, ProductPost){ 
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
app.get("/productPosts", function(request, response){
	const query = "SELECT * FROM ProductPost ORDER BY postCreatedAt DESC"
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
			
				// Look for malformed resources.
				if(typeof receivedPost != "object"){
						response.status(422).end()
						return
				}

				// Checking if the user has change the values, if we have something in the body,
				// and then we check if that is on the right format.
				const postErrors = []

				if(receivedPost.postName && typeof receivedPost.postName == "string"){
					post.postName = receivedPost.postName

					if(post.postName.length < 3){
						postErrors.push("titleTooShort ")
					}

					if(post.postName.length > 50){
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

				if(receivedPost.postCreatedAt && typeof receivedPost.postCreatedAt == "number"){
					post.postCreatedAt = receivedPost.postCreatedAt
				}

				if(receivedPost.accountId){
					response.status(401).end()
				}
			
				
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
					post.postName,
					post.price,
					post.category,
					post.content,
					post.postCreatedAt,
					post.accountId,
					id
				]
				
				db.run(query, values, function(error){
					if(error){
						response.status(500).end()
					}else{
						const id = this.lastID
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

// Allow clients to delete a post with a specific id, e.g.:
// DELETE /ProductPosts/123
app.delete("/productPosts/:id", function(request, response){

	// const id = request.params.id
	// const receivedPost = request.body
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


// ===
// Creating new comment
// ===

app.post("/comments", function(request, response){ 
	const accountId = request.body.accountId
	const postId = request.body.postId
    const title = request.body.title
    const content = request.body.content
	const commentCreatedAt = request.body.commentCreatedAt

	const values = [accountId, postId, title, content, commentCreatedAt]

   
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

        const query = "INSERT INTO Comment (accountId, postId, title, content, commentCreatedAt) VALUES (?, ?, ?, ?, ?)"
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

app.delete("/comments/:id", function(request, response){

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

	const id = parseInt(request.params.id)
	db.run("DELETE FROM Comment WHERE id = ?", [id], function(error){
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
// Updating specific comment. 
// ===
app.put("/comments/:id", function(request, response){
	
	const id = request.params.id
	const receivedComment = request.body
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
	if(typeof receivedComment != "object" ||
		typeof receivedComment.accountId != "number" ||
		typeof receivedComment.postId != "number" ||
		typeof receivedComment.title != "string" ||
		typeof receivedComment.content != "string" ||
		typeof receivedComment.commentCreatedAt != "number" ){
			response.status(422).end()
			return
	}

	// Look for validation errors.
	const commentErrors = validateComment(receivedComment)

	if(0 < commentErrors.length){
		response.status(400).json(commentErrors)
		return
	}

	// Go ahead and update the comment.
	const query = `
		UPDATE Comment SET accountId = ?, postId = ?, title = ?, content = ?, commentCreatedAt = ?
		WHERE id = ?
	`
	const values = [
		receivedComment.accountId,
		receivedComment.postId,
		receivedComment.title,
		receivedComment.content,
		receivedComment.commentCreatedAt,
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

})

// ===
// Retrieving all comments for one specific post
// http://localhost:3000/comments?postId=1
// ===

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