
const request = require("request");
var cookieParser = require('cookie-parser');

const express = require("express");
const app = express();
const session = require('express-session');
const crypto = require('crypto');
const scrypt = require('scrypt');

const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://mRidge:duzSEpQQh4fTIqSm@cluster0-2dcbj.mongodb.net/test?retryWrites=true&w=majority";
const database_name = "RateADate";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
client.connect();

app.use(cookieParser());

app.set("view engine", "ejs");
app.use(express.json()) // use json middleware
app.use(express.static("public")); //folder for images, css, js
app.use(express.urlencoded()); // used to parse data sent using the POST method
// Recall all middleware for app.use executes every time before routes

app.use(session({
    secret: 'keyboard cat',
    cookie: { maxAge: 6000000 }
}))

app.use(myMiddleware);
function myMiddleware(req, res, next) {
    console.log(new Date());
    next(); // passes control to back to server to do the next thing.
}


function isAdminAuthenticated(req, res, next) {
    if (!req.session.adminAuthenticated) {
        res.redirect('/adminLogin');
    } else {
        next();
    }
}

function isUserAuthenticated(req, res, next) {
    if (!req.session.userAuthenticated) {
        res.redirect('/userLogin');
    } else {
        next();
    }
}

async function userLoginAttempt(username, password) {
    var result = await client.db(database_name).collection("users").findOne({
        "username": username
    });

    console.log(`user found: ${result}`);
    if (result == null) {
        return false;
    }

    let password_salt = result.password_salt;
    let new_hash = hash_password(password, password_salt);

    if (new_hash != result.password_hash) {
        return false;
    }

    return true;

}

async function adminLoginAttempt(username, password) {
    var result = await client.db(database_name).collection("users").findOne({
        "username": username,
        "password": password,
        "admin": true
    });
    console.log(`admin found: ${result}`);
    if (result != null) {
        return true;
    } else {
        return false;
    }
}

//routes
app.get("/", function (req, res) {

    res.render("index");

});
app.get("/userLogin", async function (req, res) {
    res.render("userLogin");
});
app.get("/adminLogin", async function (req, res) {
    res.render("adminLogin");
});



// from lab 10, admin side of page
app.get("/admin", isAdminAuthenticated, async function (req, res) {
    console.log("authenticated: ", req.session.authenticated);
    if (req.session.adminAuthenticated) {
        let productList = await getProductList();
        res.render("admin", { "productList": productList });
    } else {                         //if user hasn't authenticated
        res.render("adminLogin");                  //send them to the login screen
    }
});

app.post("/adminLoginProcess", function (req, res) {
    adminLoginAttempt(req.body.username, req.body.password).then(result => {
        console.log(`result of login attempt: ${result}`);
        if (result == true) {
            req.session.adminAuthenticated = true;
            res.send({ "loginSuccess": true });
        } else {
            res.send(false);
        }
    });
});

app.post("/userLoginProcess", function (req, res) {
    userLoginAttempt(req.body.username, req.body.password).then(result => {
        console.log(`result of login attempt: ${result}`);
        if (result == true) {
            console.log(req.body.username);
            req.session.name = req.body.username;
            console.log(req.session.name);
            req.session.userAuthenticated = true;
            res.send({ "loginSuccess": true });
        } else {
            res.send(false);
        }
    });
});

//Johnny Cookie Functions
function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}
function eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999;';
}

app.get("/logout", function (req, res) {
    req.session.destroy();
    res.redirect("/");   //taking user back to login screen
});
app.get("/addProduct", isAdminAuthenticated, async function (req, res) {
    if (req.session.adminAuthenticated) {
        // res.render("newProduct");
        let keyword = "unown";
        console.log(`keyword: ${req.query.keyword}`);
        if (req.query.keyword != null) {
            console.log(`a`);
            if (req.query.keyword.localeCompare("") != 0) {
                console.log(`b`);
                keyword = req.query.keyword;
            }
        }
        keyword = keyword.toLowerCase();
        let parsedData = await getPokemon(keyword);
        res.render("newProduct", { "parsedData": parsedData });
    } else {                                    //if user hasn't authenticated
        res.render("adminLogin");                  //send them to the login screen
    }
});
app.post("/addProduct", isAdminAuthenticated, async function (req, res) {
    const newPokemon = req.body;
    const result = await insertProduct(newPokemon);
    console.log(`Pokemon added: ${result}`);
    if (!result) {
        console.log("Pokemon's name: " + newPokemon.name);
        return res.redirect("updateProduct?pokemonName=" + newPokemon.name);
    }
});
app.get("/updateProduct", isAdminAuthenticated, async function (req, res) {
    if (req.session.adminAuthenticated) {
        let productInfo = await getProductInfoAdmin(req.query.pokemonName);
        console.log(`pokemon info: ${productInfo}`);
        res.render("updateProduct", { "productInfo": productInfo });
    } else {                                    //if user hasn't authenticated
        res.render("adminLogin");                  //send them to the login screen
    }
});
app.post("/updateProduct", isAdminAuthenticated, async function (req, res) {
    console.log(`Post for updateProduct`);
    const updatedPokemon = req.body;
    console.log(updatedPokemon);
    const result = client.db("pokemondb").collection("pokemon").updateOne(
        { name: updatedPokemon.name },
        { $set: updatedPokemon }
    );
    console.log(`result for post: ${result}`);
    res.redirect('/admin');
});
app.get("/deleteProduct", isAdminAuthenticated, async function (req, res) {
    let result = await deleteProduct(req.query.pokemonName);
    console.log(result);
    let message = "Product WAS NOT deleted!";
    if (result.deletedCount > 0) {
        message = "Product successfully deleted!";
    }
    let productList = await getProductList();
    res.render("admin", { "productList": productList });
});


// app.post("/stats", isAdminAuthenticated, async function(req, res) {
//     res.send(await getStats(req.body.command));
// });

app.get("/adminStats", isAdminAuthenticated, function (req, res) {

    res.render("adminStatistics");

});


// FUNCTIONS

function hash_password(password, salt) {
    let params = { "N": 16, "r": 1, "p": 1 };
    let length = 64;
    return scrypt.hashSync(password, params, length, salt).toString("base64");
}


async function insertProduct(body) {
    if (await client.db("pokemondb").collection("pokemon").findOne({ name: { $regex: new RegExp(body.name, "i") } })) {
        console.log(`${body.name} already in database`);
        return false;
    } else {
        const result = await client.db("pokemondb").collection("pokemon").insertOne(body);
        console.log(`${body.name} inserted in database`);
        return true;
    }
}

async function getProductList() {

    console.log(`getProductList`);
    const result = await client.db("pokemondb").collection("pokemon").find().toArray();
    console.log(`number of pokemon in cluster: ${result.length}`);
    return result;
}

async function addToCart(username, pokemonName, quantityChosen) {
    quantityChosen = parseInt(quantityChosen);
    var pokemon = await client.db("pokemondb").collection("pokemon").findOne({ "name": pokemonName });

    var result = await client.db(database_name).collection("users").findOne({ "username": username });
    console.log(result);
    if (result.cart == null) {
        console.log("empty array");
        console.log(pokemon);
        result.cart = [[pokemonName, pokemon.price, quantityChosen]];
    } else {
        var index;
        var found = false;
        for (index = 0; index < result.cart.length; index++) {
            if (result.cart[index][0] == pokemonName) {
                found = true;
                break;
            }
        }
        if (found) {
            result.cart[index][2] = quantityChosen;
        }
        else {
            result.cart[result.cart.length] = [pokemonName, pokemon.price, quantityChosen];
        }
    }
    console.log(`new cart: `);
    var index;
    for (index = 0; index < result.cart.length; index++) {
        console.log(result.cart[index]);
    }
    result = await client.db(database_name).collection("users").updateOne(
        { "username": username },
        {
            $set: { "cart": result.cart }
        });
}

async function createUser(username, password, email, bio, reviews) {
    console.log(`createUser called`);
    let result = await client.db("RateADate").collection("users").findOne({ "username": username });
    if (result != null) {
        // do something to signify error creating account
        console.log(`user found with username: ${username}`);
    } else {
        let password_salt = crypto.randomBytes(128).toString("base64");
        // console.log(`salt generated: ${password_salt}`);
        let password_hash = hash_password(password, password_salt);

        result = await client.db(database_name).collection("users").insertOne({
            "username": username,
            "password_hash": password_hash,
            "password_salt": password_salt,
            "email": email,
            "bio": bio
        });
        console.log(`user created with username: ${username}`);
    }
    return result;
}

async function getProductInfoAdmin(pokemonName) {
    console.log(`Name: ${pokemonName}`);
    const result = await client.db("pokemondb").collection("pokemon").findOne({ "name": { $regex: new RegExp(pokemonName, "i") } });
    console.log(`result: ${result}`);
    return result;
}

async function updateProduct(updatedPokemon) {
    const result = await client.db("pokemondb").collection("pokemon").updateOne(updatedPokemon);
    console.log(`${result.matchedCount} document(s) matched the query criteria`);
    console.log(`${result.modifiedCount} document(s) was/were updated`);
}

async function deleteProduct(pokemonName) {
    const result = await client.db("pokemondb").collection("pokemon").deleteOne({ name: pokemonName });
    console.log(`${result.deletedCount} pokemon was/were deleted`);
    return result;
}

async function clearCart(username) {
    var user = await client.db(database_name).collection("users").findOne({ "username": username });
    var index;
    var result;
    var pokemonName;
    try {
        for (index = 0; index < user.cart.length; index++) {
            pokemonName = user.cart[index][0];
            var pokemon = await client.db("pokemondb").collection("pokemon").findOne({ "name": user.cart[index][0] });
            pokemon.quantity -= user.cart[index][2];
            await client.db("pokemondb").collection("pokemon").updateOne({ "name": pokemon.name }, { $set: { "quantity": pokemon.quantity } });
        }
    } catch (e) {
        console.log("cart is empty");
    }
    result = await client.db(database_name).collection("users").updateOne({ "username": username }, { $unset: { cart: null } });
}

async function addReview(username, rating, textReview) {
    var result = await client.db("RateADate").collection("users").findOne({ "username": username });
    console.log(result);


        result = await client.db("RateADate").collection("users").updateOne(
                        {username: username},
                        { $set:
                            {
                            reviews: {
                                starRating: rating,
                                textRating: textReview
                            }}
                        });
        

    // else {
    //     var index;
    //     var found = false;
    //     for (index = 0; index < result.cart.length; index++) {
    //         if (result.cart[index][0] == pokemonName) {
    //             found = true;
    //             break;
    //         }
    //     }
    //     if (found) {
    //         result.cart[index][2] = quantityChosen;
    //     }
    //     else {
    //         result.cart[result.cart.length] = [pokemonName, pokemon.price, quantityChosen];
    //     }
    // }
    // console.log(`new cart: `);
    // var index;
    // for (index = 0; index < result.cart.length; index++) {
    //     console.log(result.cart[index]);
    // }
    // result = await client.db(database_name).collection("users").updateOne(
    //     { "username": username },
    //     {
    //         $set: { "cart": result.cart }
    //     });
}

async function getReviews(username) {
    const result = await client.db("RateADate").collection("users").find({ "name": username }).toArray();
    return result;
}

app.get("/searchProduct", isUserAuthenticated, async function (req, res) {

    //   let categories = await getCategories();
    //console.log(categories);
    //   res.render("searchProduct", {"categories":categories});
    res.render("searchProduct");

});

app.get("/cart", isUserAuthenticated, async function (req, res) {
    //   console.log("happens")
    let items = await getCart(req.session.name);
    //   console.log(items);
    let total = 0;

    if (items != null) {
        items.forEach(function (item) {
            total += item[1] * item[2]
        })
        res.render("cart", { "items": items, "total": total });
    } else {
        res.render("cart", { "items": [, ,], "total": total });
    }

});

app.get("/checkout", isUserAuthenticated, async function (req, res) {

    let categories = await clearCart(req.session.name);
    //console.log(categories);
    res.render("checkout", { "categories": categories });

});

// from lab 9 user side of page
app.get("/products", isUserAuthenticated, async function (req, res) {
    let rows = await getProduct(req.query.keyword);
    res.render("products", { "records": rows });

});//product

app.get("/productDetails/:id", async function (req, res) {
    const record = await client.db("pokemondb").collection("pokemon").findOne({ name: req.params.id });
    console.log(record);
    res.render("productDetails", { "record": record });

});//productDetails

//Route for User Profile Page
app.get("/profilePage", async function (req, res) {
    //var cUser = req.cookie.cookieUser;
    var cUser = req.session.name;
    console.log(cUser);
    const userProf = await client.db(database_name).collection("users").findOne({ username: cUser });
    console.log(userProf);
    res.render("profilePage", { "userProf": userProf })
})

//Route for User Profile Page
app.get("/reviews", async function (req, res) {
    //var cUser = req.cookie.cookieUser;
    var cUser = req.session.name;
    let rows = await getReviews(cUser);
    const userProf = await client.db("RateADate").collection("users").findOne({ username: cUser });
    console.log("userProf: ", userProf);
    console.log("data from userProf: ", userProf.reviews);
    res.render("reviews", { "userProf": userProf,
                            "records": rows})
})

app.post("/addreview", isUserAuthenticated, async function (req, res) {
    const newReview = req.body;
    console.log("review: ", newReview);
    let rows = await(addReview(newReview.username, newReview.rating, newReview.textReview));
    // const result = await insertProduct(newPokemon);
    // console.log(`Pokemon added: ${result}`);
    // if (!result) {
    //     console.log("Pokemon's name: " + newPokemon.name);
    //     return res.redirect("updateProduct?pokemonName=" + newPokemon.name);
    // }
});

//Create Account POST
app.post("/index", function (req, res) {
    //Add data from form into, DB
    var tempName = req.body.username;
    var tempPass = req.body.password;
    var tempEmail = req.body.email;

    console.log(tempName)
    console.log(tempPass)
    console.log(tempEmail)
    createUser(tempName, tempPass, tempEmail)
    //Redirect to Main Page
    res.redirect("/")
})

//Create Account Route
app.get("/createAccount", function (req, res) {
    res.render("createAccount.ejs")
})

app.get("/productInfo", isUserAuthenticated, async function (req, res) {

    let rows = await getProduct(req.query.productID);
    //res.render("products", {"records":rows});
    res.send(rows)
});//product

async function getProduct(pokemonName) {
    var result;
    console.log(`getProduct run`);
    if (pokemonName == '') {
        result = await client.db("pokemondb").collection("pokemon").find().toArray();
    } else {
        result = await client.db("pokemondb").collection("pokemon").find({ name: pokemonName }).toArray();
    }

    console.log(result);
    return result;
}//getproduct

async function getReviewsFor(username) {
    let result = await client.db(database_name).collection("reviews").findOne({ "for": username });
    return result;
}

async function getReviewsBy(username) {
    let result = await client.db(database_name).collection("reviews").findOne({ "by": username });
    return result;
}

app.get("/api/reviews", async function (req, res) {
    let result = await getReviewsFor(req.body.username);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
})

async function setReview(user_for, user_by, rating, text) {
    let review = await client.db(database_name).collection("reviews").findOne({ "for": user_for, "by": user_by });
    let review_exists = true;

    if (!review) {
        review_exists = false;
        review = { "for": user_for, "by": user_by };
    }

    review.rating = rating;
    review.text = text;

    if (review_exists) {
        review = await client.db(database_name).collection("reviews").updateOne(
            { "for": user_for, "by": user_by },
            {
                $set: review
            });
    } else {
        review = await client.db(database_name).collection("reviews").insertOne(review);
    }

    return review;


}

app.post("/setreview_debug", async function (req, res) {
    let result = await setReview(req.body.for, req.body.by, req.body.rating, req.body.text);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
})


//starting server
app.listen(process.env.PORT, process.env.IP, function () {
    console.log(`Express server is running on ${process.env.IP}:${process.env.PORT}...`);
})